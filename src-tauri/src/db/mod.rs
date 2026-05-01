pub mod schema;

use crate::crypto::key::DerivedKey;
use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use std::path::Path;

pub fn open_encrypted(db_path: &Path, key: &DerivedKey) -> AppResult<Connection> {
    let conn = Connection::open(db_path)?;

    let hex_key = hex::encode(key.0);
    conn.pragma_update(None, "key", format!("x'{}'", hex_key))?;

    match conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| {
        let _: i64 = row.get(0)?;
        Ok(())
    }) {
        Ok(()) => Ok(conn),
        Err(rusqlite::Error::SqliteFailure(_, _)) => Err(AppError::InvalidPassword),
        Err(e) => Err(AppError::Db(e)),
    }
}
