use tauri::Manager;
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            WindowStateBuilder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build()
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {

                    std::thread::sleep(std::time::Duration::from_millis(150));

                    let _ = window.show();
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}