use crate::error::{AppError, AppResult};
use crate::state::{AppState, DbState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSchedule {
    pub id: String,
    pub schedule_name: String,
    pub total_days_available: i64,
    pub period_days: i64,
    pub lu_psma_count: i64,
    pub lutetium_count: i64,
    pub total_days_used: i64,
    /// Stored as JSON TEXT; deserialized to array so JS receives TreatmentEvent[].
    pub schedule_data: serde_json::Value,
    pub created_at: String,
}

#[tauri::command]
pub fn get_schedules(state: State<'_, AppState>) -> AppResult<Vec<SavedSchedule>> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let mut stmt = conn.prepare(
                "SELECT id, schedule_name, total_days_available, period_days,
                        lu_psma_count, lutetium_count, total_days_used,
                        schedule_data, created_at
                 FROM treatment_schedules ORDER BY created_at DESC",
            )?;
            let schedules = stmt
                .query_map([], |row| {
                    let data_str: String = row.get(7)?;
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                        data_str,
                        row.get::<_, String>(8)?,
                    ))
                })?
                .collect::<Result<Vec<_>, _>>()?
                .into_iter()
                .map(|(id, name, total, period, lu, lut, used, data_str, created)| {
                    let schedule_data =
                        serde_json::from_str(&data_str).unwrap_or(serde_json::Value::Array(vec![]));
                    SavedSchedule {
                        id,
                        schedule_name: name,
                        total_days_available: total,
                        period_days: period,
                        lu_psma_count: lu,
                        lutetium_count: lut,
                        total_days_used: used,
                        schedule_data,
                        created_at: created,
                    }
                })
                .collect();
            Ok(schedules)
        }
    }
}

#[tauri::command]
pub fn save_schedule(
    schedule_name: String,
    total_days_available: i64,
    period_days: i64,
    lu_psma_count: i64,
    lutetium_count: i64,
    total_days_used: i64,
    schedule_data: serde_json::Value,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            let id = Uuid::new_v4().to_string();
            let data_str = serde_json::to_string(&schedule_data)
                .map_err(|e| AppError::Other(e.to_string()))?;
            conn.execute(
                "INSERT INTO treatment_schedules
                 (id, schedule_name, total_days_available, period_days,
                  lu_psma_count, lutetium_count, total_days_used, schedule_data)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    id,
                    schedule_name,
                    total_days_available,
                    period_days,
                    lu_psma_count,
                    lutetium_count,
                    total_days_used,
                    data_str
                ],
            )?;
            Ok(())
        }
    }
}

#[tauri::command]
pub fn delete_schedule(id: String, state: State<'_, AppState>) -> AppResult<()> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked { conn, .. } => {
            conn.execute(
                "DELETE FROM treatment_schedules WHERE id = ?1",
                rusqlite::params![id],
            )?;
            Ok(())
        }
    }
}
