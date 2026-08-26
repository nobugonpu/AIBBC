use crate::error::{AppError, AppResult};
use crate::state::{AppState, DbState};
use chrono::Local;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

/// Writes one audit-log row. Best-effort: a logging failure never breaks the
/// calling command.
pub fn write(conn: &Connection, operator: &str, action: &str, detail: &str) {
    let at = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let _ = conn.execute(
        "INSERT INTO audit_log (at, operator, action, detail) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![at, operator, action, detail],
    );
}

/// Current session's operator name (empty if none).
pub fn operator_of(m: &Mutex<String>) -> String {
    m.lock().map(|g| g.clone()).unwrap_or_default()
}

#[derive(Serialize)]
pub struct AuditEntry {
    pub id: i64,
    pub at: String,
    pub operator: String,
    pub action: String,
    pub detail: String,
}

/// Returns the most recent audit-log entries (newest first).
#[tauri::command]
pub fn get_audit_log(limit: i64, state: State<'_, AppState>) -> AppResult<Vec<AuditEntry>> {
    let lim = if limit <= 0 || limit > 5000 { 500 } else { limit };
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let mut stmt = conn.prepare(
                "SELECT id, at, operator, action, detail FROM audit_log ORDER BY id DESC LIMIT ?1",
            )?;
            let rows = stmt
                .query_map([lim], |r| {
                    Ok(AuditEntry {
                        id: r.get(0)?,
                        at: r.get(1)?,
                        operator: r.get(2)?,
                        action: r.get(3)?,
                        detail: r.get(4)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        }
    }
}

/// Exports the full audit log to a CSV file via a native save dialog.
/// Returns the saved path, or None if cancelled.
#[tauri::command]
pub fn export_audit_csv(state: State<'_, AppState>) -> AppResult<Option<String>> {
    let csv = {
        let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
        match &*guard {
            DbState::Locked => return Err(AppError::Locked),
            DbState::Unlocked { conn, .. } => {
                let mut stmt = conn
                    .prepare("SELECT at, operator, action, detail FROM audit_log ORDER BY id ASC")?;
                let mut out = String::from("日時,利用者,操作,詳細\n");
                let rows = stmt.query_map([], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, String>(3)?,
                    ))
                })?;
                for row in rows {
                    let (at, op, act, det) = row?;
                    out.push_str(&format!(
                        "{},{},{},{}\n",
                        csv_field(&at),
                        csv_field(&op),
                        csv_field(&act),
                        csv_field(&det)
                    ));
                }
                out
            }
        }
    };

    // UTF-8 BOM so Excel opens Japanese text correctly.
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(csv.as_bytes());

    match rfd::FileDialog::new()
        .set_title("操作履歴をCSVで保存")
        .set_file_name("操作履歴.csv")
        .save_file()
    {
        Some(p) => {
            std::fs::write(&p, &bytes)?;
            Ok(Some(p.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

fn csv_field(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
