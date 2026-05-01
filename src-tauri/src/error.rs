use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("hex decode error: {0}")]
    Hex(#[from] hex::FromHexError),

    #[error("invalid password")]
    InvalidPassword,

    #[error("not configured")]
    NotConfigured,

    #[error("already configured")]
    AlreadyConfigured,

    #[error("session is locked")]
    Locked,

    #[error("internal mutex poisoned")]
    LockPoisoned,

    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
