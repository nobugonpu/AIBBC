use crate::crypto::key::DerivedKey;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppPaths {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub salt_path: PathBuf,
    pub media_dir: PathBuf,
    /// Per-user account store (envelope-encrypted DEK per user).
    pub users_path: PathBuf,
}

impl AppPaths {
    pub fn new(data_dir: PathBuf) -> Self {
        let db_path = data_dir.join("data.db");
        let salt_path = data_dir.join("salt");
        let media_dir = data_dir.join("media");
        let users_path = data_dir.join("users.json");
        Self {
            data_dir,
            db_path,
            salt_path,
            media_dir,
            users_path,
        }
    }
}

/// Holds both the SQLCipher connection and the in-memory session key.
/// When the user locks, this entire variant is dropped — the Connection
/// closes and the DerivedKey is zeroed (via its Drop impl).
pub enum DbState {
    Locked,
    Unlocked { conn: Connection, key: DerivedKey },
}

impl DbState {
    pub fn is_unlocked(&self) -> bool {
        matches!(self, DbState::Unlocked { .. })
    }
}

pub struct AppState {
    /// Paths to the *effective* data directory (local by default, or the
    /// shared network folder when configured).
    pub paths: AppPaths,
    /// Path to config.json, always stored in the per-user local app data dir,
    /// so the "where is the shared folder" setting travels with the machine.
    pub config_path: PathBuf,
    pub db: Mutex<DbState>,
    /// Username of the person logged into this session, recorded in the audit log.
    pub operator: Mutex<String>,
    /// Role of the logged-in user ("admin" or "user"); empty when locked.
    pub role: Mutex<String>,
}

impl AppState {
    pub fn new(data_dir: PathBuf, config_path: PathBuf) -> Self {
        Self {
            paths: AppPaths::new(data_dir),
            config_path,
            db: Mutex::new(DbState::Locked),
            operator: Mutex::new(String::new()),
            role: Mutex::new(String::new()),
        }
    }
}
