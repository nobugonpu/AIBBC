use crate::crypto::key::{derive_key, generate_dek, DerivedKey};
use crate::db::{open_encrypted, schema::run_migrations};
use crate::error::{AppError, AppResult};
use crate::state::{AppState, DbState};
use crate::users::{make_user, unwrap_dek, UserStore};
use serde::Serialize;
use std::fs;
use tauri::State;

const MIN_PASSWORD_LEN: usize = 8;

/// True once at least one account exists (i.e. first-time setup is done).
#[tauri::command]
pub fn is_setup(state: State<'_, AppState>) -> bool {
    state.paths.users_path.exists()
}

/// True if the DB is currently open (a user is logged in).
#[tauri::command]
pub fn is_unlocked(state: State<'_, AppState>) -> AppResult<bool> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    Ok(guard.is_unlocked())
}

/// True when an older single-shared-password install exists but no per-user
/// accounts have been created yet — the one-time migration path applies.
#[tauri::command]
pub fn needs_migration(state: State<'_, AppState>) -> bool {
    !state.paths.users_path.exists()
        && state.paths.salt_path.exists()
        && state.paths.db_path.exists()
}

#[derive(Serialize)]
pub struct SessionInfo {
    pub username: String,
    pub role: String,
}

#[derive(Serialize)]
pub struct UserInfo {
    pub username: String,
    pub role: String,
    pub created_at: String,
}

fn validate_new_credentials(username: &str, password: &str) -> AppResult<()> {
    if username.trim().is_empty() {
        return Err(AppError::Other("利用者名を入力してください".into()));
    }
    if password.len() < MIN_PASSWORD_LEN {
        return Err(AppError::Other(
            "パスワードは8文字以上にしてください".into(),
        ));
    }
    Ok(())
}

/// Opens the DB with the given DEK, runs migrations, and marks the session
/// unlocked for `username`/`role`. Writes a login audit entry.
fn open_session(
    state: &State<'_, AppState>,
    dek: DerivedKey,
    username: &str,
    role: &str,
    action: &str,
) -> AppResult<()> {
    let conn = open_encrypted(&state.paths.db_path, &dek)?;
    run_migrations(&conn)?;

    let mut guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    *guard = DbState::Unlocked { conn, key: dek };
    if let DbState::Unlocked { conn, .. } = &*guard {
        crate::commands::audit::write(conn, username, action, "");
    }
    drop(guard);

    if let Ok(mut o) = state.operator.lock() {
        *o = username.to_string();
    }
    if let Ok(mut r) = state.role.lock() {
        *r = role.to_string();
    }
    Ok(())
}

/// First-time setup: creates the initial administrator account, generates the
/// shared DEK, and initializes the encrypted database.
#[tauri::command]
pub fn setup_first_user(
    username: String,
    password: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    if state.paths.users_path.exists() {
        return Err(AppError::AlreadyConfigured);
    }
    validate_new_credentials(&username, &password)?;

    fs::create_dir_all(&state.paths.data_dir)?;
    fs::create_dir_all(&state.paths.media_dir)?;

    // The single key that actually encrypts the database.
    let dek = generate_dek();
    let admin = make_user(username.trim(), &password, "admin", &dek)?;
    let store = UserStore {
        version: 1,
        users: vec![admin],
    };
    store.save(&state.paths.users_path)?;

    open_session(&state, dek, username.trim(), "admin", "初回セットアップ")
}

/// Logs in with an individual account: unwraps the shared DEK with the user's
/// password and opens the database.
#[tauri::command]
pub fn login(username: String, password: String, state: State<'_, AppState>) -> AppResult<()> {
    if !state.paths.users_path.exists() {
        return Err(AppError::NotConfigured);
    }
    let store = UserStore::load(&state.paths.users_path)?;
    let rec = store
        .find(username.trim())
        .ok_or(AppError::InvalidPassword)?; // don't reveal which part is wrong
    let role = rec.role.clone();
    let dek = unwrap_dek(rec, &password)?; // InvalidPassword on wrong password
    open_session(&state, dek, username.trim(), &role, "ログイン")
}

/// One-time migration from the old single-shared-password scheme. Verifies the
/// old shared password can open the DB, then creates the first admin account
/// that wraps the *same* key (so no data re-encryption is needed).
#[tauri::command]
pub fn migrate_from_shared(
    shared_password: String,
    admin_username: String,
    admin_password: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    if state.paths.users_path.exists() {
        return Err(AppError::AlreadyConfigured);
    }
    if !state.paths.salt_path.exists() {
        return Err(AppError::NotConfigured);
    }
    validate_new_credentials(&admin_username, &admin_password)?;

    // Re-derive the existing key from the old shared password.
    let salt_hex = fs::read_to_string(&state.paths.salt_path)?;
    let salt = hex::decode(salt_hex.trim())?;
    let dek = derive_key(&shared_password, &salt);

    // Verify the password actually opens the DB (a query fails on wrong key).
    let conn = open_encrypted(&state.paths.db_path, &dek)?;
    run_migrations(&conn).map_err(|_| AppError::InvalidPassword)?;
    drop(conn);

    let admin = make_user(admin_username.trim(), &admin_password, "admin", &dek)?;
    let store = UserStore {
        version: 1,
        users: vec![admin],
    };
    store.save(&state.paths.users_path)?;

    open_session(
        &state,
        dek,
        admin_username.trim(),
        "admin",
        "共有パスワードから移行",
    )
}

/// Locks the session: closes the DB and clears the in-memory key and identity.
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
    if let Ok(mut r) = state.role.lock() {
        r.clear();
    }
    Ok(())
}

/// Returns the current session's username and role.
#[tauri::command]
pub fn whoami(state: State<'_, AppState>) -> AppResult<SessionInfo> {
    let username = crate::commands::audit::operator_of(&state.operator);
    let role = state
        .role
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default();
    Ok(SessionInfo { username, role })
}

fn require_admin(state: &State<'_, AppState>) -> AppResult<()> {
    let role = state
        .role
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default();
    if role != "admin" {
        return Err(AppError::Other(
            "この操作は管理者のみ実行できます".into(),
        ));
    }
    Ok(())
}

/// Lists all accounts (names/roles only — no secrets). Requires an open session.
#[tauri::command]
pub fn list_users(state: State<'_, AppState>) -> AppResult<Vec<UserInfo>> {
    {
        let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
        if !guard.is_unlocked() {
            return Err(AppError::Locked);
        }
    }
    let store = UserStore::load(&state.paths.users_path)?;
    Ok(store
        .users
        .into_iter()
        .map(|u| UserInfo {
            username: u.username,
            role: u.role,
            created_at: u.created_at,
        })
        .collect())
}

/// Adds a new account (admin only). The new user's password wraps the same
/// shared DEK, so they open the same data.
#[tauri::command]
pub fn add_user(
    username: String,
    password: String,
    role: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    require_admin(&state)?;
    validate_new_credentials(&username, &password)?;
    let role = if role == "admin" { "admin" } else { "user" };

    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, key } => {
            let mut store = UserStore::load(&state.paths.users_path)?;
            if store.find(username.trim()).is_some() {
                return Err(AppError::Other(
                    "同じ利用者名が既に存在します".into(),
                ));
            }
            let rec = make_user(username.trim(), &password, role, key)?;
            store.users.push(rec);
            store.save(&state.paths.users_path)?;
            let op = crate::commands::audit::operator_of(&state.operator);
            crate::commands::audit::write(
                conn,
                &op,
                "利用者追加",
                &format!("{}（{}）", username.trim(), role),
            );
            Ok(())
        }
    }
}

/// Removes an account (admin only). Cannot remove the last administrator.
#[tauri::command]
pub fn delete_user(username: String, state: State<'_, AppState>) -> AppResult<()> {
    require_admin(&state)?;
    let target = username.trim().to_string();

    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let mut store = UserStore::load(&state.paths.users_path)?;
            let rec = store
                .find(&target)
                .ok_or_else(|| AppError::Other("その利用者は存在しません".into()))?
                .clone();
            if rec.role == "admin" && store.admin_count() <= 1 {
                return Err(AppError::Other(
                    "最後の管理者は削除できません".into(),
                ));
            }
            store.users.retain(|u| u.username != target);
            store.save(&state.paths.users_path)?;
            let op = crate::commands::audit::operator_of(&state.operator);
            crate::commands::audit::write(conn, &op, "利用者削除", &target);
            Ok(())
        }
    }
}

/// Changes the logged-in user's own password. Re-wraps the shared DEK with a
/// key derived from the new password.
#[tauri::command]
pub fn change_my_password(
    current_password: String,
    new_password: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let me = crate::commands::audit::operator_of(&state.operator);
    if me.is_empty() {
        return Err(AppError::Locked);
    }
    if new_password.len() < MIN_PASSWORD_LEN {
        return Err(AppError::Other(
            "パスワードは8文字以上にしてください".into(),
        ));
    }

    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let mut store = UserStore::load(&state.paths.users_path)?;
            let rec = store
                .find(&me)
                .ok_or_else(|| AppError::Other("利用者が見つかりません".into()))?
                .clone();
            // Verify current password (and recover the DEK) before re-wrapping.
            let dek = unwrap_dek(&rec, &current_password)?;
            let updated = make_user(&me, &new_password, &rec.role, &dek)?;
            for u in store.users.iter_mut() {
                if u.username == me {
                    *u = updated.clone();
                }
            }
            store.save(&state.paths.users_path)?;
            crate::commands::audit::write(conn, &me, "パスワード変更", "");
            Ok(())
        }
    }
}
