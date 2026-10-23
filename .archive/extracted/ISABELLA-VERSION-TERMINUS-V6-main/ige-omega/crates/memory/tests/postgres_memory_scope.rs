use chrono::Utc;
use memory::MemoryRepository;
use shared::{EpistemicState, MemoryRecord, MemoryScope};
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

fn record(
    tenant_id: Uuid,
    user_id: Uuid,
    scope: MemoryScope,
    session_id: Option<Uuid>,
) -> MemoryRecord {
    MemoryRecord {
        id: Uuid::now_v7(),
        tenant_id,
        user_id,
        scope,
        session_id,
        content: format!("fixture-{}", Uuid::now_v7()),
        embedding: None,
        importance: 0.5,
        provenance: "integration test fixture".into(),
        epistemic_state: EpistemicState::Unverified,
        created_at: Utc::now(),
        expires_at: None,
    }
}

#[tokio::test]
#[ignore = "requires a disposable PostgreSQL database in IGE_TEST_DATABASE_URL"]
async fn memory_visibility_respects_tenant_user_and_session_scope(
) -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("IGE_TEST_DATABASE_URL")?;
    let pool = PgPoolOptions::new()
        .max_connections(3)
        .connect(&database_url)
        .await?;
    sqlx::migrate!("../../migrations").run(&pool).await?;

    let tenant = Uuid::now_v7();
    let user_a = Uuid::now_v7();
    let user_b = Uuid::now_v7();
    let session_a = Uuid::now_v7();
    let session_b = Uuid::now_v7();

    let tenant_record = record(tenant, user_a, MemoryScope::Tenant, None);
    let user_a_record = record(tenant, user_a, MemoryScope::User, None);
    let session_a_record = record(tenant, user_a, MemoryScope::Session, Some(session_a));
    let session_b_record = record(tenant, user_a, MemoryScope::Session, Some(session_b));
    let user_b_record = record(tenant, user_b, MemoryScope::User, None);

    let ids = vec![
        tenant_record.id,
        user_a_record.id,
        session_a_record.id,
        session_b_record.id,
        user_b_record.id,
    ];
    let repository = MemoryRepository::new(pool.clone());
    for item in [
        &tenant_record,
        &user_a_record,
        &session_a_record,
        &session_b_record,
        &user_b_record,
    ] {
        repository.insert(item).await?;
    }

    let visible_session = repository
        .list_by_user(tenant, user_a, 100, Some(session_a))
        .await?;
    let visible_ids: Vec<Uuid> = visible_session.iter().map(|item| item.id).collect();
    assert!(visible_ids.contains(&tenant_record.id));
    assert!(visible_ids.contains(&user_a_record.id));
    assert!(visible_ids.contains(&session_a_record.id));
    assert!(!visible_ids.contains(&session_b_record.id));
    assert!(!visible_ids.contains(&user_b_record.id));

    let visible_without_session = repository.list_by_user(tenant, user_a, 100, None).await?;
    let ids_without_session: Vec<Uuid> =
        visible_without_session.iter().map(|item| item.id).collect();
    assert!(ids_without_session.contains(&tenant_record.id));
    assert!(ids_without_session.contains(&user_a_record.id));
    assert!(!ids_without_session.contains(&session_a_record.id));

    let visible_user_b = repository.list_by_user(tenant, user_b, 100, None).await?;
    let ids_user_b: Vec<Uuid> = visible_user_b.iter().map(|item| item.id).collect();
    assert!(ids_user_b.contains(&tenant_record.id));
    assert!(ids_user_b.contains(&user_b_record.id));
    assert!(!ids_user_b.contains(&user_a_record.id));

    sqlx::query("DELETE FROM memory_records WHERE id = ANY($1)")
        .bind(ids)
        .execute(&pool)
        .await?;
    Ok(())
}
