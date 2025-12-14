mod commands;
mod engine_process;
mod ipc_bridge;

use tauri::Manager;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize engine manager (wrapped in Arc for exit handler)
            let engine_manager = Arc::new(engine_process::EngineManager::new());
            app.manage(engine_manager);

            // Initialize IPC bridge
            let ipc_bridge = ipc_bridge::IpcBridge::new();
            app.manage(ipc_bridge);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Window is being destroyed - stop the engine
                if let Some(engine) = window.app_handle().try_state::<Arc<engine_process::EngineManager>>() {
                    println!("Window destroyed, stopping engine...");
                    let _ = engine.stop_with_force(true);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_engine,
            commands::stop_engine,
            commands::get_stats,
            commands::get_camera,
            commands::set_camera,
            commands::send_command,
            commands::start_engine_embedded,
            commands::start_engine_with_parent,
            commands::resize_engine_viewport,
            commands::set_engine_bounds,
            commands::set_engine_owner,
            commands::set_engine_follow,
            commands::show_engine,
            commands::get_window_hwnd,
            // Claude Code integration
            commands::check_claude_available,
            commands::get_claude_path,
            commands::send_claude_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
