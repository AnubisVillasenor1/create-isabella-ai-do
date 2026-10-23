use thiserror::Error;
#[derive(Debug, Error)]
pub enum IgeError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("policy denied: {0}")]
    PolicyDenied(String),
    #[error("memory record not found: {0}")]
    MemoryNotFound(String),
    #[error("world entity not found: {0}")]
    WorldEntityNotFound(String),
    #[error("database error: {0}")]
    Database(String),
    #[error("audit failure: {0}")]
    AuditFailure(String),
}
pub type IgeResult<T> = Result<T, IgeError>;
