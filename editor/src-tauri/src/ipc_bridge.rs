use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcRequest {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub id: String,
    pub method: String,
    pub params: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcResponse {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

type WsWriter = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    Message,
>;

type WsReader = futures_util::stream::SplitStream<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
>;

pub struct IpcBridge {
    writer: Arc<Mutex<Option<WsWriter>>>,
    reader: Arc<Mutex<Option<WsReader>>>,
    request_id: AtomicU64,
    port: u16,
    connected: AtomicBool,  // Track connection state to prevent double-connect
}

impl IpcBridge {
    pub fn new() -> Self {
        Self {
            writer: Arc::new(Mutex::new(None)),
            reader: Arc::new(Mutex::new(None)),
            request_id: AtomicU64::new(1),
            port: 9999,
            connected: AtomicBool::new(false),
        }
    }

    pub async fn connect(&self) -> Result<(), String> {
        // Always try to reconnect - old connections may be stale after page reload
        // First, clean up any existing connection
        if self.connected.load(Ordering::SeqCst) {
            println!("IPC was connected, resetting for fresh connection");
            *self.writer.lock().await = None;
            *self.reader.lock().await = None;
            self.connected.store(false, Ordering::SeqCst);
        }

        let url = format!("ws://127.0.0.1:{}", self.port);
        let (ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| format!("Failed to connect: {}", e))?;

        let (writer, reader) = ws_stream.split();

        *self.writer.lock().await = Some(writer);
        *self.reader.lock().await = Some(reader);
        self.connected.store(true, Ordering::SeqCst);

        println!("IPC connected to {}", url);
        Ok(())
    }

    pub async fn disconnect(&self) {
        // Only disconnect if we're actually connected
        if !self.connected.load(Ordering::SeqCst) {
            println!("IPC not connected, skipping disconnect");
            return;
        }

        *self.writer.lock().await = None;
        *self.reader.lock().await = None;
        self.connected.store(false, Ordering::SeqCst);
        println!("IPC disconnected");
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    pub async fn send_command(
        &self,
        method: &str,
        params: Value,
    ) -> Result<Value, String> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst).to_string();

        let request = IpcRequest {
            msg_type: "request".to_string(),
            id: id.clone(),
            method: method.to_string(),
            params,
        };

        let request_json =
            serde_json::to_string(&request).map_err(|e| e.to_string())?;

        // Send request
        {
            let mut writer_guard = self.writer.lock().await;
            let writer = writer_guard
                .as_mut()
                .ok_or("Not connected")?;

            writer
                .send(Message::Text(request_json))
                .await
                .map_err(|e| format!("Failed to send: {}", e))?;
        }

        // Read response
        {
            let mut reader_guard = self.reader.lock().await;
            let reader = reader_guard
                .as_mut()
                .ok_or("Not connected")?;

            // Wait for the response with matching ID
            while let Some(msg) = reader.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        let response: IpcResponse =
                            serde_json::from_str(&text).map_err(|e| e.to_string())?;

                        if response.id == id {
                            if response.success {
                                return Ok(response.data.unwrap_or(json!({})));
                            } else {
                                return Err(response
                                    .error
                                    .unwrap_or_else(|| "Unknown error".to_string()));
                            }
                        }
                        // If ID doesn't match, it might be an event - skip for now
                    }
                    Ok(Message::Close(_)) => {
                        return Err("Connection closed".to_string());
                    }
                    Err(e) => {
                        return Err(format!("WebSocket error: {}", e));
                    }
                    _ => {}
                }
            }
        }

        Err("No response received".to_string())
    }
}

impl Default for IpcBridge {
    fn default() -> Self {
        Self::new()
    }
}
