//! Per-user account store with envelope encryption.
//!
//! The database is encrypted with a single random Data Encryption Key (DEK).
//! That DEK is never stored in the clear: for each user it is "wrapped"
//! (AES-256-GCM encrypted) with a key derived from that user's own password.
//! Logging in therefore means: derive the user's key from their password,
//! use it to unwrap the shared DEK, then open the database with the DEK.
//!
//! This replaces the previous single shared password: every user has their own
//! credentials, yet everyone opens the same shared, encrypted data.

use crate::crypto::file_enc::{decrypt_file, encrypt_file};
use crate::crypto::key::{derive_key, generate_salt, DerivedKey, KEY_LEN};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// One user account. `wrapped_dek_hex` is the shared DEK encrypted with the
/// key derived from this user's password (`[12-byte nonce][ciphertext+tag]`).
#[derive(Serialize, Deserialize, Clone)]
pub struct UserRecord {
    pub username: String,
    pub salt_hex: String,
    pub wrapped_dek_hex: String,
    pub role: String, // "admin" or "user"
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Default)]
pub struct UserStore {
    pub version: u32,
    pub users: Vec<UserRecord>,
}

impl UserStore {
    pub fn load(path: &Path) -> AppResult<UserStore> {
        let text = std::fs::read_to_string(path)?;
        serde_json::from_str(&text)
            .map_err(|e| AppError::Other(format!("利用者情報の読み込みに失敗しました: {e}")))
    }

    pub fn save(&self, path: &Path) -> AppResult<()> {
        let text = serde_json::to_string_pretty(self)
            .map_err(|e| AppError::Other(format!("利用者情報の保存に失敗しました: {e}")))?;
        std::fs::write(path, text)?;
        Ok(())
    }

    pub fn find(&self, username: &str) -> Option<&UserRecord> {
        self.users.iter().find(|u| u.username == username)
    }

    pub fn admin_count(&self) -> usize {
        self.users.iter().filter(|u| u.role == "admin").count()
    }
}

/// Wraps `dek` with a key derived from `password`, producing a new user record.
pub fn make_user(
    username: &str,
    password: &str,
    role: &str,
    dek: &DerivedKey,
) -> AppResult<UserRecord> {
    let salt = generate_salt();
    let kek = derive_key(password, &salt);
    let wrapped = encrypt_file(&dek.0, &kek)?;
    Ok(UserRecord {
        username: username.to_string(),
        salt_hex: hex::encode(salt),
        wrapped_dek_hex: hex::encode(wrapped),
        role: role.to_string(),
        created_at: chrono::Local::now()
            .format("%Y-%m-%d %H:%M:%S")
            .to_string(),
    })
}

/// Verifies `password` against `rec` and returns the unwrapped shared DEK.
/// Returns `AppError::InvalidPassword` when the password is wrong (GCM auth
/// failure), so the caller cannot distinguish "wrong password" from "no such
/// user" if it maps both to the same error.
pub fn unwrap_dek(rec: &UserRecord, password: &str) -> AppResult<DerivedKey> {
    let salt = hex::decode(&rec.salt_hex)
        .map_err(|_| AppError::Other("利用者情報が壊れています（salt）".into()))?;
    let kek = derive_key(password, &salt);
    let wrapped = hex::decode(&rec.wrapped_dek_hex)
        .map_err(|_| AppError::Other("利用者情報が壊れています（鍵）".into()))?;
    let dek_bytes = decrypt_file(&wrapped, &kek)?; // InvalidPassword on wrong password
    if dek_bytes.len() != KEY_LEN {
        return Err(AppError::Other("鍵の長さが不正です".into()));
    }
    let mut arr = [0u8; KEY_LEN];
    arr.copy_from_slice(&dek_bytes);
    Ok(DerivedKey(arr))
}
