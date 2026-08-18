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
            // The local per-user folder always holds config.json (which may
            // point at a shared network folder for the actual data).
            let local_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&local_dir)?;
            let config_path = local_dir.join("config.json");

            // Effective data dir: the shared folder if configured, else local.
            let data_dir = commands::settings::resolve_data_dir(&config_path, &local_dir);
            std::fs::create_dir_all(&data_dir)?;

            app.manage(AppState::new(data_dir, config_path));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // auth
            commands::auth::is_setup,
            commands::auth::is_unlocked,
            commands::auth::setup_password,
            commands::auth::unlock,
            commands::auth::lock,
            commands::auth::change_password,
            commands::auth::is_admin_set,
            commands::auth::set_admin_password,
            // settings / shared data folder
            commands::settings::get_data_location,
            commands::settings::pick_data_folder,
            commands::settings::set_data_location,
            commands::settings::restart_app,
            // patients
            commands::patients::get_patients,
            commands::patients::get_cycles,
            commands::patients::add_patient,
            commands::patients::update_cycle,
            commands::patients::delete_patient,
            // schedules
            commands::schedules::get_schedules,
            commands::schedules::save_schedule,
            commands::schedules::delete_schedule,
            // media
            commands::media::save_media,
            commands::media::get_media,
            commands::media::read_media_file,
            commands::media::delete_media,
            commands::media::export_media,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
