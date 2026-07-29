use crate::crypto::key::{derive_key, generate_salt};
use crate::db::{open_encrypted, schema::run_migrations};
use crate::error::{AppError, AppResult};
use crate::state::{AppState, DbState};
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
pub fn setup_password(password: String, state: State<'_, AppState>) -> AppResult<()> {
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

    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    *guard = DbState::Unlocked { conn, key };
    Ok(())
}

/// Reads the stored salt, re-derives the key from the given password,
/// and opens the encrypted DB. Returns InvalidPassword on wrong password.
#[tauri::command]
pub fn unlock(password: String, state: State<'_, AppState>) -> AppResult<()> {
    if !state.paths.salt_path.exists() {
        return Err(AppError::NotConfigured);
    }

    let salt_hex = fs::read_to_string(&state.paths.salt_path)?;
    let salt = hex::decode(salt_hex.trim())?;

    let key = derive_key(&password, &salt);
    let conn = open_encrypted(&state.paths.db_path, &key)?;

    // run_migrations is idempotent — ensures schema is up-to-date after updates.
    run_migrations(&conn)?;

    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    *guard = DbState::Unlocked { conn, key };
    Ok(())
}

/// Closes the DB connection and drops the in-memory session.
/// The derived key is never stored, so lock means the data is inaccessible
/// until the user re-enters their password.
#[tauri::command]
pub fn lock(state: State<'_, AppState>) -> AppResult<()> {
    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    *guard = DbState::Locked;
    Ok(())
}

/// Changes the password: verifies the current password, then re-encrypts
/// (rekeys) the existing database in place with a key derived from the new
/// password. The salt is reused. The live session is updated to the new key,
/// so the user stays unlocked. Existing data is preserved.
#[tauri::command]
pub fn change_password(
    current_password: String,
    new_password: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    if !state.paths.salt_path.exists() {
        return Err(AppError::NotConfigured);
    }
    if new_password.len() < 8 {
        return Err(AppError::Other(
            "パスワードは8文字以上にしてください".into(),
        ));
    }

    let salt_hex = fs::read_to_string(&state.paths.salt_path)?;
    let salt = hex::decode(salt_hex.trim())?;

    // Verify the current password by opening the DB with its derived key.
    // open_encrypted returns InvalidPassword if the key is wrong.
    let old_key = derive_key(&current_password, &salt);
    let conn = open_encrypted(&state.paths.db_path, &old_key)?;

    // Re-encrypt the whole database with the new key (same salt).
    let new_key = derive_key(&new_password, &salt);
    let new_hex = hex::encode(new_key.0);
    let rekey = format!("PRAGMA rekey = \"x'{}'\";", new_hex);
    conn.execute_batch(&rekey)?;

    // Swap the live session to the rekeyed connection and new key.
    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    *guard = DbState::Unlocked { conn, key: new_key };
    Ok(())
}
