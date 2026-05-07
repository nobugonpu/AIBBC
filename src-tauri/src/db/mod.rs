pub mod schema;

use crate::crypto::key::DerivedKey;
use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use std::path::Path;

pub fn open_encrypted(db_path: &Path, key: &DerivedKey) -> AppResult<Connection> {
    let conn = Connection::open(db_path)?;

    // SQLCipher needs the raw blob literal syntax (PRAGMA key = "x'...'"),
    // not a string-quoted value. pragma_update would wrap the value in
    // single quotes and break it, so use execute_batch with formatted SQL.
    // hex_key is 64 chars of lowercase hex, no injection risk.
    let hex_key = hex::encode(key.0);
    let pragma = format!("PRAGMA key = \"x'{}'\";", hex_key);
    conn.execute_batch(&pragma)?;

    match conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| {
        let _: i64 = row.get(0)?;
        Ok(())
    }) {
        Ok(()) => Ok(conn),
        Err(rusqlite::Error::SqliteFailure(_, _)) => Err(AppError::InvalidPassword),
        Err(e) => Err(AppError::Db(e)),
    }
}
