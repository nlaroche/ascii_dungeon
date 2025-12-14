use crate::engine_process::EngineManager;
use crate::ipc_bridge::IpcBridge;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::process::Stdio;
use tokio::process::Command;
use tokio::io::{BufReader, AsyncBufReadExt};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStats {
    pub fps: f32,
    #[serde(rename = "frameTime")]
    pub frame_time: f32,
    #[serde(rename = "instanceCount")]
    pub instance_count: u32,
    #[serde(rename = "lightCount")]
    pub light_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraState {
    pub position: [f32; 3],
    pub yaw: f32,
    pub pitch: f32,
}

#[tauri::command]
pub async fn start_engine(
    engine: State<'_, Arc<EngineManager>>,
    ipc: State<'_, IpcBridge>,
) -> Result<(), String> {
    // Start the engine process - returns false if skipped (already running/starting)
    let actually_started = engine.start()?;
    if !actually_started {
        return Ok(());  // Engine was already running/starting, skip the rest
    }

    // Wait a bit for the engine to initialize
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Clear the starting flag now that initialization is complete
    engine.finish_starting();

    // Connect to the engine's WebSocket server
    ipc.connect().await?;

    Ok(())
}

#[tauri::command]
pub async fn stop_engine(
    engine: State<'_, Arc<EngineManager>>,
    ipc: State<'_, IpcBridge>,
    force: Option<bool>,
) -> Result<(), String> {
    let is_force = force.unwrap_or(false);

    // Only disconnect and stop if force=true (window closing)
    // This prevents React StrictMode cleanup from killing the engine
    if is_force {
        // Disconnect from WebSocket first (ignore errors - may already be disconnected)
        ipc.disconnect().await;
        // Force stop the engine process
        let _ = engine.stop_with_force(true);
    } else {
        // Non-forced stop - just try to stop if not starting
        // Don't disconnect IPC (React StrictMode will remount)
        let _ = engine.stop_with_force(false);
    }

    Ok(())
}

#[tauri::command]
pub async fn get_stats(ipc: State<'_, IpcBridge>) -> Result<EngineStats, String> {
    let response = ipc.send_command("stats.get", json!({})).await?;

    // Parse the response
    let fps = response["fps"].as_f64().unwrap_or(0.0) as f32;
    let frame_time = response["frame_time"].as_f64().unwrap_or(0.0) as f32;
    let instance_count = response["instance_count"].as_u64().unwrap_or(0) as u32;
    let light_count = response["light_count"].as_u64().unwrap_or(0) as u32;

    Ok(EngineStats {
        fps,
        frame_time,
        instance_count,
        light_count,
    })
}

#[tauri::command]
pub async fn get_camera(ipc: State<'_, IpcBridge>) -> Result<CameraState, String> {
    let response = ipc.send_command("camera.get", json!({})).await?;

    let position = response["position"]
        .as_array()
        .map(|arr| {
            [
                arr.get(0).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                arr.get(1).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                arr.get(2).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            ]
        })
        .unwrap_or([0.0, 0.0, 0.0]);

    let yaw = response["yaw"].as_f64().unwrap_or(0.0) as f32;
    let pitch = response["pitch"].as_f64().unwrap_or(0.0) as f32;

    Ok(CameraState {
        position,
        yaw,
        pitch,
    })
}

#[tauri::command]
pub async fn set_camera(
    ipc: State<'_, IpcBridge>,
    camera: CameraState,
) -> Result<(), String> {
    let params = json!({
        "position": camera.position,
        "yaw": camera.yaw,
        "pitch": camera.pitch,
    });

    ipc.send_command("camera.set", params).await?;
    Ok(())
}

#[tauri::command]
pub async fn send_command(
    ipc: State<'_, IpcBridge>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    ipc.send_command(&method, params).await
}

/// Start the engine embedded in a parent window using SetParent
#[tauri::command]
pub async fn start_engine_with_parent(
    engine: State<'_, Arc<EngineManager>>,
    ipc: State<'_, IpcBridge>,
    parent_hwnd: u64,
) -> Result<(), String> {
    // Set the parent HWND for true embedding
    engine.set_parent_hwnd(parent_hwnd);

    // Start the engine - returns false if skipped (already running/starting)
    let actually_started = engine.start()?;
    if !actually_started {
        return Ok(());  // Engine was already running/starting, skip the rest
    }

    // Wait for engine to initialize (IPC server starts in ~600ms)
    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

    // Clear the starting flag now that initialization is complete
    engine.finish_starting();

    // Connect to the engine's WebSocket server
    ipc.connect().await?;

    Ok(())
}

/// Start the engine in overlay mode (positioned over viewport) - fallback
#[tauri::command]
pub async fn start_engine_embedded(
    engine: State<'_, Arc<EngineManager>>,
    ipc: State<'_, IpcBridge>,
) -> Result<(), String> {
    // Start the engine - returns false if skipped (already running/starting)
    let actually_started = engine.start()?;

    if actually_started {
        // We actually started the engine, wait for it to initialize
        // Wait for engine to initialize (IPC server starts in ~700ms)
        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        // Clear the starting flag now that initialization is complete
        engine.finish_starting();
    } else {
        // Engine already running/starting - wait a bit for it to be ready
        // This handles React StrictMode re-mount
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Connect to the engine's WebSocket server (will skip if already connected)
    ipc.connect().await?;

    Ok(())
}

/// Resize the engine viewport
#[tauri::command]
pub async fn resize_engine_viewport(
    ipc: State<'_, IpcBridge>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let params = json!({
        "width": width,
        "height": height,
    });

    ipc.send_command("window.resize", params).await?;
    Ok(())
}

/// Set engine window bounds (position and size) for overlay mode
#[tauri::command]
pub async fn set_engine_bounds(
    ipc: State<'_, IpcBridge>,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let params = json!({
        "x": x,
        "y": y,
        "width": width,
        "height": height,
    });

    ipc.send_command("window.set_bounds", params).await?;
    Ok(())
}

/// Set engine window owner for z-order (overlay stays above owner)
#[tauri::command]
pub async fn set_engine_owner(
    ipc: State<'_, IpcBridge>,
    hwnd: u64,
) -> Result<(), String> {
    let params = json!({
        "hwnd": hwnd,
    });

    ipc.send_command("window.set_owner", params).await?;
    Ok(())
}

/// Enable low-latency follow mode - engine polls owner window position directly
#[tauri::command]
pub async fn set_engine_follow(
    ipc: State<'_, IpcBridge>,
    follow: bool,
    offset_x: i32,
    offset_y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let params = json!({
        "follow": follow,
        "offset_x": offset_x,
        "offset_y": offset_y,
        "width": width,
        "height": height,
    });

    ipc.send_command("window.set_follow", params).await?;
    Ok(())
}

/// Show the engine window (call after positioning)
#[tauri::command]
pub async fn show_engine(ipc: State<'_, IpcBridge>) -> Result<(), String> {
    ipc.send_command("window.show", json!({})).await?;
    Ok(())
}

/// Get the main window HWND (for debugging)
#[tauri::command]
pub async fn get_window_hwnd(app: AppHandle) -> Result<u64, String> {
    #[cfg(windows)]
    {
        let window = app.get_webview_window("main")
            .ok_or("Failed to get main window")?;

        let hwnd = window.hwnd()
            .map_err(|e| format!("Failed to get HWND: {}", e))?;

        Ok(hwnd.0 as u64)
    }

    #[cfg(not(windows))]
    {
        Err("Not supported on this platform".to_string())
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE CODE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize)]
pub struct ClaudeStreamEvent {
    pub event_type: String,  // "start", "chunk", "done", "error"
    pub content: String,
    pub conversation_id: String,
}

/// Find the claude executable path
fn find_claude_path() -> Option<String> {
    // First try using 'where' on Windows or 'which' on Unix to find it
    #[cfg(windows)]
    {
        if let Ok(output) = std::process::Command::new("where")
            .arg("claude")
            .output()
        {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let first_line = path.lines().next().unwrap_or("").trim();
                    if !first_line.is_empty() {
                        return Some(first_line.to_string());
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        if let Ok(output) = std::process::Command::new("which")
            .arg("claude")
            .output()
        {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let trimmed = path.trim();
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                }
            }
        }
    }

    // Try common locations as fallback
    let possible_paths = vec![
        "claude".to_string(),  // In PATH
        #[cfg(windows)]
        format!("{}\\AppData\\Local\\Programs\\claude-code\\claude.exe", std::env::var("USERPROFILE").unwrap_or_default()),
        #[cfg(windows)]
        format!("{}\\AppData\\Roaming\\npm\\claude.cmd", std::env::var("USERPROFILE").unwrap_or_default()),
        #[cfg(windows)]
        format!("{}\\.claude\\local\\claude.exe", std::env::var("USERPROFILE").unwrap_or_default()),
        #[cfg(windows)]
        format!("{}\\scoop\\shims\\claude.cmd", std::env::var("USERPROFILE").unwrap_or_default()),
        #[cfg(not(windows))]
        format!("{}/.claude/local/claude", std::env::var("HOME").unwrap_or_default()),
        #[cfg(not(windows))]
        "/usr/local/bin/claude".to_string(),
        #[cfg(not(windows))]
        format!("{}/.local/bin/claude", std::env::var("HOME").unwrap_or_default()),
    ];

    for path in possible_paths {
        if !path.is_empty() {
            // Check if file exists
            if std::path::Path::new(&path).exists() {
                return Some(path);
            }
            // Try running it
            let result = std::process::Command::new(&path)
                .arg("--version")
                .output();

            if result.is_ok() {
                return Some(path);
            }
        }
    }

    None
}

/// Check if Claude Code CLI is available
#[tauri::command]
pub async fn check_claude_available() -> Result<bool, String> {
    Ok(find_claude_path().is_some())
}

/// Get the path to claude executable
#[tauri::command]
pub async fn get_claude_path() -> Result<Option<String>, String> {
    Ok(find_claude_path())
}

/// Send a message to Claude Code and stream the response
#[tauri::command]
pub async fn send_claude_message(
    app: AppHandle,
    message: String,
    conversation_id: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    // Find claude executable
    let claude_path = find_claude_path()
        .ok_or_else(|| "Claude Code CLI not found".to_string())?;

    println!("[Claude] Using path: {}", claude_path);
    println!("[Claude] Message: {}", message);

    // Emit start event
    let _ = app.emit("claude-stream", ClaudeStreamEvent {
        event_type: "start".to_string(),
        content: "".to_string(),
        conversation_id: conversation_id.clone(),
    });

    // Build the claude command
    // Using -p (print mode) with --output-format text for clean output
    let mut cmd = Command::new(&claude_path);
    cmd.arg("-p")  // print mode (non-interactive)
        .arg(&message)
        .arg("--output-format")
        .arg("text")  // plain text output, no markdown streaming artifacts
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());  // No stdin to prevent interactive prompts

    // Set working directory if provided
    if let Some(dir) = working_dir {
        cmd.current_dir(&dir);
    }

    // Spawn the process
    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn claude: {}", e))?;

    println!("[Claude] Process spawned");

    // Get stdout and stderr for streaming
    let stdout = child.stdout.take()
        .ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take();

    // Read stdout in chunks for better streaming
    let mut reader = BufReader::new(stdout);
    let mut full_response = String::new();
    let mut buffer = [0u8; 1024];

    use tokio::io::AsyncReadExt;

    loop {
        match reader.read(&mut buffer).await {
            Ok(0) => break, // EOF
            Ok(n) => {
                if let Ok(text) = String::from_utf8(buffer[..n].to_vec()) {
                    full_response.push_str(&text);

                    // Emit chunk event for each read
                    let _ = app.emit("claude-stream", ClaudeStreamEvent {
                        event_type: "chunk".to_string(),
                        content: text,
                        conversation_id: conversation_id.clone(),
                    });
                }
            }
            Err(e) => {
                println!("[Claude] Read error: {}", e);
                break;
            }
        }
    }

    // Check stderr for errors
    if let Some(stderr) = stderr {
        let mut stderr_reader = BufReader::new(stderr);
        let mut stderr_content = String::new();
        use tokio::io::AsyncReadExt;
        let _ = stderr_reader.read_to_string(&mut stderr_content).await;
        if !stderr_content.is_empty() {
            println!("[Claude] Stderr: {}", stderr_content);
        }
    }

    // Wait for process to complete
    let status = child.wait().await
        .map_err(|e| format!("Error waiting for process: {}", e))?;

    println!("[Claude] Process exited with status: {}", status);

    if status.success() {
        // Emit done event
        let _ = app.emit("claude-stream", ClaudeStreamEvent {
            event_type: "done".to_string(),
            content: full_response.clone(),
            conversation_id: conversation_id.clone(),
        });
        println!("[Claude] Response length: {} chars", full_response.len());
    } else {
        // Emit error event
        let error_msg = if full_response.is_empty() {
            format!("Claude exited with status: {}", status)
        } else {
            full_response
        };
        let _ = app.emit("claude-stream", ClaudeStreamEvent {
            event_type: "error".to_string(),
            content: error_msg,
            conversation_id: conversation_id.clone(),
        });
    }

    Ok(())
}
