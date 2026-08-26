use crate::crypto::key::{derive_key, generate_salt};
use crate::db::{open_encrypted, schema::run_migrations};
use crate::error::{AppError, AppResult};
use crate::state::{AppState, DbState};
use rusqlite::OptionalExtension;
use std::fs;
use tauri::State;

/// Returns true if the app has been configured (salt file exists).
#[tauri::command]
pub fn is_setup(state: State<'_, AppState>) -> bool {
    state.paths.salt_path.exists()
}

/// Returns true if the DB is currently open (session is active).
#[tauri::command]
pub fn is_unlocked(state: State<'_, AppState>) -> AppResult<bool> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    Ok(guard.is_unlocked())
}

/// First-time setup: generates salt, derives key, creates encrypted DB, runs migrations.
/// Returns an error if already configured.
#[tauri::command]
pub fn setup_password(
    password: String,
    operator: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    if state.paths.salt_path.exists() {
        return Err(AppError::AlreadyConfigured);
    }
    if password.len() < 8 {
        return Err(AppError::Other(
            "パスワードは8文字以上にしてください".into(),
        ));
    }

    fs::create_dir_all(&state.paths.data_dir)?;
    fs::create_dir_all(&state.paths.media_dir)?;

    let salt = generate_salt();
    let key = derive_key(&password, &salt);

    // Create DB and run migrations before committing the salt file.
    // If anything fails here, no salt is written → is_setup() stays false.
    let conn = open_encrypted(&state.paths.db_path, &key)?;
    run_migrations(&conn)?;

    // Only write salt after the DB is confirmed good.
    if let Err(e) = fs::write(&state.paths.salt_path, hex::encode(salt)) {
        // Partial-state cleanup: remove the just-created DB so next attempt is clean.
        let _ = fs::remove_file(&state.paths.db_path);
        return Err(AppError::Io(e));
    }

    let op = operator.unwrap_or_default();
    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    *guard = DbState::Unlocked { conn, key };
    if let DbState::Unlocked { conn, .. } = &*guard {
        crate::commands::audit::write(conn, &op, "初回セットアップ", "");
    }
    drop(guard);
    if let Ok(mut o) = state.operator.lock() {
        *o = op;
    }
    Ok(())
}

/// Reads the stored salt, re-derives the key from the given password,
/// and opens the encrypted DB. Returns InvalidPassword on wrong password.
#[tauri::command]
pub fn unlock(
    password: String,
    operator: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<()> {
    if !state.paths.salt_path.exists() {
        return Err(AppError::NotConfigured);
    }

    let salt_hex = fs::read_to_string(&state.paths.salt_path)?;
    let salt = hex::decode(salt_hex.trim())?;

    let key = derive_key(&password, &salt);
    let conn = open_encrypted(&state.paths.db_path, &key)?;

    // run_migrations is idempotent — ensures schema is up-to-date after updates.
    run_migrations(&conn)?;

    let op = operator.unwrap_or_default();
    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    *guard = DbState::Unlocked { conn, key };
    if let DbState::Unlocked { conn, .. } = &*guard {
        crate::commands::audit::write(conn, &op, "ロック解除", "");
    }
    drop(guard);
    if let Ok(mut o) = state.operator.lock() {
        *o = op;
    }
    Ok(())
}

/// Closes the DB connection and drops the in-memory session.
/// The derived key is never stored, so lock means the data is inaccessible
/// until the user re-enters their password.
#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> AppResult<()> {
    let op = crate::commands::audit::operator_of(&state.operator);
    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    if let DbState::Unlocked { conn, .. } = &*guard {
        crate::commands::audit::write(conn, &op, "ロック", "");
    }
    *guard = DbState::Locked;
    drop(guard);
    if let Ok(mut o) = state.operator.lock() {
        o.clear();
    }
    Ok(())
}

/// Verifies an admin password against a stored "salt_hex:hash_hex" value.
fn verify_admin_hash(stored: &str, password: &str) -> bool {
    let mut parts = stored.splitn(2, ':');
    let salt_hex = parts.next().unwrap_or("");
    let expected = parts.next().unwrap_or("");
    let salt = match hex::decode(salt_hex) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let key = derive_key(password, &salt);
    hex::encode(key.0) == expected
}

/// True if an administrator password has been configured. Requires the DB
/// to be unlocked (the admin hash lives in the encrypted app_config table,
/// so it is shared across all PCs using the same data folder).
#[tauri::command]
pub fn is_admin_set(state: State<'_, AppState>) -> AppResult<bool> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let n: i64 = conn.query_row(
                "SELECT COUNT(*) FROM app_config WHERE key = 'admin_password'",
                [],
                |r| r.get(0),
            )?;
            Ok(n > 0)
        }
    }
}

/// Sets (first time) or changes the administrator password. When one already
/// exists, `current` must match it. Only the administrator should know this.
#[tauri::command]
pub fn set_admin_password(
    current: Option<String>,
    new_password: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    if new_password.len() < 6 {
        return Err(AppError::Other(
            "管理者パスワードは6文字以上にしてください".into(),
        ));
    }
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let existing: Option<String> = conn
                .query_row(
                    "SELECT value FROM app_config WHERE key = 'admin_password'",
                    [],
                    |r| r.get(0),
                )
                .optional()?;
            if let Some(stored) = existing {
                let cur = current
                    .ok_or_else(|| AppError::Other("現在の管理者パスワードを入力してください".into()))?;
                if !verify_admin_hash(&stored, &cur) {
                    return Err(AppError::Other("現在の管理者パスワードが違います".into()));
                }
            }
            let salt = generate_salt();
            let key = derive_key(&new_password, &salt);
            let value = format!("{}:{}", hex::encode(salt), hex::encode(key.0));
            let first = existing.is_none();
            conn.execute(
                "INSERT INTO app_config (key, value) VALUES ('admin_password', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = ?1",
                rusqlite::params![value],
            )?;
            let op = crate::commands::audit::operator_of(&state.operator);
            crate::commands::audit::write(
                conn,
                &op,
                if first { "管理者パスワード設定" } else { "管理者パスワード変更" },
                "",
            );
            Ok(())
        }
    }
}

/// Changes the shared unlock password. Requires the administrator password.
/// Re-encrypts (rekeys) the live database with a key derived from the new
/// password (same salt); the session stays unlocked and data is preserved.
#[tauri::command]
pub fn change_password(
    new_password: String,
    admin_password: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    if !state.paths.salt_path.exists() {
        return Err(AppError::NotConfigured);
    }
    if new_password.len() < 8 {
        return Err(AppError::Other("パスワードは8文字以上にしてください".into()));
    }

    let salt_hex = fs::read_to_string(&state.paths.salt_path)?;
    let salt = hex::decode(salt_hex.trim())?;
    let new_key = derive_key(&new_password, &salt);
    let new_hex = hex::encode(new_key.0);

    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &mut *guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, key } => {
            // Only the administrator may change the shared password.
            let stored: Option<String> = conn
                .query_row(
                    "SELECT value FROM app_config WHERE key = 'admin_password'",
                    [],
                    |r| r.get(0),
                )
                .optional()?;
            let stored = stored.ok_or_else(|| {
                AppError::Other("管理者パスワードが未設定です。先に管理者パスワードを設定してください。".into())
            })?;
            if !verify_admin_hash(&stored, &admin_password) {
                return Err(AppError::Other("管理者パスワードが違います".into()));
            }

            // Re-encrypt the live database with the new key (same salt).
            conn.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", new_hex))?;
            *key = new_key;
            let op = crate::commands::audit::operator_of(&state.operator);
            crate::commands::audit::write(conn, &op, "解除パスワード変更", "");
            Ok(())
        }
    }
}
