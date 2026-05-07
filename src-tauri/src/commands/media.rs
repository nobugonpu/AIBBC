use crate::crypto::file_enc::{decrypt_file, encrypt_file};
use crate::error::{AppError, AppResult};
use crate::state::{AppState, DbState};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::State;
use uuid::Uuid;

/// Decrypts a media file and saves it to a user-chosen location via a native
/// save dialog. Returns the filename on success, None if the user cancelled.
#[tauri::command]
pub fn export_media(id: String, state: State<'_, AppState>) -> AppResult<Option<String>> {
    eprintln!("[export_media] called with id={}", id);

    // Phase 1: look up and decrypt (hold mutex only for this block)
    let (decrypted, export_filename) = {
        let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
        match &*guard {
            DbState::Locked => {
                eprintln!("[export_media] error: session is locked");
                return Err(AppError::Locked);
            }
            DbState::Unlocked { conn, key } => {
                let rel_path: String = conn
                    .query_row(
                        "SELECT file_path FROM media WHERE id = ?1",
                        rusqlite::params![id],
                        |row| row.get(0),
                    )
                    .map_err(|e| {
                        eprintln!("[export_media] DB lookup failed: {}", e);
                        AppError::Other("メディアが見つかりません".into())
                    })?;

                eprintln!("[export_media] resolved rel_path={}", rel_path);

                let abs = state.paths.media_dir.join(&rel_path);
                let encrypted = fs::read(&abs)?;
                let plain = decrypt_file(&encrypted, key)?;

                // "photos/uuid.jpg.enc" -> "uuid.jpg"
                let filename = rel_path
                    .split('/')
                    .last()
                    .unwrap_or("export")
                    .trim_end_matches(".enc")
                    .to_string();

                (plain, filename)
            }
        }
    }; // mutex released before opening the dialog

    eprintln!(
        "[export_media] decrypted {} bytes, opening dialog with filename={}",
        decrypted.len(),
        export_filename
    );

    // Phase 2: native save dialog — runs synchronously on a thread-pool thread
    let save_path = rfd::FileDialog::new()
        .set_title("エクスポート先を選択")
        .set_file_name(&export_filename)
        .save_file();

    match save_path {
        Some(path) => {
            eprintln!("[export_media] writing to {:?}", path);
            fs::write(&path, &decrypted)?;
            eprintln!("[export_media] write OK");
            Ok(Some(export_filename))
        }
        None => {
            eprintln!("[export_media] user cancelled");
            Ok(None)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaItem {
    pub id: String,
    pub media_type: String,
    pub file_path: String,
    pub description: String,
    pub ai_description: String,
    pub created_at: String,
}

/// Saves encrypted media to disk and records metadata in the DB.
/// `file_bytes` arrives from JS as a base64 string (data URL or raw).
#[tauri::command]
pub fn save_media(
    media_type: String,
    file_bytes_b64: String,
    description: String,
    file_ext: String,
    state: State<'_, AppState>,
) -> AppResult<MediaItem> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, key } => {
            // Decode base64 input (may include "data:...;base64," prefix)
            let b64_data = if let Some(pos) = file_bytes_b64.find(",") {
                &file_bytes_b64[pos + 1..]
            } else {
                &file_bytes_b64
            };
            let raw = base64_decode(b64_data)?;

            let file_id = Uuid::new_v4().to_string();
            let clean_ext = file_ext.trim_matches('.').to_lowercase();
            let rel_path = if clean_ext.is_empty() {
                format!("{}.enc", file_id)
            } else {
                format!("{}.{}.enc", file_id, clean_ext)
            };

            // Ensure media sub-dir exists
            let media_subdir = if media_type == "video" { "videos" } else { "photos" };
            let abs_dir = state.paths.media_dir.join(media_subdir);
            fs::create_dir_all(&abs_dir)?;
            let abs_path = abs_dir.join(&rel_path);
            let stored_rel = format!("{}/{}", media_subdir, rel_path);

            let encrypted = encrypt_file(&raw, key)?;
            fs::write(&abs_path, &encrypted)?;

            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO media (id, media_type, file_path, description, ai_description)
                 VALUES (?1, ?2, ?3, ?4, '')",
                rusqlite::params![id, media_type, stored_rel, description],
            )?;

            Ok(MediaItem {
                id,
                media_type,
                file_path: stored_rel,
                description,
                ai_description: String::new(),
                created_at: String::new(),
            })
        }
    }
}

/// Returns all media records from the DB (metadata only, not file bytes).
#[tauri::command]
pub fn get_media(state: State<'_, AppState>) -> AppResult<Vec<MediaItem>> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let mut stmt = conn.prepare(
                "SELECT id, media_type, file_path, description, ai_description, created_at
                 FROM media ORDER BY created_at DESC",
            )?;
            let items = stmt
                .query_map([], |row| {
                    Ok(MediaItem {
                        id: row.get(0)?,
                        media_type: row.get(1)?,
                        file_path: row.get(2)?,
                        description: row.get(3)?,
                        ai_description: row.get(4)?,
                        created_at: row.get(5)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(items)
        }
    }
}

/// Decrypts and returns a media file as base64, so JS can display it without
/// exposing the raw file path to the web view.
#[tauri::command]
pub fn read_media_file(file_path: String, state: State<'_, AppState>) -> AppResult<String> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { key, .. } => {
            let abs_path = state.paths.media_dir.join(&file_path);
            let encrypted = fs::read(&abs_path)?;
            let plain = decrypt_file(&encrypted, key)?;
            Ok(base64_encode(&plain))
        }
    }
}

/// Deletes the encrypted file from disk and removes the DB record.
#[tauri::command]
pub fn delete_media(id: String, state: State<'_, AppState>) -> AppResult<()> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let file_path: Option<String> = conn
                .query_row(
                    "SELECT file_path FROM media WHERE id = ?1",
                    rusqlite::params![id],
                    |row| row.get(0),
                )
                .ok();

            conn.execute("DELETE FROM media WHERE id = ?1", rusqlite::params![id])?;

            if let Some(rel) = file_path {
                let _ = fs::remove_file(state.paths.media_dir.join(rel));
            }
            Ok(())
        }
    }
}

// Minimal base64 helpers using the standard alphabet (no external crate needed).
fn base64_decode(s: &str) -> AppResult<Vec<u8>> {
    use std::io::Read;
    // Use a simple manual decoder to avoid adding a dep. We include the
    // alphabet inline. For production, prefer the `base64` crate.
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut decode_table = [255u8; 256];
    for (i, &c) in alphabet.iter().enumerate() {
        decode_table[c as usize] = i as u8;
    }

    let clean: Vec<u8> = s.bytes().filter(|&b| b != b'=' && b != b'\n' && b != b'\r').collect();
    let mut out = Vec::with_capacity(clean.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u32;
    for byte in clean {
        let val = decode_table[byte as usize];
        if val == 255 {
            return Err(AppError::Other("invalid base64".into()));
        }
        buf = (buf << 6) | val as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8 & 0xFF);
        }
    }
    let _ = Read::by_ref(&mut out.as_slice()); // suppress unused warning
    Ok(out)
}

fn base64_encode(data: &[u8]) -> String {
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(alphabet[((n >> 18) & 0x3F) as usize] as char);
        out.push(alphabet[((n >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(alphabet[((n >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(alphabet[(n & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}
