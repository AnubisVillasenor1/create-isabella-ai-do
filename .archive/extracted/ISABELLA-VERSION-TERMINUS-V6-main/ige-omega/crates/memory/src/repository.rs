use chrono::{DateTime, Utc};
use serde_json::Value;
use shared::{EpistemicState, IgeError, IgeResult, MemoryRecord, MemoryScope};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

#[derive(Clone)]
pub struct MemoryRepository {
    pool: PgPool,
}

impl MemoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn insert(&self, record: &MemoryRecord) -> IgeResult<()> {
        let mut tx = self.pool.begin().await.map_err(db)?;
        self.insert_in_transaction(&mut tx, record).await?;
        tx.commit().await.map_err(db)?;
        Ok(())
    }

    pub async fn insert_in_transaction(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        record: &MemoryRecord,
    ) -> IgeResult<()> {
        validate_record(record)?;

        let embedding = record
            .embedding
            .as_ref()
            .map(serde_json::to_value)
            .transpose()
            .map_err(|error| IgeError::InvalidInput(error.to_string()))?;

        sqlx::query(
            "INSERT INTO memory_records(id,tenant_id,user_id,scope,session_id,content,embedding,importance,provenance,epistemic_state,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        )
        .bind(record.id)
        .bind(record.tenant_id)
        .bind(record.user_id)
        .bind(record.scope.as_str())
        .bind(record.session_id)
        .bind(record.content.trim())
        .bind(embedding)
        .bind(record.importance)
        .bind(record.provenance.trim())
        .bind(record.epistemic_state.as_str())
        .bind(&record.created_at)
        .bind(&record.expires_at)
        .execute(&mut **tx)
        .await
        .map_err(db)?;

        Ok(())
    }

    pub async fn delete_in_transaction(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        tenant_id: Uuid,
        user_id: Uuid,
        memory_id: Uuid,
    ) -> IgeResult<bool> {
        let deleted = sqlx::query(
            "DELETE FROM memory_records WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING id",
        )
        .bind(memory_id)
        .bind(tenant_id)
        .bind(user_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(db)?;

        Ok(deleted.is_some())
    }

    pub async fn list_by_user(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        limit: i64,
        session_id: Option<Uuid>,
    ) -> IgeResult<Vec<MemoryRecord>> {
        let rows = sqlx::query(
            "SELECT id,tenant_id,user_id,scope,session_id,content,embedding,importance,provenance,epistemic_state,created_at,expires_at FROM memory_records WHERE tenant_id=$1 AND (scope='TENANT' OR (scope='USER' AND user_id=$2) OR (scope='SESSION' AND user_id=$2 AND session_id=$4)) AND (expires_at IS NULL OR expires_at>NOW()) ORDER BY created_at DESC LIMIT $3",
        )
        .bind(tenant_id)
        .bind(user_id)
        .bind(limit.clamp(1, 100))
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(db)?;

        rows.into_iter()
            .map(|row| {
                let scope: String = row.try_get("scope").map_err(db)?;
                let epistemic_state: String = row.try_get("epistemic_state").map_err(db)?;
                let embedding: Option<Value> = row.try_get("embedding").map_err(db)?;
                let embedding = embedding
                    .map(serde_json::from_value::<Vec<f32>>)
                    .transpose()
                    .map_err(|error| IgeError::Database(error.to_string()))?;

                Ok(MemoryRecord {
                    id: row.try_get("id").map_err(db)?,
                    tenant_id: row.try_get("tenant_id").map_err(db)?,
                    user_id: row.try_get("user_id").map_err(db)?,
                    scope: parse_scope(&scope)?,
                    session_id: row.try_get("session_id").map_err(db)?,
                    content: row.try_get("content").map_err(db)?,
                    embedding,
                    importance: row.try_get("importance").map_err(db)?,
                    provenance: row.try_get("provenance").map_err(db)?,
                    epistemic_state: parse_epistemic_state(&epistemic_state)?,
                    created_at: row.try_get::<DateTime<Utc>, _>("created_at").map_err(db)?,
                    expires_at: row.try_get("expires_at").map_err(db)?,
                })
            })
            .collect()
    }
}

fn validate_record(record: &MemoryRecord) -> IgeResult<()> {
    if record.content.trim().is_empty()
        || record.content.chars().count() > 20_000
        || record.provenance.trim().is_empty()
        || record.provenance.chars().count() > 2_000
        || !record.importance.is_finite()
        || !(0.0..=1.0).contains(&record.importance)
        || matches!(record.scope, MemoryScope::Session) != record.session_id.is_some()
        || record
            .expires_at
            .as_ref()
            .is_some_and(|expires_at| expires_at <= &Utc::now())
        || record.embedding.as_ref().is_some_and(|embedding| {
            embedding.len() > 16_384 || embedding.iter().any(|value| !value.is_finite())
        })
    {
        return Err(IgeError::InvalidInput(
            "memory content, provenance, scope, expiration, importance, or embedding is invalid"
                .into(),
        ));
    }

    Ok(())
}

fn db(error: sqlx::Error) -> IgeError {
    IgeError::Database(error.to_string())
}

fn parse_scope(scope: &str) -> IgeResult<MemoryScope> {
    match scope {
        "TENANT" => Ok(MemoryScope::Tenant),
        "USER" => Ok(MemoryScope::User),
        "SESSION" => Ok(MemoryScope::Session),
        _ => Err(IgeError::Database("unknown memory scope".into())),
    }
}

fn parse_epistemic_state(state: &str) -> IgeResult<EpistemicState> {
    match state {
        "UNVERIFIED" => Ok(EpistemicState::Unverified),
        "SOURCE_FOUND" => Ok(EpistemicState::SourceFound),
        "CORROBORATED" => Ok(EpistemicState::Corroborated),
        "ACADEMICALLY_SUPPORTED" => Ok(EpistemicState::AcademicallySupported),
        "REPRODUCIBLE" => Ok(EpistemicState::Reproducible),
        "VALIDATED" => Ok(EpistemicState::Validated),
        "ESTABLISHED" => Ok(EpistemicState::Established),
        "DISPUTED" => Ok(EpistemicState::Disputed),
        "REJECTED" => Ok(EpistemicState::Rejected),
        "DEPRECATED" => Ok(EpistemicState::Deprecated),
        _ => Err(IgeError::Database("unknown epistemic state".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_record() -> MemoryRecord {
        MemoryRecord {
            id: Uuid::nil(),
            tenant_id: Uuid::nil(),
            user_id: Uuid::nil(),
            scope: MemoryScope::User,
            session_id: None,
            content: "test memory".into(),
            embedding: None,
            importance: 0.5,
            provenance: "unit test".into(),
            epistemic_state: EpistemicState::Unverified,
            created_at: Utc::now(),
            expires_at: None,
        }
    }

    #[test]
    fn accepts_valid_user_and_session_records() {
        let user_record = valid_record();
        assert!(validate_record(&user_record).is_ok());

        let mut session_record = valid_record();
        session_record.scope = MemoryScope::Session;
        session_record.session_id = Some(Uuid::now_v7());
        assert!(validate_record(&session_record).is_ok());
    }

    #[test]
    fn rejects_empty_content_and_provenance() {
        let mut record = valid_record();
        record.content = "  ".into();
        assert!(validate_record(&record).is_err());

        let mut record = valid_record();
        record.provenance.clear();
        assert!(validate_record(&record).is_err());
    }

    #[test]
    fn rejects_invalid_importance_and_session_scope() {
        let mut record = valid_record();
        record.importance = f32::NAN;
        assert!(validate_record(&record).is_err());

        let mut record = valid_record();
        record.scope = MemoryScope::Session;
        assert!(validate_record(&record).is_err());
    }

    #[test]
    fn rejects_non_finite_embedding_values() {
        let mut record = valid_record();
        record.embedding = Some(vec![0.1, f32::INFINITY]);
        assert!(validate_record(&record).is_err());
    }
}
