use serde_json::Value;
use shared::{IgeError, IgeResult};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::{CausalEdge, Entity, Relation};

#[derive(Clone)]
pub struct WorldModelRepository {
    pool: PgPool,
}

impl WorldModelRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn add_entity(&self, tenant_id: Uuid, entity: &Entity) -> IgeResult<()> {
        let mut tx = self.pool.begin().await.map_err(db)?;
        self.add_entity_in_transaction(&mut tx, tenant_id, entity)
            .await?;
        tx.commit().await.map_err(db)?;
        Ok(())
    }

    pub async fn add_entity_in_transaction(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        tenant_id: Uuid,
        entity: &Entity,
    ) -> IgeResult<()> {
        if entity.name.trim().is_empty()
            || entity.name.chars().count() > 500
            || entity.entity_type.trim().is_empty()
            || entity.entity_type.chars().count() > 100
            || entity.provenance.trim().is_empty()
            || entity.provenance.chars().count() > 2_000
        {
            return Err(IgeError::InvalidInput(
                "entity name, type, and provenance must be non-empty and bounded".into(),
            ));
        }

        sqlx::query(
            "INSERT INTO world_entities(entity_id,tenant_id,name,entity_type,provenance) VALUES($1,$2,$3,$4,$5)",
        )
        .bind(entity.entity_id)
        .bind(tenant_id)
        .bind(entity.name.trim())
        .bind(entity.entity_type.trim())
        .bind(entity.provenance.trim())
        .execute(&mut **tx)
        .await
        .map_err(db)?;
        Ok(())
    }

    pub async fn get_entity(&self, tenant_id: Uuid, entity_id: Uuid) -> IgeResult<Entity> {
        let row = sqlx::query(
            "SELECT entity_id,name,entity_type,provenance FROM world_entities WHERE tenant_id=$1 AND entity_id=$2",
        )
        .bind(tenant_id)
        .bind(entity_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(db)?
        .ok_or_else(|| IgeError::WorldEntityNotFound(entity_id.to_string()))?;

        Ok(Entity {
            entity_id: row.try_get("entity_id").map_err(db)?,
            name: row.try_get("name").map_err(db)?,
            entity_type: row.try_get("entity_type").map_err(db)?,
            provenance: row.try_get("provenance").map_err(db)?,
        })
    }

    pub async fn add_relation(&self, tenant_id: Uuid, relation: &Relation) -> IgeResult<()> {
        let mut tx = self.pool.begin().await.map_err(db)?;
        self.add_relation_in_transaction(&mut tx, tenant_id, relation)
            .await?;
        tx.commit().await.map_err(db)?;
        Ok(())
    }

    pub async fn add_relation_in_transaction(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        tenant_id: Uuid,
        relation: &Relation,
    ) -> IgeResult<()> {
        if relation.relation.trim().is_empty()
            || relation.relation.chars().count() > 200
            || !relation.confidence.is_finite()
            || !(0.0..=1.0).contains(&relation.confidence)
        {
            return Err(IgeError::InvalidInput(
                "relation label must be non-empty and confidence must be in [0,1]".into(),
            ));
        }

        ensure_entity_in_tenant(tx, tenant_id, relation.source).await?;
        ensure_entity_in_tenant(tx, tenant_id, relation.target).await?;
        sqlx::query(
            "INSERT INTO world_relations(relation_id,tenant_id,source,target,relation,confidence) VALUES($1,$2,$3,$4,$5,$6)",
        )
        .bind(Uuid::now_v7())
        .bind(tenant_id)
        .bind(relation.source)
        .bind(relation.target)
        .bind(relation.relation.trim())
        .bind(relation.confidence)
        .execute(&mut **tx)
        .await
        .map_err(db)?;
        Ok(())
    }

    pub async fn add_causal_edge(&self, tenant_id: Uuid, edge: &CausalEdge) -> IgeResult<()> {
        let mut tx = self.pool.begin().await.map_err(db)?;
        self.add_causal_edge_in_transaction(&mut tx, tenant_id, edge)
            .await?;
        tx.commit().await.map_err(db)?;
        Ok(())
    }

    pub async fn add_causal_edge_in_transaction(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        tenant_id: Uuid,
        edge: &CausalEdge,
    ) -> IgeResult<()> {
        if !edge.probability.is_finite() || !(0.0..=1.0).contains(&edge.probability) {
            return Err(IgeError::InvalidInput(
                "causal probability must be in [0,1]".into(),
            ));
        }
        if edge.evidence.len() > 64
            || edge
                .evidence
                .iter()
                .any(|item| item.trim().is_empty() || item.chars().count() > 2_000)
        {
            return Err(IgeError::InvalidInput(
                "causal evidence must contain at most 64 non-empty bounded items".into(),
            ));
        }
        let evidence = serde_json::to_value(&edge.evidence)
            .map_err(|error| IgeError::InvalidInput(error.to_string()))?;

        ensure_entity_in_tenant(tx, tenant_id, edge.cause).await?;
        ensure_entity_in_tenant(tx, tenant_id, edge.effect).await?;
        sqlx::query(
            "INSERT INTO causal_edges(causal_id,tenant_id,cause,effect,probability,evidence) VALUES($1,$2,$3,$4,$5,$6)",
        )
        .bind(Uuid::now_v7())
        .bind(tenant_id)
        .bind(edge.cause)
        .bind(edge.effect)
        .bind(edge.probability)
        .bind(evidence)
        .execute(&mut **tx)
        .await
        .map_err(db)?;
        Ok(())
    }

    pub async fn causes_of(&self, tenant_id: Uuid, effect: Uuid) -> IgeResult<Vec<CausalEdge>> {
        let effect_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM world_entities WHERE tenant_id=$1 AND entity_id=$2)",
        )
        .bind(tenant_id)
        .bind(effect)
        .fetch_one(&self.pool)
        .await
        .map_err(db)?;
        if !effect_exists {
            return Err(IgeError::WorldEntityNotFound(effect.to_string()));
        }

        let rows = sqlx::query(
            "SELECT cause,effect,probability,evidence FROM causal_edges WHERE tenant_id=$1 AND effect=$2 ORDER BY causal_id",
        )
        .bind(tenant_id)
        .bind(effect)
        .fetch_all(&self.pool)
        .await
        .map_err(db)?;

        rows.into_iter()
            .map(|row| {
                let evidence: Value = row.try_get("evidence").map_err(db)?;
                let evidence = serde_json::from_value(evidence)
                    .map_err(|error| IgeError::Database(error.to_string()))?;
                Ok(CausalEdge {
                    cause: row.try_get("cause").map_err(db)?,
                    effect: row.try_get("effect").map_err(db)?,
                    probability: row.try_get("probability").map_err(db)?,
                    evidence,
                })
            })
            .collect()
    }

    pub async fn connected_component(&self, tenant_id: Uuid, start: Uuid) -> IgeResult<Vec<Uuid>> {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM world_entities WHERE tenant_id=$1 AND entity_id=$2)",
        )
        .bind(tenant_id)
        .bind(start)
        .fetch_one(&self.pool)
        .await
        .map_err(db)?;
        if !exists {
            return Err(IgeError::WorldEntityNotFound(start.to_string()));
        }

        let rows = sqlx::query_scalar::<_, Uuid>(
            r#"
            WITH RECURSIVE connected(entity_id) AS (
                SELECT entity_id
                FROM world_entities
                WHERE tenant_id = $1 AND entity_id = $2
                UNION
                SELECT CASE
                    WHEN relation.source = connected.entity_id THEN relation.target
                    ELSE relation.source
                END
                FROM connected
                JOIN world_relations AS relation
                  ON relation.tenant_id = $1
                 AND (relation.source = connected.entity_id OR relation.target = connected.entity_id)
                JOIN world_entities AS source_entity
                  ON source_entity.entity_id = relation.source AND source_entity.tenant_id = $1
                JOIN world_entities AS target_entity
                  ON target_entity.entity_id = relation.target AND target_entity.tenant_id = $1
            )
            SELECT entity_id FROM connected ORDER BY entity_id
            "#,
        )
        .bind(tenant_id)
        .bind(start)
        .fetch_all(&self.pool)
        .await
        .map_err(db)?;
        Ok(rows)
    }
}

async fn ensure_entity_in_tenant(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    entity_id: Uuid,
) -> IgeResult<()> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM world_entities WHERE tenant_id=$1 AND entity_id=$2)",
    )
    .bind(tenant_id)
    .bind(entity_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(db)?;
    if !exists {
        // Do not reveal whether an entity exists under another tenant.
        return Err(IgeError::WorldEntityNotFound(entity_id.to_string()));
    }
    Ok(())
}

fn db(error: sqlx::Error) -> IgeError {
    IgeError::Database(error.to_string())
}
