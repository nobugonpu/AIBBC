use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppPaths {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub salt_path: PathBuf,
    pub media_dir: PathBuf,
}

impl AppPaths {
    pub fn new(data_dir: PathBuf) -> Self {
        let db_path = data_dir.join("data.db");
        let salt_path = data_dir.join("salt");
        let media_dir = data_dir.join("media");
        Self {
            data_dir,
            db_path,
            salt_path,
            media_dir,
        }
    }
}

pub enum DbState {
    Locked,
    Unlocked(Connection),
}

impl DbState {
    pub fn is_unlocked(&self) -> bool {
        matches!(self, DbState::Unlocked(_))
    }
}

pub struct AppState {
    pub paths: AppPaths,
    pub db: Mutex<DbState>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            paths: AppPaths::new(data_dir),
            db: Mutex::new(DbState::Locked),
        }
    }
}
