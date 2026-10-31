use shared::IgeError;
use sqlx::{postgres::PgPoolOptions, Row};
use uuid::Uuid;
use worldmodel::{Entity, Relation, WorldModelRepository};

#[tokio::test]
#[ignore = "requires a disposable PostgreSQL database in IGE_TEST_DATABASE_URL"]
async fn graph_repository_and_database_reject_cross_tenant_edges(
) -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("IGE_TEST_DATABASE_URL")?;
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await?;
    sqlx::migrate!("../../migrations").run(&pool).await?;

    let tenant_a = Uuid::now_v7();
    let tenant_b = Uuid::now_v7();
    let source = Entity {
        entity_id: Uuid::now_v7(),
        name: "tenant-a-source".into(),
        entity_type: "test".into(),
        provenance: "integration test".into(),
    };
    let foreign = Entity {
        entity_id: Uuid::now_v7(),
        name: "tenant-b-target".into(),
        entity_type: "test".into(),
        provenance: "integration test".into(),
    };
    let repository = WorldModelRepository::new(pool.clone());
    repository.add_entity(tenant_a, &source).await?;
    repository.add_entity(tenant_b, &foreign).await?;

    // A foreign-tenant entity must be indistinguishable from a missing entity.
    assert!(matches!(
        repository.get_entity(tenant_a, foreign.entity_id).await,
        Err(IgeError::WorldEntityNotFound(_))
    ));
    assert!(matches!(
        repository.causes_of(tenant_a, foreign.entity_id).await,
        Err(IgeError::WorldEntityNotFound(_))
    ));

    let relation = Relation {
        source: source.entity_id,
        target: foreign.entity_id,
        relation: "cross-tenant".into(),
        confidence: 1.0,
    };
    assert!(repository.add_relation(tenant_a, &relation).await.is_err());

    // Bypass Rust intentionally: PostgreSQL trigger must still enforce tenant ownership.
    let direct_insert = sqlx::query(
        "INSERT INTO world_relations(relation_id,tenant_id,source,target,relation,confidence) VALUES($1,$2,$3,$4,$5,$6)",
    )
    .bind(Uuid::now_v7())
    .bind(tenant_a)
    .bind(source.entity_id)
    .bind(foreign.entity_id)
    .bind("direct-cross-tenant")
    .bind(1.0_f32)
    .execute(&pool)
    .await;
    assert!(
        direct_insert.is_err(),
        "database trigger must reject cross-tenant edges"
    );

    let source_row = sqlx::query("SELECT tenant_id FROM world_entities WHERE entity_id=$1")
        .bind(source.entity_id)
        .fetch_one(&pool)
        .await?;
    assert_eq!(source_row.try_get::<Uuid, _>("tenant_id")?, tenant_a);

    sqlx::query("DELETE FROM world_entities WHERE entity_id = ANY($1)")
        .bind(vec![source.entity_id, foreign.entity_id])
        .execute(&pool)
        .await?;
    Ok(())
}
