mod commands;
mod crypto;
mod db;
mod error;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.manage(AppState::new(data_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // auth
            commands::auth::is_setup,
            commands::auth::is_unlocked,
            commands::auth::setup_password,
            commands::auth::unlock,
            commands::auth::lock,
            // patients
            commands::patients::get_patients,
            commands::patients::get_cycles,
            commands::patients::add_patient,
            commands::patients::delete_patient,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
