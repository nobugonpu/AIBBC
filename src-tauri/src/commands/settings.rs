use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, State};

/// On-disk config (config.json in the local app data dir). Holds the optional
/// path to a shared data folder. When set, the app stores its database, salt
/// and media there instead of the per-user local folder — this is how several
/// staff members share the same patient schedule.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub shared_data_dir: Option<String>,
}

pub fn read_config(path: &Path) -> Config {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Resolves the effective data directory: the shared folder if one is
/// configured and usable, otherwise the given local fallback.
pub fn resolve_data_dir(config_path: &Path, local_dir: &Path) -> std::path::PathBuf {
    let cfg = read_config(config_path);
    if let Some(shared) = cfg.shared_data_dir {
        let trimmed = shared.trim();
        if !trimmed.is_empty() {
            let p = std::path::PathBuf::from(trimmed);
            // Use the shared folder only if it exists or can be created.
            if fs::create_dir_all(&p).is_ok() {
                return p;
            }
        }
    }
    local_dir.to_path_buf()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataLocation {
    pub path: String,
    pub is_shared: bool,
}

/// Returns where data is currently stored and whether it's a shared folder.
#[tauri::command]
pub fn get_data_location(state: State<'_, AppState>) -> DataLocation {
    let is_shared = read_config(&state.config_path)
        .shared_data_dir
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    DataLocation {
        path: state.paths.data_dir.to_string_lossy().to_string(),
        is_shared,
    }
}

/// Opens a native folder picker so the user can choose the shared data folder.
/// Returns the chosen path, or None if cancelled.
#[tauri::command]
pub fn pick_data_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("共有データフォルダを選択")
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

/// Persists the shared data folder choice to config.json. Pass None (or an
/// empty string) to revert to the local per-user folder. The change takes
/// effect after the app restarts, because the data paths are resolved once at
/// startup. Validates that the folder can be created/written.
#[tauri::command]
pub fn set_data_location(path: Option<String>, state: State<'_, AppState>) -> AppResult<()> {
    let cleaned = path.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });

    if let Some(ref p) = cleaned {
        // Fail early with a clear error if the folder is not usable.
        fs::create_dir_all(p)
            .map_err(|e| AppError::Other(format!("フォルダにアクセスできません: {}", e)))?;
    }

    let cfg = Config {
        shared_data_dir: cleaned,
    };
    let json =
        serde_json::to_string_pretty(&cfg).map_err(|e| AppError::Other(e.to_string()))?;
    fs::write(&state.config_path, json)?;
    Ok(())
}

/// Restarts the application so a new data-folder setting takes effect.
#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}
