use crate::error::{AppError, AppResult};
use crate::state::{AppState, DbState};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Patient {
    pub id: String,
    pub patient_name: String,
    pub treatment_type: String,
    pub start_date: String,
    pub cycles_planned: i64,
    pub cycles_completed: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Cycle {
    pub id: String,
    pub patient_id: String,
    pub cycle_number: i64,
    pub scheduled_date: String,
    pub admission_date: String,
    pub discharge_date: String,
    pub status: String,
    pub created_at: String,
}

/// Received from JS as camelCase; rename_all maps to Rust snake_case fields.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCycle {
    pub cycle_number: i64,
    pub scheduled_date: String,
    pub admission_date: String,
    pub discharge_date: String,
}

#[tauri::command]
pub fn get_patients(state: State<'_, AppState>) -> AppResult<Vec<Patient>> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked(conn) => {
            let mut stmt = conn.prepare(
                "SELECT id, patient_name, treatment_type, start_date, cycles_planned,
                        cycles_completed, created_at
                 FROM patients ORDER BY start_date DESC",
            )?;
            let patients = stmt
                .query_map([], |row| {
                    Ok(Patient {
                        id: row.get(0)?,
                        patient_name: row.get(1)?,
                        treatment_type: row.get(2)?,
                        start_date: row.get(3)?,
                        cycles_planned: row.get(4)?,
                        cycles_completed: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(patients)
        }
    }
}

#[tauri::command]
pub fn get_cycles(state: State<'_, AppState>) -> AppResult<Vec<Cycle>> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked(conn) => {
            let mut stmt = conn.prepare(
                "SELECT id, patient_id, cycle_number, scheduled_date, admission_date,
                        discharge_date, status, created_at
                 FROM treatment_cycles ORDER BY scheduled_date ASC",
            )?;
            let cycles = stmt
                .query_map([], |row| {
                    Ok(Cycle {
                        id: row.get(0)?,
                        patient_id: row.get(1)?,
                        cycle_number: row.get(2)?,
                        scheduled_date: row.get(3)?,
                        admission_date: row.get(4)?,
                        discharge_date: row.get(5)?,
                        status: row.get(6)?,
                        created_at: row.get(7)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(cycles)
        }
    }
}

/// Inserts a patient and all pre-calculated cycles in a single transaction.
/// Cycle scheduling logic lives in React (TypeScript); Rust only persists.
#[tauri::command]
pub fn add_patient(
    patient_name: String,
    treatment_type: String,
    start_date: String,
    cycles_planned: i64,
    cycles: Vec<NewCycle>,
    state: State<'_, AppState>,
) -> AppResult<Patient> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked(conn) => {
            let patient_id = Uuid::new_v4().to_string();

            conn.execute_batch("BEGIN EXCLUSIVE;")?;

            let result: Result<Patient, AppError> = (|| {
                conn.execute(
                    "INSERT INTO patients
                     (id, patient_name, treatment_type, start_date, cycles_planned, cycles_completed)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0)",
                    rusqlite::params![
                        patient_id,
                        patient_name,
                        treatment_type,
                        start_date,
                        cycles_planned
                    ],
                )?;

                for cycle in &cycles {
                    conn.execute(
                        "INSERT INTO treatment_cycles
                         (id, patient_id, cycle_number, scheduled_date,
                          admission_date, discharge_date, status)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'scheduled')",
                        rusqlite::params![
                            Uuid::new_v4().to_string(),
                            patient_id,
                            cycle.cycle_number,
                            cycle.scheduled_date,
                            cycle.admission_date,
                            cycle.discharge_date
                        ],
                    )?;
                }

                let patient = conn.query_row(
                    "SELECT id, patient_name, treatment_type, start_date, cycles_planned,
                            cycles_completed, created_at
                     FROM patients WHERE id = ?1",
                    rusqlite::params![patient_id],
                    |row| {
                        Ok(Patient {
                            id: row.get(0)?,
                            patient_name: row.get(1)?,
                            treatment_type: row.get(2)?,
                            start_date: row.get(3)?,
                            cycles_planned: row.get(4)?,
                            cycles_completed: row.get(5)?,
                            created_at: row.get(6)?,
                        })
                    },
                )?;
                Ok(patient)
            })();

            match result {
                Ok(patient) => {
                    conn.execute_batch("COMMIT;")?;
                    Ok(patient)
                }
                Err(e) => {
                    let _ = conn.execute_batch("ROLLBACK;");
                    Err(e)
                }
            }
        }
    }
}

/// Deletes a patient by id. Cycles are removed via ON DELETE CASCADE.
#[tauri::command]
pub fn delete_patient(id: String, state: State<'_, AppState>) -> AppResult<()> {
    let guard = state.db.lock().map_err(|_| AppError::LockPoisoned)?;
    match &*guard {
        DbState::Locked => Err(AppError::Locked),
        DbState::Unlocked(conn) => {
            conn.execute(
                "DELETE FROM patients WHERE id = ?1",
                rusqlite::params![id],
            )?;
            Ok(())
        }
    }
}
