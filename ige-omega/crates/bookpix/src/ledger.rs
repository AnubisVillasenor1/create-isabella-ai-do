use chrono::{DateTime, Utc};
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookPiEvent {
    pub event_id: Uuid,
    pub trace_id: Uuid,
    pub event_type: String,
    pub world_state_hash: String,
    pub expert_set_hash: String,
    pub reasoning_hash: String,
    pub outcome_hash: String,
    pub previous_hash: String,
    pub event_hash: String,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct BookPiLedger {
    pool: PgPool,
}

impl BookPiLedger {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    fn normalize_timestamp(event: &mut BookPiEvent) -> Result<(), sqlx::Error> {
        // PostgreSQL TIMESTAMPTZ stores microsecond precision. Hash exactly the
        // timestamp that will be read back, or verification would fail on nanos.
        let micros = event.created_at.timestamp_micros();
        event.created_at = DateTime::<Utc>::from_timestamp_micros(micros)
            .ok_or_else(|| sqlx::Error::Protocol("event timestamp is out of range".into()))?;
        Ok(())
    }

    fn digest(event: &BookPiEvent) -> Result<String, serde_json::Error> {
        let mut preimage = event.clone();
        preimage.event_hash.clear();
        Ok(format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&preimage)?)
        ))
    }

    pub async fn append(&self, event: BookPiEvent) -> Result<BookPiEvent, sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        let persisted = Self::append_in_transaction(&mut tx, event).await?;
        tx.commit().await?;
        Ok(persisted)
    }

    /// Appends inside the caller's transaction. This lets a domain mutation and
    /// its audit record commit or roll back together.
    pub async fn append_in_transaction(
        tx: &mut Transaction<'_, Postgres>,
        mut event: BookPiEvent,
    ) -> Result<BookPiEvent, sqlx::Error> {
        Self::normalize_timestamp(&mut event)?;
        // One chain head at a time across all application instances.
        sqlx::query("SELECT pg_advisory_xact_lock(742019862104)")
            .execute(&mut **tx)
            .await?;

        let previous: Option<String> = sqlx::query_scalar(
            "SELECT event_hash FROM bookpi_events ORDER BY sequence DESC LIMIT 1",
        )
        .fetch_optional(&mut **tx)
        .await?;
        event.previous_hash = previous.unwrap_or_else(|| "GENESIS".into());
        event.event_hash =
            Self::digest(&event).map_err(|error| sqlx::Error::Protocol(error.to_string()))?;

        sqlx::query(
            "INSERT INTO bookpi_events(event_id,trace_id,event_type,world_state_hash,expert_set_hash,reasoning_hash,outcome_hash,previous_hash,event_hash,payload,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        )
        .bind(event.event_id)
        .bind(event.trace_id)
        .bind(&event.event_type)
        .bind(&event.world_state_hash)
        .bind(&event.expert_set_hash)
        .bind(&event.reasoning_hash)
        .bind(&event.outcome_hash)
        .bind(&event.previous_hash)
        .bind(&event.event_hash)
        .bind(&event.payload)
        .bind(&event.created_at)
        .execute(&mut **tx)
        .await?;

        Ok(event)
    }

    pub async fn verify(&self) -> Result<bool, sqlx::Error> {
        let mut rows = sqlx::query(
            "SELECT event_id,trace_id,event_type,world_state_hash,expert_set_hash,reasoning_hash,outcome_hash,previous_hash,event_hash,payload,created_at FROM bookpi_events ORDER BY sequence ASC",
        )
        .fetch(&self.pool);
        let mut previous = "GENESIS".to_string();

        while let Some(row) = rows.try_next().await? {
            let event = BookPiEvent {
                event_id: row.try_get("event_id")?,
                trace_id: row.try_get("trace_id")?,
                event_type: row.try_get("event_type")?,
                world_state_hash: row.try_get("world_state_hash")?,
                expert_set_hash: row.try_get("expert_set_hash")?,
                reasoning_hash: row.try_get("reasoning_hash")?,
                outcome_hash: row.try_get("outcome_hash")?,
                previous_hash: row.try_get("previous_hash")?,
                event_hash: row.try_get("event_hash")?,
                payload: row.try_get("payload")?,
                created_at: row.try_get("created_at")?,
            };
            if event.previous_hash != previous
                || Self::digest(&event).map_err(|error| sqlx::Error::Protocol(error.to_string()))?
                    != event.event_hash
            {
                return Ok(false);
            }
            previous = event.event_hash;
        }
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event() -> BookPiEvent {
        BookPiEvent {
            event_id: Uuid::now_v7(),
            trace_id: Uuid::now_v7(),
            event_type: "TEST".into(),
            world_state_hash: "world".into(),
            expert_set_hash: "experts".into(),
            reasoning_hash: "reasoning".into(),
            outcome_hash: "outcome".into(),
            previous_hash: "GENESIS".into(),
            event_hash: String::new(),
            payload: serde_json::json!({"value": 1}),
            created_at: Utc::now(),
        }
    }

    #[test]
    fn timestamp_is_normalized_to_postgres_microsecond_precision() {
        let mut event = event();
        event.created_at = DateTime::<Utc>::from_timestamp(1, 123_456_789).unwrap();
        BookPiLedger::normalize_timestamp(&mut event).unwrap();
        assert_eq!(event.created_at.timestamp_subsec_nanos() % 1_000, 0);
    }

    #[test]
    fn digest_is_stable_and_excludes_its_own_hash_field() {
        let mut event = event();
        let first = BookPiLedger::digest(&event).unwrap();
        event.event_hash = "not-part-of-preimage".into();
        assert_eq!(first, BookPiLedger::digest(&event).unwrap());
    }

    #[test]
    fn digest_binds_payload_and_previous_link() {
        let event = event();
        let original = BookPiLedger::digest(&event).unwrap();

        let mut changed_payload = event.clone();
        changed_payload.payload = serde_json::json!({"value": 2});
        assert_ne!(original, BookPiLedger::digest(&changed_payload).unwrap());

        let mut changed_link = event;
        changed_link.previous_hash = "different-parent".into();
        assert_ne!(original, BookPiLedger::digest(&changed_link).unwrap());
    }
}
