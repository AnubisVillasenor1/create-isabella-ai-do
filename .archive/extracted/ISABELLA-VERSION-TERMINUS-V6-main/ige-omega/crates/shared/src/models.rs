use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub scope: MemoryScope,
    pub session_id: Option<Uuid>,
    pub content: String,
    pub embedding: Option<Vec<f32>>,
    pub importance: f32,
    pub provenance: String,
    pub epistemic_state: EpistemicState,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MemoryScope {
    Tenant,
    User,
    Session,
}
impl MemoryScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Tenant => "TENANT",
            Self::User => "USER",
            Self::Session => "SESSION",
        }
    }
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EpistemicState {
    Unverified,
    SourceFound,
    Corroborated,
    AcademicallySupported,
    Reproducible,
    Validated,
    Established,
    Disputed,
    Rejected,
    Deprecated,
}
impl EpistemicState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Unverified => "UNVERIFIED",
            Self::SourceFound => "SOURCE_FOUND",
            Self::Corroborated => "CORROBORATED",
            Self::AcademicallySupported => "ACADEMICALLY_SUPPORTED",
            Self::Reproducible => "REPRODUCIBLE",
            Self::Validated => "VALIDATED",
            Self::Established => "ESTABLISHED",
            Self::Disputed => "DISPUTED",
            Self::Rejected => "REJECTED",
            Self::Deprecated => "DEPRECATED",
        }
    }
}
