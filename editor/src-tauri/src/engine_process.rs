use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

pub struct EngineManager {
    process: Mutex<Option<Child>>,
    engine_path: PathBuf,
    ipc_port: u16,
    parent_hwnd: Mutex<Option<u64>>,  // Parent window handle for embedding
    starting: Mutex<bool>,  // Prevents stop during initialization
}

impl EngineManager {
    pub fn new() -> Self {
        // Try to find engine relative to editor, or use hardcoded path
        let engine_path = std::env::current_exe()
            .ok()
            .and_then(|exe_path| {
                // From: editor/src-tauri/target/release/ascii-dungeon-editor.exe
                // To:   build/Debug/ascii_dungeon.exe
                exe_path
                    .parent() // target/release
                    .and_then(|p| p.parent()) // target
                    .and_then(|p| p.parent()) // src-tauri
                    .and_then(|p| p.parent()) // editor
                    .and_then(|p| p.parent()) // ascii_dungeon root
                    .map(|p| p.join("build/Debug/ascii_dungeon.exe"))
            })
            .unwrap_or_else(|| PathBuf::from("D:/repos/ascii_dungeon/build/Debug/ascii_dungeon.exe"));

        Self {
            process: Mutex::new(None),
            engine_path,
            ipc_port: 9999,
            parent_hwnd: Mutex::new(None),
            starting: Mutex::new(false),
        }
    }

    pub fn set_parent_hwnd(&self, hwnd: u64) {
        if let Ok(mut guard) = self.parent_hwnd.lock() {
            *guard = Some(hwnd);
        }
    }

    /// Start the engine. Returns Ok(true) if engine was started, Ok(false) if skipped (already running/starting)
    pub fn start(&self) -> Result<bool, String> {
        // Set starting flag to prevent stop during initialization
        if let Ok(mut starting) = self.starting.lock() {
            if *starting {
                println!("Engine already starting, skipping");
                return Ok(false);  // Skipped - already starting
            }
            *starting = true;
        }

        let mut process_guard = self.process.lock().map_err(|e| e.to_string())?;

        if process_guard.is_some() {
            // Already running - this is fine (React StrictMode calls twice in dev)
            println!("Engine already running, skipping start");
            if let Ok(mut starting) = self.starting.lock() {
                *starting = false;
            }
            return Ok(false);  // Skipped - already running
        }

        // Check if engine exists
        if !self.engine_path.exists() {
            return Err(format!("Engine not found at: {:?}", self.engine_path));
        }

        // Get the engine's working directory (where shaders are)
        let working_dir = self
            .engine_path
            .parent()
            .ok_or("Invalid engine path")?;

        println!("Starting engine: {:?}", self.engine_path);
        println!("Working dir: {:?}", working_dir);

        // Build command arguments
        let mut args = vec![
            "--ipc-port".to_string(),
            self.ipc_port.to_string(),
            "--editor-mode".to_string(),
            "--no-vulkan".to_string(),  // TEMP: Test window embedding without Vulkan
        ];

        // Add parent HWND if set (for window embedding)
        if let Ok(hwnd_guard) = self.parent_hwnd.lock() {
            if let Some(hwnd) = *hwnd_guard {
                args.push("--parent-hwnd".to_string());
                args.push(hwnd.to_string());
                println!("Embedding in parent HWND: {}", hwnd);
            }
        }

        let child = Command::new(&self.engine_path)
            .current_dir(working_dir)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to start engine at {:?}: {}", self.engine_path, e))?;

        println!("Engine started with PID: {}", child.id());
        *process_guard = Some(child);
        Ok(true)  // Actually started
    }

    pub fn finish_starting(&self) {
        if let Ok(mut starting) = self.starting.lock() {
            *starting = false;
        }
    }

    /// Stop the engine. If force=true, stops even during startup (for window close).
    pub fn stop_with_force(&self, force: bool) -> Result<(), String> {
        // Don't stop if we're in the middle of starting (React StrictMode issue)
        // Unless force is true (for window close / cleanup)
        if !force {
            if let Ok(starting) = self.starting.lock() {
                if *starting {
                    println!("Engine is starting, skipping stop");
                    return Ok(());
                }
            }
        }

        // Clear starting flag when force-stopping
        if force {
            if let Ok(mut starting) = self.starting.lock() {
                *starting = false;
            }
        }

        let mut process_guard = self.process.lock().map_err(|e| e.to_string())?;

        if let Some(mut child) = process_guard.take() {
            println!("Stopping engine process (PID: {})", child.id());
            let _ = child.kill();
            let _ = child.wait();
            println!("Engine process stopped");
        }

        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.stop_with_force(false)
    }

    pub fn is_running(&self) -> bool {
        let process_guard = match self.process.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };

        if let Some(ref child) = *process_guard {
            // Check if process is still running by trying to get exit status
            // This is a non-blocking check
            match std::process::Command::new("tasklist")
                .args(["/FI", &format!("PID eq {}", child.id())])
                .output()
            {
                Ok(output) => {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    output_str.contains(&child.id().to_string())
                }
                Err(_) => false,
            }
        } else {
            false
        }
    }

    pub fn ipc_port(&self) -> u16 {
        self.ipc_port
    }

    pub fn set_engine_path(&mut self, path: PathBuf) {
        self.engine_path = path;
    }
}

impl Drop for EngineManager {
    fn drop(&mut self) {
        // Force stop on drop (editor closing)
        let _ = self.stop_with_force(true);
    }
}

impl Default for EngineManager {
    fn default() -> Self {
        Self::new()
    }
}
