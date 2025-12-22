use crate::engine_process::EngineManager;
use crate::ipc_bridge::IpcBridge;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::process::Stdio;
use std::path::PathBuf;
use std::collections::HashMap;
use tokio::process::Command;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode};
use std::sync::Mutex;
use std::time::Duration;

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
    // On Windows, prefer .cmd files from npm
    #[cfg(windows)]
    {
        // First check npm global install location directly (most common)
        let npm_cmd = format!("{}\\AppData\\Roaming\\npm\\claude.cmd",
            std::env::var("USERPROFILE").unwrap_or_default());
        if std::path::Path::new(&npm_cmd).exists() {
            println!("[Claude] Found npm cmd: {}", npm_cmd);
            return Some(npm_cmd);
        }

        // Try 'where' command
        if let Ok(output) = std::process::Command::new("where")
            .arg("claude.cmd")
            .output()
        {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let first_line = path.lines().next().unwrap_or("").trim();
                    if !first_line.is_empty() {
                        println!("[Claude] Found via where: {}", first_line);
                        return Some(first_line.to_string());
                    }
                }
            }
        }

        // Also try without .cmd extension
        if let Ok(output) = std::process::Command::new("where")
            .arg("claude")
            .output()
        {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let first_line = path.lines().next().unwrap_or("").trim();
                    if !first_line.is_empty() {
                        // If it's an npm path without extension, add .cmd
                        let path_str = if first_line.contains("npm") && !first_line.ends_with(".cmd") {
                            format!("{}.cmd", first_line)
                        } else {
                            first_line.to_string()
                        };
                        println!("[Claude] Found via where (adjusted): {}", path_str);
                        return Some(path_str);
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
        if !path.is_empty() && std::path::Path::new(&path).exists() {
            println!("[Claude] Found at fallback path: {}", path);
            return Some(path);
        }
    }

    None
}

/// Check if Claude Code CLI is available
#[tauri::command]
pub async fn check_claude_available() -> Result<bool, String> {
    Ok(find_claude_path().is_some())
}

/// Open a terminal window for Claude authentication
#[tauri::command]
pub async fn open_claude_auth() -> Result<(), String> {
    let claude_path = find_claude_path()
        .ok_or_else(|| "Claude Code CLI not found".to_string())?;

    println!("[Claude] Opening terminal for authentication...");

    #[cfg(windows)]
    {
        // On Windows, open a new cmd window with claude running
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &claude_path])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, open Terminal.app
        std::process::Command::new("osascript")
            .args(["-e", &format!("tell app \"Terminal\" to do script \"{}\"", claude_path)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, try common terminal emulators
        let terminals = ["gnome-terminal", "konsole", "xterm", "x-terminal-emulator"];
        let mut opened = false;
        for term in terminals {
            if std::process::Command::new(term)
                .args(["--", &claude_path])
                .spawn()
                .is_ok()
            {
                opened = true;
                break;
            }
        }
        if !opened {
            return Err("Could not find a terminal emulator".to_string());
        }
    }

    Ok(())
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
        .ok_or_else(|| "Claude Code CLI not found. Install it from https://claude.ai/claude-code".to_string())?;

    println!("[Claude] Using path: {}", claude_path);
    println!("[Claude] Message: {}", message);
    println!("[Claude] Working dir: {:?}", working_dir);

    // Emit start event immediately
    if let Err(e) = app.emit("claude-stream", ClaudeStreamEvent {
        event_type: "start".to_string(),
        content: "".to_string(),
        conversation_id: conversation_id.clone(),
    }) {
        println!("[Claude] Failed to emit start event: {}", e);
    }

    // Build the claude command
    // Using -p (print mode) for non-interactive single-prompt execution
    // On Windows, npm-installed CLI tools are .cmd batch files that need cmd.exe
    // The 'where' command may return paths without extension, so we check multiple patterns
    let is_npm_cmd = cfg!(windows) && (
        claude_path.ends_with(".cmd") ||
        claude_path.ends_with(".CMD") ||
        claude_path.contains("\\npm\\") ||
        claude_path.contains("/npm/") ||
        claude_path.contains("\\AppData\\Roaming\\npm")
    );

    println!("[Claude] Is npm cmd file: {}", is_npm_cmd);

    // Use --print flag with message piped through stdin
    // Use --dangerously-skip-permissions so Claude can execute code changes
    // Note: We use plain text output (no --output-format) for simplicity
    let mut cmd = if is_npm_cmd {
        // Run through cmd.exe for batch files
        let mut c = Command::new("cmd.exe");
        c.arg("/C")
            .arg(&claude_path)
            .arg("--print")
            .arg("--dangerously-skip-permissions");
        c
    } else {
        let mut c = Command::new(&claude_path);
        c.arg("--print")
            .arg("--dangerously-skip-permissions");
        c
    };

    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped());  // Message will be piped through stdin

    // IMPORTANT: Remove ANTHROPIC_API_KEY to force Claude to use Max subscription auth
    // instead of an invalid/expired API key
    cmd.env_remove("ANTHROPIC_API_KEY");

    // Set working directory if provided
    if let Some(ref dir) = working_dir {
        cmd.current_dir(dir);
    }

    // Spawn the process
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let error_msg = format!("Failed to spawn claude: {}. Path: {}", e, claude_path);
            println!("[Claude] {}", error_msg);
            let _ = app.emit("claude-stream", ClaudeStreamEvent {
                event_type: "error".to_string(),
                content: error_msg.clone(),
                conversation_id: conversation_id.clone(),
            });
            return Err(error_msg);
        }
    };

    println!("[Claude] Process spawned successfully");

    // Write the message to stdin
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        println!("[Claude] Writing message to stdin: {}", message);
        if let Err(e) = stdin.write_all(message.as_bytes()).await {
            println!("[Claude] Failed to write to stdin: {}", e);
        }
        // Close stdin to signal end of input
        drop(stdin);
        println!("[Claude] Stdin closed");
    }

    // Get stdout and stderr for streaming
    let stdout = child.stdout.take()
        .ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take()
        .ok_or("Failed to capture stderr")?;

    // Read stdout and stderr concurrently using raw bytes for better streaming
    use tokio::io::AsyncReadExt;

    let app_stdout = app.clone();
    let conv_id_stdout = conversation_id.clone();

    // Spawn task to read stdout in small chunks for real-time streaming
    let stdout_handle = tokio::spawn(async move {
        let mut stdout = stdout;
        let mut full_response = String::new();
        let mut buffer = [0u8; 256]; // Small buffer for responsive streaming
        let mut chunk_count = 0;

        loop {
            match stdout.read(&mut buffer).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    chunk_count += 1;
                    if let Ok(text) = String::from_utf8(buffer[..n].to_vec()) {
                        println!("[Claude] stdout chunk {}: {} bytes", chunk_count, n);
                        full_response.push_str(&text);

                        // Emit chunk event immediately
                        if let Err(e) = app_stdout.emit("claude-stream", ClaudeStreamEvent {
                            event_type: "chunk".to_string(),
                            content: text,
                            conversation_id: conv_id_stdout.clone(),
                        }) {
                            println!("[Claude] Failed to emit chunk: {}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("[Claude] stdout read error: {}", e);
                    break;
                }
            }
        }

        println!("[Claude] stdout done, {} chunks, {} total chars", chunk_count, full_response.len());
        full_response
    });

    // Spawn task to read stderr and emit progress events
    let app_stderr = app.clone();
    let conv_id_stderr = conversation_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut stderr = stderr;
        let mut stderr_content = String::new();
        let mut buffer = [0u8; 1024];

        loop {
            match stderr.read(&mut buffer).await {
                Ok(0) => break,
                Ok(n) => {
                    if let Ok(text) = String::from_utf8(buffer[..n].to_vec()) {
                        println!("[Claude] stderr: {}", text);
                        stderr_content.push_str(&text);

                        // Emit progress event so UI can show what's happening
                        let _ = app_stderr.emit("claude-stream", ClaudeStreamEvent {
                            event_type: "progress".to_string(),
                            content: text,
                            conversation_id: conv_id_stderr.clone(),
                        });
                    }
                }
                Err(_) => break,
            }
        }

        stderr_content
    });

    // Wait for both readers to complete with a timeout
    // Code execution can take a while - 3 minutes should cover most cases
    let timeout_duration = tokio::time::Duration::from_secs(180);

    let result = tokio::time::timeout(
        timeout_duration,
        async {
            let (stdout_result, stderr_result) = tokio::join!(stdout_handle, stderr_handle);

            let full_response = stdout_result.unwrap_or_else(|e| {
                println!("[Claude] stdout task error: {}", e);
                String::new()
            });

            let stderr_content = stderr_result.unwrap_or_else(|e| {
                println!("[Claude] stderr task error: {}", e);
                String::new()
            });

            // Wait for process to complete
            let status = child.wait().await;

            (full_response, stderr_content, status)
        }
    ).await;

    // Handle timeout
    let (full_response, stderr_content, status_result) = match result {
        Ok(data) => data,
        Err(_) => {
            println!("[Claude] Process timed out after {} seconds", timeout_duration.as_secs());
            let error_msg = format!(
                "Claude process timed out after {} seconds. This usually means Claude is waiting for authentication. \
                Please run 'claude' in a terminal first to authenticate.",
                timeout_duration.as_secs()
            );
            let _ = app.emit("claude-stream", ClaudeStreamEvent {
                event_type: "error".to_string(),
                content: error_msg.clone(),
                conversation_id: conversation_id.clone(),
            });
            return Err(error_msg);
        }
    };

    let status = status_result.map_err(|e| format!("Error waiting for process: {}", e))?;

    println!("[Claude] Process exited with status: {}", status);
    println!("[Claude] Response length: {} chars", full_response.len());
    if !stderr_content.is_empty() {
        println!("[Claude] Stderr content: {}", stderr_content);
    }

    if status.success() && !full_response.is_empty() {
        // Emit done event
        if let Err(e) = app.emit("claude-stream", ClaudeStreamEvent {
            event_type: "done".to_string(),
            content: full_response,
            conversation_id: conversation_id.clone(),
        }) {
            println!("[Claude] Failed to emit done event: {}", e);
        }
    } else {
        // Log detailed error info
        println!("[Claude] ERROR - Status: {}", status);
        println!("[Claude] ERROR - Stdout length: {}", full_response.len());
        println!("[Claude] ERROR - Stderr: {}", stderr_content);
        println!("[Claude] ERROR - Stdout preview: {}", &full_response.chars().take(500).collect::<String>());

        // Emit error event with helpful message - include raw stderr for debugging
        let error_msg = if stderr_content.contains("out of") || stderr_content.contains("credits") || stderr_content.contains("disabled") {
            "API credits exhausted. Add credits at console.anthropic.com or sign in with Claude Max.".to_string()
        } else if stderr_content.contains("Login") || stderr_content.contains("auth") {
            format!("Authentication issue: {}", stderr_content)
        } else if !stderr_content.is_empty() {
            format!("Error: {}", stderr_content)
        } else if full_response.is_empty() {
            format!("Claude exited with status {} but produced no output. Stderr was empty. This may indicate an authentication issue.", status)
        } else {
            format!("Claude exited with status: {} - Output: {}", status, &full_response.chars().take(200).collect::<String>())
        };

        if let Err(e) = app.emit("claude-stream", ClaudeStreamEvent {
            event_type: "error".to_string(),
            content: error_msg,
            conversation_id: conversation_id.clone(),
        }) {
            println!("[Claude] Failed to emit error event: {}", e);
        }
    }

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE SYSTEM WATCHING
// ═══════════════════════════════════════════════════════════════════════════

/// Event emitted when files change
#[derive(Debug, Clone, Serialize)]
pub struct FileChangeEvent {
    pub event_type: String,  // "create", "modify", "delete"
    pub path: String,
}

/// State for managing the file watcher
pub struct FileWatcherState {
    /// The debouncer handle - dropping it stops watching
    debouncer: Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>,
    /// Path being watched
    watched_path: Option<PathBuf>,
}

impl Default for FileWatcherState {
    fn default() -> Self {
        Self {
            debouncer: None,
            watched_path: None,
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOATING PANEL WINDOWS
// ═══════════════════════════════════════════════════════════════════════════

/// State for tracking floating panel windows
pub struct FloatingWindowsState {
    /// Map of tab_id -> window_label
    windows: HashMap<String, String>,
}

impl Default for FloatingWindowsState {
    fn default() -> Self {
        Self {
            windows: HashMap::new(),
        }
    }
}

/// Result of creating a floating window
#[derive(Debug, Clone, Serialize)]
pub struct FloatingWindowResult {
    pub window_label: String,
    pub tab_id: String,
}

/// Create a new floating window for a panel
#[tauri::command]
pub async fn create_floating_window(
    app: AppHandle,
    floating_state: State<'_, Mutex<FloatingWindowsState>>,
    tab_id: String,
    title: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    graph_path: Option<String>,
    project_root: Option<String>,
) -> Result<FloatingWindowResult, String> {
    let window_label = format!("float_{}", tab_id);

    println!("[FloatingWindow] Creating window '{}' for tab '{}' at ({}, {}) size {}x{}",
             window_label, tab_id, x, y, width, height);

    // Check if window already exists
    if app.get_webview_window(&window_label).is_some() {
        return Err(format!("Floating window for tab '{}' already exists", tab_id));
    }

    // Build the URL with tab_id as query param so the window knows what to render
    // Also include optional graph_path and project_root for node-editor
    let mut url = format!("index.html?floating_panel={}", tab_id);
    if let Some(ref path) = graph_path {
        // URL-encode the path to handle special characters
        let encoded = urlencoding::encode(path);
        url.push_str(&format!("&graph_path={}", encoded));
    }
    if let Some(ref root) = project_root {
        let encoded = urlencoding::encode(root);
        url.push_str(&format!("&project_root={}", encoded));
    }

    // Create the window
    let window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(url.into()),
    )
    .title(&title)
    .inner_size(width as f64, height as f64)
    .position(x as f64, y as f64)
    .decorations(true)
    .resizable(true)
    .visible(true)
    .build()
    .map_err(|e| format!("Failed to create floating window: {}", e))?;

    // Track the window
    {
        let mut state = floating_state.lock().map_err(|e| e.to_string())?;
        state.windows.insert(tab_id.clone(), window_label.clone());
    }

    // Listen for window close to emit redock event
    let app_for_close = app.clone();
    let tab_id_for_close = tab_id.clone();
    let window_label_for_close = window_label.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            println!("[FloatingWindow] Window '{}' close requested, emitting redock", window_label_for_close);
            // Emit redock event to main window
            let _ = app_for_close.emit("floating-panel-redock", serde_json::json!({
                "tab_id": tab_id_for_close,
                "x": 0,
                "y": 0,
            }));
        }
    });

    println!("[FloatingWindow] Window '{}' created successfully", window_label);

    Ok(FloatingWindowResult {
        window_label,
        tab_id,
    })
}

/// Close a floating window and optionally get data to re-dock it
#[tauri::command]
pub async fn close_floating_window(
    app: AppHandle,
    floating_state: State<'_, Mutex<FloatingWindowsState>>,
    tab_id: String,
) -> Result<(), String> {
    let window_label = format!("float_{}", tab_id);

    println!("[FloatingWindow] Closing window '{}' for tab '{}'", window_label, tab_id);

    // Remove from tracking
    {
        let mut state = floating_state.lock().map_err(|e| e.to_string())?;
        state.windows.remove(&tab_id);
    }

    // Close the window if it exists
    if let Some(window) = app.get_webview_window(&window_label) {
        window.close().map_err(|e| format!("Failed to close window: {}", e))?;
    }

    Ok(())
}

/// Get current position and size of a floating window (for re-docking)
#[tauri::command]
pub async fn get_floating_window_bounds(
    app: AppHandle,
    tab_id: String,
) -> Result<(i32, i32, u32, u32), String> {
    let window_label = format!("float_{}", tab_id);

    let window = app.get_webview_window(&window_label)
        .ok_or_else(|| format!("Floating window '{}' not found", window_label))?;

    let position = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;

    Ok((position.x, position.y, size.width, size.height))
}

/// List all floating windows
#[tauri::command]
pub async fn list_floating_windows(
    floating_state: State<'_, Mutex<FloatingWindowsState>>,
) -> Result<Vec<String>, String> {
    let state = floating_state.lock().map_err(|e| e.to_string())?;
    Ok(state.windows.keys().cloned().collect())
}

/// Notify main window that a floating panel wants to re-dock
#[tauri::command]
pub async fn request_redock(
    app: AppHandle,
    tab_id: String,
    x: i32,
    y: i32,
) -> Result<(), String> {
    // Emit event to main window so it can handle the re-dock
    app.emit("floating-panel-redock", json!({
        "tab_id": tab_id,
        "x": x,
        "y": y,
    })).map_err(|e| format!("Failed to emit redock event: {}", e))?;

    Ok(())
}

/// Start watching a directory for file changes
#[tauri::command]
pub async fn start_file_watcher(
    app: AppHandle,
    watcher_state: State<'_, Mutex<FileWatcherState>>,
    path: String,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);

    if !watch_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    println!("[FileWatcher] Starting watcher for: {}", path);

    // Stop any existing watcher
    {
        let mut state = watcher_state.lock().map_err(|e| e.to_string())?;
        state.debouncer = None;
        state.watched_path = None;
    }

    // Create the watcher
    let app_handle = app.clone();
    let debouncer = new_debouncer(
        Duration::from_millis(500), // Debounce for 500ms
        move |result: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            match result {
                Ok(events) => {
                    for event in events {
                        let event_type = "modify".to_string(); // Debouncer only reports "any" event type
                        let path_str = event.path.to_string_lossy().to_string();

                        println!("[FileWatcher] File changed: {}", path_str);

                        // Emit event to frontend
                        if let Err(e) = app_handle.emit("file-change", FileChangeEvent {
                            event_type,
                            path: path_str,
                        }) {
                            println!("[FileWatcher] Failed to emit event: {}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("[FileWatcher] Error: {:?}", e);
                }
            }
        },
    ).map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Start watching
    {
        let mut state = watcher_state.lock().map_err(|e| e.to_string())?;
        let mut debouncer = debouncer;
        debouncer.watcher().watch(&watch_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to start watching: {}", e))?;

        state.debouncer = Some(debouncer);
        state.watched_path = Some(watch_path);
    }

    println!("[FileWatcher] Watcher started successfully");
    Ok(())
}

/// Stop the file watcher
#[tauri::command]
pub async fn stop_file_watcher(
    watcher_state: State<'_, Mutex<FileWatcherState>>,
) -> Result<(), String> {
    println!("[FileWatcher] Stopping watcher");

    let mut state = watcher_state.lock().map_err(|e| e.to_string())?;
    state.debouncer = None;
    state.watched_path = None;

    println!("[FileWatcher] Watcher stopped");
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE / PREFAB FILE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/// Category metadata (from _category.json files)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryMeta {
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

/// A scanned category with its contents
#[derive(Debug, Clone, Serialize)]
pub struct ScannedCategory {
    pub id: String,
    pub path: String,
    pub name: String,
    pub icon: Option<String>,
    pub children: Vec<String>,  // Child category IDs
    pub prefabs: Vec<String>,   // Prefab file paths (relative to palette root)
}

/// Result of scanning a palette folder
#[derive(Debug, Clone, Serialize)]
pub struct PaletteScanResult {
    pub categories: Vec<ScannedCategory>,
    pub root_categories: Vec<String>,
}

/// Scan a palette folder recursively and return its structure
#[tauri::command]
pub async fn scan_palette_folder(path: String) -> Result<PaletteScanResult, String> {
    let palette_path = PathBuf::from(&path);

    if !palette_path.exists() {
        return Err(format!("Palette folder does not exist: {}", path));
    }

    if !palette_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    println!("[Palette] Scanning folder: {}", path);

    let mut categories: Vec<ScannedCategory> = Vec::new();
    let mut root_categories: Vec<String> = Vec::new();

    // Recursively scan directories
    fn scan_dir(
        dir_path: &PathBuf,
        palette_root: &PathBuf,
        parent_id: Option<&str>,
        categories: &mut Vec<ScannedCategory>,
    ) -> Result<String, String> {
        let relative_path = dir_path.strip_prefix(palette_root)
            .map_err(|e| e.to_string())?;

        // Create category ID from relative path
        let category_id = if relative_path.as_os_str().is_empty() {
            "root".to_string()
        } else {
            relative_path.to_string_lossy().replace("\\", "/").replace("/", "_")
        };

        // Try to read _category.json for metadata
        let meta_path = dir_path.join("_category.json");
        let (name, icon) = if meta_path.exists() {
            match std::fs::read_to_string(&meta_path) {
                Ok(content) => {
                    match serde_json::from_str::<CategoryMeta>(&content) {
                        Ok(meta) => (meta.name, meta.icon),
                        Err(_) => (dir_path.file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| category_id.clone()), None),
                    }
                }
                Err(_) => (dir_path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| category_id.clone()), None),
            }
        } else {
            (dir_path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| category_id.clone()), None)
        };

        let mut children: Vec<String> = Vec::new();
        let mut prefabs: Vec<String> = Vec::new();

        // Scan directory contents
        let entries = std::fs::read_dir(dir_path)
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files and _category.json
            if file_name.starts_with('.') || file_name.starts_with('_') {
                continue;
            }

            if entry_path.is_dir() {
                // Recursively scan subdirectory
                let child_id = scan_dir(&entry_path, palette_root, Some(&category_id), categories)?;
                children.push(child_id);
            } else if file_name.ends_with(".prefab.json") {
                // Found a prefab file
                let prefab_path = entry_path.strip_prefix(palette_root)
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .replace("\\", "/");
                prefabs.push(prefab_path);
            }
        }

        // Add this category
        categories.push(ScannedCategory {
            id: category_id.clone(),
            path: dir_path.to_string_lossy().to_string(),
            name,
            icon,
            children,
            prefabs,
        });

        Ok(category_id)
    }

    // Scan top-level directories (not the root itself)
    let entries = std::fs::read_dir(&palette_path)
        .map_err(|e| format!("Failed to read palette folder: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files
        if file_name.starts_with('.') || file_name.starts_with('_') {
            continue;
        }

        if entry_path.is_dir() {
            let category_id = scan_dir(&entry_path, &palette_path, None, &mut categories)?;
            root_categories.push(category_id);
        }
    }

    println!("[Palette] Found {} categories, {} root categories",
             categories.len(), root_categories.len());

    Ok(PaletteScanResult {
        categories,
        root_categories,
    })
}

/// Read a prefab file
#[tauri::command]
pub async fn read_prefab_file(path: String) -> Result<Value, String> {
    let prefab_path = PathBuf::from(&path);

    if !prefab_path.exists() {
        return Err(format!("Prefab file does not exist: {}", path));
    }

    let content = std::fs::read_to_string(&prefab_path)
        .map_err(|e| format!("Failed to read prefab file: {}", e))?;

    let prefab: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse prefab JSON: {}", e))?;

    Ok(prefab)
}

/// Write a prefab file
#[tauri::command]
pub async fn write_prefab_file(path: String, prefab: Value) -> Result<(), String> {
    let prefab_path = PathBuf::from(&path);

    // Ensure parent directory exists
    if let Some(parent) = prefab_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&prefab)
        .map_err(|e| format!("Failed to serialize prefab: {}", e))?;

    std::fs::write(&prefab_path, content)
        .map_err(|e| format!("Failed to write prefab file: {}", e))?;

    println!("[Palette] Wrote prefab file: {}", path);
    Ok(())
}

/// Delete a prefab file
#[tauri::command]
pub async fn delete_prefab_file(path: String) -> Result<(), String> {
    let prefab_path = PathBuf::from(&path);

    if !prefab_path.exists() {
        return Err(format!("Prefab file does not exist: {}", path));
    }

    std::fs::remove_file(&prefab_path)
        .map_err(|e| format!("Failed to delete prefab file: {}", e))?;

    println!("[Palette] Deleted prefab file: {}", path);
    Ok(())
}

/// Create a new category folder
#[tauri::command]
pub async fn create_category_folder(path: String, name: String, icon: Option<String>) -> Result<(), String> {
    let folder_path = PathBuf::from(&path);

    // Create the folder
    std::fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    // Create _category.json with metadata
    let meta = CategoryMeta {
        name,
        icon,
        description: None,
    };

    let meta_path = folder_path.join("_category.json");
    let content = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize category metadata: {}", e))?;

    std::fs::write(&meta_path, content)
        .map_err(|e| format!("Failed to write category metadata: {}", e))?;

    println!("[Palette] Created category folder: {}", path);
    Ok(())
}

/// Open a file or folder in VS Code
#[tauri::command]
pub async fn open_in_external_editor(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    // Try VS Code first, then fall back to other editors
    #[cfg(target_os = "windows")]
    {
        let result = Command::new("cmd")
            .args(["/C", "code", &path])
            .spawn();

        match result {
            Ok(_) => {
                println!("[Editor] Opened in VS Code: {}", path);
                return Ok(());
            }
            Err(_) => {
                // Try opening with default app
                Command::new("cmd")
                    .args(["/C", "start", "", &path])
                    .spawn()
                    .map_err(|e| format!("Failed to open file: {}", e))?;
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let result = Command::new("code")
            .arg(&path)
            .spawn();

        match result {
            Ok(_) => {
                println!("[Editor] Opened in VS Code: {}", path);
                return Ok(());
            }
            Err(_) => {
                Command::new("open")
                    .arg(&path)
                    .spawn()
                    .map_err(|e| format!("Failed to open file: {}", e))?;
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let result = Command::new("code")
            .arg(&path)
            .spawn();

        match result {
            Ok(_) => {
                println!("[Editor] Opened in VS Code: {}", path);
                return Ok(());
            }
            Err(_) => {
                Command::new("xdg-open")
                    .arg(&path)
                    .spawn()
                    .map_err(|e| format!("Failed to open file: {}", e))?;
            }
        }
    }

    Ok(())
}

/// Reveal a file or folder in the system file explorer
#[tauri::command]
pub async fn reveal_in_file_explorer(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    // Get the parent directory for files, or the path itself for directories
    let reveal_path = if path_buf.is_file() {
        path_buf.parent().map(|p| p.to_path_buf()).unwrap_or(path_buf.clone())
    } else {
        path_buf.clone()
    };

    #[cfg(target_os = "windows")]
    {
        // On Windows, use explorer to select the file
        if path_buf.is_file() {
            Command::new("explorer")
                .args(["/select,", &path])
                .spawn()
                .map_err(|e| format!("Failed to reveal in explorer: {}", e))?;
        } else {
            Command::new("explorer")
                .arg(&reveal_path)
                .spawn()
                .map_err(|e| format!("Failed to reveal in explorer: {}", e))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&reveal_path.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Failed to reveal in file manager: {}", e))?;
    }

    println!("[Explorer] Revealed: {}", path);
    Ok(())
}
