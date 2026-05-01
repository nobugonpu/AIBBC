use rusqlite::Connection;

pub const CURRENT_SCHEMA_VERSION: i64 = 1;

const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id               TEXT PRIMARY KEY,
  patient_name     TEXT NOT NULL,
  treatment_type   TEXT NOT NULL CHECK(treatment_type IN ('lu-psma','lutetium')),
  start_date       TEXT NOT NULL,
  cycles_planned   INTEGER NOT NULL,
  cycles_completed INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS treatment_cycles (
  id              TEXT PRIMARY KEY,
  patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  cycle_number    INTEGER NOT NULL,
  scheduled_date  TEXT NOT NULL,
  admission_date  TEXT NOT NULL,
  discharge_date  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK(status IN ('scheduled','completed','cancelled')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS treatment_schedules (
  id                   TEXT PRIMARY KEY,
  schedule_name        TEXT NOT NULL,
  total_days_available INTEGER NOT NULL,
  period_days          INTEGER NOT NULL,
  lu_psma_count        INTEGER NOT NULL,
  lutetium_count       INTEGER NOT NULL,
  total_days_used      INTEGER NOT NULL,
  schedule_data        TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS media (
  id             TEXT PRIMARY KEY,
  media_type     TEXT NOT NULL CHECK(media_type IN ('photo','video')),
  file_path      TEXT NOT NULL,
  file_hash      TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  ai_description TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_cycles_patient ON treatment_cycles(patient_id);
CREATE INDEX IF NOT EXISTS idx_media_type     ON media(media_type);
"#;

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch(SCHEMA_V1)?;
    conn.execute(
        "INSERT INTO app_config (key, value) VALUES ('schema_version', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [CURRENT_SCHEMA_VERSION.to_string()],
    )?;
    Ok(())
}
