use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveEvent {
    pub event_id: Uuid,
    pub trace_id: Uuid,
    pub source: String,
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    pub payload: Value,
}
impl CognitiveEvent {
    pub fn new(
        trace_id: Uuid,
        source: impl Into<String>,
        event_type: impl Into<String>,
        payload: Value,
    ) -> Self {
        Self {
            event_id: Uuid::now_v7(),
            trace_id,
            source: source.into(),
            event_type: event_type.into(),
            timestamp: Utc::now(),
            payload,
        }
    }
}
