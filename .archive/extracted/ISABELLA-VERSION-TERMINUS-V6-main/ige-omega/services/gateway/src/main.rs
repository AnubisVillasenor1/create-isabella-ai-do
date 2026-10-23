use abx::{Crown, CrownDecision};
use axum::{
    extract::{DefaultBodyLimit, Extension, Path, Query, Request, State},
    http::header::AUTHORIZATION,
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, post},
    Json, Router,
};
use bookpix::{BookPiEvent, BookPiLedger};
use chrono::{DateTime, Utc};
use cognition::{
    planner::RiskTier,
    simulation::{simulate, Scenario},
    ReasoningEngine,
};
use memory::MemoryRepository;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use shared::{EpistemicState, MemoryRecord, MemoryScope};
use sqlx::{postgres::PgPoolOptions, PgPool, Postgres, Transaction};
use std::collections::HashMap;
use std::{
    env,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use uuid::Uuid;
use worldmodel::{CausalEdge, Entity, Relation, WorldModelRepository};

#[derive(Clone, Debug)]
struct Principal {
    tenant_id: Uuid,
    user_id: Uuid,
}

#[derive(Clone)]
struct RateLimiter {
    windows: Arc<Mutex<HashMap<(Uuid, Uuid), RateWindow>>>,
    limit: u32,
    window: Duration,
}

struct RateWindow {
    started_at: Instant,
    requests: u32,
}

impl RateLimiter {
    fn new(limit: u32, window: Duration) -> Self {
        Self {
            windows: Arc::new(Mutex::new(HashMap::new())),
            limit,
            window,
        }
    }

    fn allow(&self, principal: &Principal) -> bool {
        self.allow_at(principal, Instant::now())
    }

    fn allow_at(&self, principal: &Principal, now: Instant) -> bool {
        let key = (principal.tenant_id, principal.user_id);
        let Ok(mut windows) = self.windows.lock() else {
            // Fail closed if the limiter mutex is poisoned.
            return false;
        };
        if let Some(state) = windows.get_mut(&key) {
            if now.duration_since(state.started_at) < self.window {
                if state.requests >= self.limit {
                    return false;
                }
                state.requests += 1;
                return true;
            }
        }
        windows.insert(
            key,
            RateWindow {
                started_at: now,
                requests: 1,
            },
        );
        true
    }
}

#[derive(Clone)]
struct ApiToken {
    token: String,
    principal: Principal,
}

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    memory: MemoryRepository,
    ledger: BookPiLedger,
    world: WorldModelRepository,
    api_tokens: Vec<ApiToken>,
    rate_limiter: RateLimiter,
}

#[derive(Debug, Deserialize)]
struct InferRequest {
    text: String,
}

#[derive(Debug, Serialize)]
struct InferResponse {
    request_id: Uuid,
    trace_id: Uuid,
    decision: CrownDecision,
    plan: serde_json::Value,
    evidence_status: EpistemicState,
    execution_performed: bool,
}

#[derive(Debug, Deserialize)]
struct SimulationRequest {
    scenarios: Vec<Scenario>,
    requested_iterations: u32,
    budget: u32,
}

#[derive(Debug, Deserialize)]
struct CreateMemoryRequest {
    scope: MemoryScope,
    session_id: Option<Uuid>,
    content: String,
    provenance: String,
    importance: Option<f32>,
    expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
struct CreateEntityRequest {
    name: String,
    entity_type: String,
    provenance: String,
}

#[derive(Debug, Deserialize)]
struct CreateRelationRequest {
    source: Uuid,
    target: Uuid,
    relation: String,
    confidence: f32,
}

#[derive(Debug, Deserialize)]
struct CreateCausalEdgeRequest {
    cause: Uuid,
    effect: Uuid,
    probability: f32,
    evidence: Vec<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct AbxDecisionRecord {
    decision_id: Uuid,
    trace_id: Uuid,
    capability: String,
    risk: String,
    decision: String,
    reasoning: String,
    human_approval_required: bool,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct ListMemoryQuery {
    limit: Option<i64>,
    session_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct ListAbxDecisionsQuery {
    limit: Option<i64>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let database_url = env::var("DATABASE_URL")?;
    let api_tokens = parse_api_tokens(&env::var("IGE_API_TOKENS").map_err(|_| {
        anyhow::anyhow!("IGE_API_TOKENS must map each bearer token to a tenant and user identity")
    })?)?;
    let rate_limit = env::var("IGE_RATE_LIMIT_PER_MINUTE")
        .unwrap_or_else(|_| "120".into())
        .parse::<u32>()?;
    if !(1..=10_000).contains(&rate_limit) {
        anyhow::bail!("IGE_RATE_LIMIT_PER_MINUTE must be between 1 and 10000");
    }
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&database_url)
        .await?;
    sqlx::migrate!("../../migrations").run(&pool).await?;

    let state = Arc::new(AppState {
        memory: MemoryRepository::new(pool.clone()),
        ledger: BookPiLedger::new(pool.clone()),
        world: WorldModelRepository::new(pool.clone()),
        pool,
        api_tokens,
        rate_limiter: RateLimiter::new(rate_limit, Duration::from_secs(60)),
    });
    let protected = Router::new()
        .route("/api/v1/infer", post(infer))
        .route("/api/v1/simulate", post(simulate_scenarios))
        .route("/api/v1/world/entities", post(create_entity))
        .route("/api/v1/world/entities/{entity_id}", get(get_entity))
        .route("/api/v1/world/relations", post(create_relation))
        .route("/api/v1/world/causal-edges", post(create_causal_edge))
        .route("/api/v1/world/causes/{effect}", get(causes_of))
        .route(
            "/api/v1/world/components/{entity_id}",
            get(connected_component),
        )
        .route("/api/v1/memory", post(save_memory).get(list_memory))
        .route("/api/v1/memory/{memory_id}", delete(delete_memory))
        .route("/api/v1/ops/audit/verify", get(verify_audit))
        .route("/api/v1/ops/abx/decisions", get(list_abx_decisions))
        .route_layer(middleware::from_fn_with_state(state.clone(), authenticate));
    let app = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .merge(protected)
        .layer(DefaultBodyLimit::max(64 * 1024))
        .with_state(state);

    let bind = env::var("IGE_BIND").unwrap_or_else(|_| "0.0.0.0:8080".into());
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!(%bind, "IGE-Ω gateway started");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};

        let mut terminate =
            signal(SignalKind::terminate()).expect("installing SIGTERM handler must succeed");
        tokio::select! {
            result = tokio::signal::ctrl_c() => {
                if let Err(error) = result {
                    tracing::error!(%error, "failed to listen for Ctrl-C");
                }
            }
            _ = terminate.recv() => {}
        }
    }

    #[cfg(not(unix))]
    {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to listen for Ctrl-C");
        }
    }

    tracing::info!("shutdown signal received; draining in-flight requests");
}

/// Format: token|tenant-uuid|user-uuid;token2|tenant-uuid|user-uuid.
/// Each token is a distinct principal; request bodies never select identity.
fn parse_api_tokens(raw: &str) -> anyhow::Result<Vec<ApiToken>> {
    let mut result: Vec<ApiToken> = Vec::new();
    for (index, entry) in raw.split(';').enumerate() {
        let fields: Vec<&str> = entry.split('|').collect();
        anyhow::ensure!(
            fields.len() == 3,
            "IGE_API_TOKENS entry {} must have token|tenant_uuid|user_uuid format",
            index + 1
        );
        let token = fields[0].trim();
        anyhow::ensure!(
            token.len() == 64 && token.bytes().all(|byte| byte.is_ascii_hexdigit()),
            "IGE_API_TOKENS entry {} must be exactly 64 hexadecimal characters",
            index + 1
        );
        let principal = Principal {
            tenant_id: Uuid::parse_str(fields[1].trim())
                .map_err(|_| anyhow::anyhow!("invalid tenant UUID in token entry {}", index + 1))?,
            user_id: Uuid::parse_str(fields[2].trim())
                .map_err(|_| anyhow::anyhow!("invalid user UUID in token entry {}", index + 1))?,
        };
        anyhow::ensure!(
            !result
                .iter()
                .any(|existing| token_equal(existing.token.as_bytes(), token.as_bytes())),
            "duplicate bearer token in IGE_API_TOKENS"
        );
        result.push(ApiToken {
            token: token.to_owned(),
            principal,
        });
    }
    anyhow::ensure!(!result.is_empty(), "IGE_API_TOKENS cannot be empty");
    anyhow::ensure!(
        result.len() <= 1_000,
        "IGE_API_TOKENS supports at most 1000 principals"
    );
    Ok(result)
}

async fn authenticate(
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, axum::http::StatusCode> {
    let supplied = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();

    // Scan the complete registry rather than returning at the first matching entry.
    let mut matched_principal = None;
    for entry in &state.api_tokens {
        if token_equal(supplied.as_bytes(), entry.token.as_bytes()) {
            matched_principal = Some(entry.principal.clone());
        }
    }
    let principal = matched_principal.ok_or(axum::http::StatusCode::UNAUTHORIZED)?;
    if !state.rate_limiter.allow(&principal) {
        return Err(axum::http::StatusCode::TOO_MANY_REQUESTS);
    }

    request.extensions_mut().insert(principal);
    Ok(next.run(request).await)
}

fn token_equal(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "system": "IGE-OMEGA",
        "version": "2.0.0",
        "mode": "proposal-only"
    }))
}

async fn ready(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    sqlx::query("SELECT 1")
        .execute(&state.pool)
        .await
        .map_err(|_| axum::http::StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(serde_json::json!({
        "status": "ready",
        "database": "reachable"
    })))
}

async fn infer(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Json(input): Json<InferRequest>,
) -> Result<Json<InferResponse>, axum::http::StatusCode> {
    let text = input.text.trim();
    if text.is_empty() || text.chars().count() > 12_000 {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    let plan = ReasoningEngine::reason(text).map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
    let human_approval_required = matches!(plan.risk, RiskTier::High | RiskTier::Critical);
    let decision = Crown::arbitrate(true, plan.risk, human_approval_required);
    let request_id = Uuid::now_v7();
    let trace_id = Uuid::now_v7();
    let plan_json =
        serde_json::to_value(&plan).map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    // Keep raw user objectives in the synchronous API response only. The
    // long-lived audit ledger stores decision metadata and hashes, not prompts.
    let audit_summary = plan_audit_summary(&plan, text.chars().count());
    let payload = serde_json::json!({
        "request_id": request_id,
        "tenant_id": principal.tenant_id,
        "user_id": principal.user_id,
        "decision": decision,
        "plan": audit_summary
    });
    let reasoning_hash = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&plan_json)
                .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        )
    );
    let outcome_hash = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&serde_json::json!({
                "decision": decision,
                "risk": risk_label(plan.risk),
                "execution_performed": false
            }))
            .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        )
    );
    let event = BookPiEvent {
        event_id: Uuid::now_v7(),
        trace_id,
        event_type: "INFERENCE_PROPOSED".into(),
        world_state_hash: "UNAVAILABLE".into(),
        expert_set_hash: "NONE".into(),
        reasoning_hash,
        outcome_hash,
        previous_hash: String::new(),
        event_hash: String::new(),
        payload,
        created_at: Utc::now(),
    };
    let reasoning = serde_json::to_string(&audit_summary)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let created_at = Utc::now();
    let mut tx = state.pool.begin().await.map_err(|error| {
        tracing::error!(error = %error, "ABX decision transaction begin failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    sqlx::query(
        "INSERT INTO abx_decisions(decision_id,trace_id,tenant_id,actor_user_id,capability,risk,decision,reasoning,human_approval_required,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    )
    .bind(Uuid::now_v7())
    .bind(trace_id)
    .bind(principal.tenant_id)
    .bind(principal.user_id)
    .bind("INFERENCE_PROPOSAL")
    .bind(risk_label(plan.risk))
    .bind(decision_label(decision))
    .bind(reasoning)
    .bind(human_approval_required)
    .bind(&created_at)
    .execute(&mut *tx)
    .await
    .map_err(|error| {
        tracing::error!(error = %error, "ABX decision persistence failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    BookPiLedger::append_in_transaction(&mut tx, event)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "BookPI append failed");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;
    tx.commit().await.map_err(|error| {
        tracing::error!(error = %error, "ABX decision transaction commit failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(InferResponse {
        request_id,
        trace_id,
        decision,
        plan: plan_json,
        evidence_status: EpistemicState::Unverified,
        execution_performed: false,
    }))
}

async fn simulate_scenarios(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Json(input): Json<SimulationRequest>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    if input.scenarios.is_empty()
        || input.scenarios.len() > 128
        || input.requested_iterations == 0
        || input.requested_iterations > 100_000
        || input.budget == 0
        || input.budget > 10_000
    {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }

    let result =
        simulate(&input.scenarios, input.requested_iterations, input.budget).map_err(|error| {
            tracing::debug!(%error, "simulation input rejected");
            axum::http::StatusCode::BAD_REQUEST
        })?;
    let trace_id = Uuid::now_v7();
    let payload = serde_json::json!({
        "tenant_id": principal.tenant_id,
        "user_id": principal.user_id,
        "scenarios": input.scenarios,
        "requested_iterations": input.requested_iterations,
        "budget": input.budget,
        "result": result,
        "execution_performed": false
    });
    let reasoning_hash = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&input.scenarios)
                .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        )
    );
    let outcome_hash = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&result)
                .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        )
    );
    let event = BookPiEvent {
        event_id: Uuid::now_v7(),
        trace_id,
        event_type: "SIMULATION_COMPLETED".into(),
        world_state_hash: "UNAVAILABLE".into(),
        expert_set_hash: "NONE".into(),
        reasoning_hash,
        outcome_hash,
        previous_hash: String::new(),
        event_hash: String::new(),
        payload: payload.clone(),
        created_at: Utc::now(),
    };
    state.ledger.append(event).await.map_err(|error| {
        tracing::error!(error = %error, "BookPI simulation append failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "trace_id": trace_id,
        "decision": "SIMULATION_ONLY_NO_EXECUTION",
        "result": result,
        "evidence_status": "UNVERIFIED",
        "execution_performed": false
    })))
}

async fn create_entity(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Json(input): Json<CreateEntityRequest>,
) -> Result<(axum::http::StatusCode, Json<Entity>), axum::http::StatusCode> {
    let entity = Entity {
        entity_id: Uuid::now_v7(),
        name: input.name,
        entity_type: input.entity_type,
        provenance: input.provenance,
    };
    let mut tx = state.pool.begin().await.map_err(|error| {
        tracing::error!(error = %error, "world entity transaction begin failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    state
        .world
        .add_entity_in_transaction(&mut tx, principal.tenant_id, &entity)
        .await
        .map_err(map_world_error)?;
    append_audit_in_transaction(
        &mut tx,
        &principal,
        "WORLD_ENTITY_CREATED",
        serde_json::json!({"entity": entity}),
    )
    .await?;
    tx.commit().await.map_err(|error| {
        tracing::error!(error = %error, "world entity transaction commit failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok((axum::http::StatusCode::CREATED, Json(entity)))
}

async fn get_entity(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Path(entity_id): Path<Uuid>,
) -> Result<Json<Entity>, axum::http::StatusCode> {
    state
        .world
        .get_entity(principal.tenant_id, entity_id)
        .await
        .map(Json)
        .map_err(map_world_error)
}

async fn create_relation(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Json(input): Json<CreateRelationRequest>,
) -> Result<axum::http::StatusCode, axum::http::StatusCode> {
    let relation = Relation {
        source: input.source,
        target: input.target,
        relation: input.relation,
        confidence: input.confidence,
    };
    let mut tx = state.pool.begin().await.map_err(|error| {
        tracing::error!(error = %error, "world relation transaction begin failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    state
        .world
        .add_relation_in_transaction(&mut tx, principal.tenant_id, &relation)
        .await
        .map_err(map_world_error)?;
    append_audit_in_transaction(
        &mut tx,
        &principal,
        "WORLD_RELATION_CREATED",
        serde_json::json!({"relation": relation}),
    )
    .await?;
    tx.commit().await.map_err(|error| {
        tracing::error!(error = %error, "world relation transaction commit failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(axum::http::StatusCode::CREATED)
}

async fn create_causal_edge(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Json(input): Json<CreateCausalEdgeRequest>,
) -> Result<axum::http::StatusCode, axum::http::StatusCode> {
    let edge = CausalEdge {
        cause: input.cause,
        effect: input.effect,
        probability: input.probability,
        evidence: input.evidence,
    };
    let mut tx = state.pool.begin().await.map_err(|error| {
        tracing::error!(error = %error, "causal edge transaction begin failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    state
        .world
        .add_causal_edge_in_transaction(&mut tx, principal.tenant_id, &edge)
        .await
        .map_err(map_world_error)?;
    append_audit_in_transaction(
        &mut tx,
        &principal,
        "WORLD_CAUSAL_EDGE_CREATED",
        serde_json::json!({"causal_edge": edge}),
    )
    .await?;
    tx.commit().await.map_err(|error| {
        tracing::error!(error = %error, "causal edge transaction commit failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(axum::http::StatusCode::CREATED)
}

async fn causes_of(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Path(effect): Path<Uuid>,
) -> Result<Json<Vec<CausalEdge>>, axum::http::StatusCode> {
    state
        .world
        .causes_of(principal.tenant_id, effect)
        .await
        .map(Json)
        .map_err(map_world_error)
}

async fn connected_component(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Path(entity_id): Path<Uuid>,
) -> Result<Json<Vec<Uuid>>, axum::http::StatusCode> {
    state
        .world
        .connected_component(principal.tenant_id, entity_id)
        .await
        .map(Json)
        .map_err(map_world_error)
}

async fn append_audit_in_transaction(
    tx: &mut Transaction<'_, Postgres>,
    principal: &Principal,
    event_type: &str,
    data: Value,
) -> Result<(), axum::http::StatusCode> {
    let trace_id = Uuid::now_v7();
    let payload = serde_json::json!({
        "tenant_id": principal.tenant_id,
        "user_id": principal.user_id,
        "data": data
    });
    let reasoning_hash = "NOT_APPLICABLE".to_owned();
    let outcome_hash = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&payload)
                .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        )
    );
    let event = BookPiEvent {
        event_id: Uuid::now_v7(),
        trace_id,
        event_type: event_type.to_owned(),
        world_state_hash: "UNAVAILABLE".into(),
        expert_set_hash: "NONE".into(),
        reasoning_hash,
        outcome_hash,
        previous_hash: String::new(),
        event_hash: String::new(),
        payload,
        created_at: Utc::now(),
    };
    BookPiLedger::append_in_transaction(tx, event)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, %event_type, "domain audit append failed");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(())
}

fn plan_audit_summary(plan: &cognition::planner::Plan, objective_length: usize) -> Value {
    serde_json::json!({
        "plan_id": plan.plan_id,
        "risk": risk_label(plan.risk),
        "step_count": plan.steps.len(),
        "probability_status": plan.probability_status,
        "objective_length": objective_length
    })
}

fn risk_label(risk: RiskTier) -> &'static str {
    match risk {
        RiskTier::Low => "LOW",
        RiskTier::Medium => "MEDIUM",
        RiskTier::High => "HIGH",
        RiskTier::Critical => "CRITICAL",
    }
}

fn decision_label(decision: CrownDecision) -> &'static str {
    match decision {
        CrownDecision::Allow => "ALLOW",
        CrownDecision::Repair => "REPAIR",
        CrownDecision::Degrade => "DEGRADE",
        CrownDecision::Reject => "REJECT",
        CrownDecision::Escalate => "ESCALATE",
    }
}

fn map_world_error(error: shared::IgeError) -> axum::http::StatusCode {
    match error {
        shared::IgeError::InvalidInput(_) => axum::http::StatusCode::BAD_REQUEST,
        shared::IgeError::MemoryNotFound(_) | shared::IgeError::WorldEntityNotFound(_) => {
            axum::http::StatusCode::NOT_FOUND
        }
        _ => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn save_memory(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Json(input): Json<CreateMemoryRequest>,
) -> Result<(axum::http::StatusCode, Json<serde_json::Value>), axum::http::StatusCode> {
    let content = input.content.trim();
    let provenance = input.provenance.trim();
    if content.is_empty()
        || content.chars().count() > 20_000
        || provenance.is_empty()
        || provenance.chars().count() > 2_000
        || input
            .expires_at
            .as_ref()
            .is_some_and(|expires_at| expires_at <= &Utc::now())
    {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    if matches!(input.scope, MemoryScope::Session) != input.session_id.is_some() {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    let importance = input.importance.unwrap_or(0.5);
    if !importance.is_finite() || !(0.0..=1.0).contains(&importance) {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }

    let record = MemoryRecord {
        id: Uuid::now_v7(),
        tenant_id: principal.tenant_id,
        user_id: principal.user_id,
        scope: input.scope,
        session_id: input.session_id,
        content: content.to_owned(),
        embedding: None,
        importance,
        provenance: provenance.to_owned(),
        epistemic_state: EpistemicState::Unverified,
        created_at: Utc::now(),
        expires_at: input.expires_at,
    };
    let mut tx = state.pool.begin().await.map_err(|error| {
        tracing::error!(error = %error, "memory insert transaction begin failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    state
        .memory
        .insert_in_transaction(&mut tx, &record)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "memory insert failed");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let content_sha256 = format!("{:x}", Sha256::digest(record.content.as_bytes()));
    append_audit_in_transaction(
        &mut tx,
        &principal,
        "MEMORY_RECORD_CREATED",
        serde_json::json!({
            "memory_id": record.id,
            "scope": record.scope.as_str(),
            "importance": record.importance,
            "content_sha256": content_sha256
        }),
    )
    .await?;
    tx.commit().await.map_err(|error| {
        tracing::error!(error = %error, "memory insert transaction commit failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(serde_json::json!({
            "stored": true,
            "memory_id": record.id,
            "epistemic_state": "UNVERIFIED"
        })),
    ))
}

async fn delete_memory(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Path(memory_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, axum::http::StatusCode> {
    let mut tx = state.pool.begin().await.map_err(|error| {
        tracing::error!(error = %error, "memory erasure transaction begin failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let deleted = state
        .memory
        .delete_in_transaction(&mut tx, principal.tenant_id, principal.user_id, memory_id)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "memory erasure failed");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;
    if !deleted {
        return Err(axum::http::StatusCode::NOT_FOUND);
    }
    append_audit_in_transaction(
        &mut tx,
        &principal,
        "MEMORY_RECORD_ERASED",
        serde_json::json!({"memory_id": memory_id}),
    )
    .await?;
    tx.commit().await.map_err(|error| {
        tracing::error!(error = %error, "memory erasure transaction commit failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

async fn list_memory(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Query(query): Query<ListMemoryQuery>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let records = state
        .memory
        .list_by_user(
            principal.tenant_id,
            principal.user_id,
            query.limit.unwrap_or(20),
            query.session_id,
        )
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "memory read failed");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let count = records.len();
    Ok(Json(
        serde_json::json!({ "records": records, "count": count }),
    ))
}

async fn list_abx_decisions(
    State(state): State<Arc<AppState>>,
    Extension(principal): Extension<Principal>,
    Query(query): Query<ListAbxDecisionsQuery>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let decisions = sqlx::query_as::<_, AbxDecisionRecord>(
        "SELECT decision_id,trace_id,capability,risk::text AS risk,decision::text AS decision,reasoning,human_approval_required,created_at FROM abx_decisions WHERE tenant_id=$1 AND actor_user_id=$2 ORDER BY created_at DESC LIMIT $3",
    )
    .bind(principal.tenant_id)
    .bind(principal.user_id)
    .bind(query.limit.unwrap_or(20).clamp(1, 100))
    .fetch_all(&state.pool)
    .await
    .map_err(|error| {
        tracing::error!(error = %error, "ABX decision history read failed");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let count = decisions.len();
    Ok(Json(serde_json::json!({
        "decisions": decisions,
        "count": count
    })))
}

async fn verify_audit(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let valid = state
        .ledger
        .verify()
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({
        "valid": valid,
        "algorithm": "SHA-256 chained event hashes",
        "guarantee": "tamper-evidence only; not digital signature or WORM"
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_config_binds_identity_to_token() {
        let tenant = Uuid::now_v7();
        let user = Uuid::now_v7();
        let config = format!("{}|{}|{}", "a".repeat(64), tenant, user);
        let parsed = parse_api_tokens(&config).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].principal.tenant_id, tenant);
        assert_eq!(parsed[0].principal.user_id, user);
    }

    #[test]
    fn token_config_rejects_short_or_malformed_tokens() {
        let tenant = Uuid::now_v7();
        let user = Uuid::now_v7();
        assert!(parse_api_tokens(&format!("short|{}|{}", tenant, user)).is_err());
        assert!(parse_api_tokens(&format!("{}|{}|{}", "g".repeat(64), tenant, user)).is_err());
        assert!(parse_api_tokens("not-a-valid-entry").is_err());
    }

    #[test]
    fn token_config_rejects_duplicate_tokens() {
        let tenant = Uuid::now_v7();
        let user = Uuid::now_v7();
        let token = "f".repeat(64);
        let entry = format!("{}|{}|{}", token, tenant, user);
        assert!(parse_api_tokens(&format!("{};{}", entry, entry)).is_err());
    }

    #[test]
    fn audit_summary_does_not_persist_raw_objective() {
        let objective = "sensitive customer objective phrase";
        let plan = ReasoningEngine::reason(objective).unwrap();
        let summary = plan_audit_summary(&plan, objective.chars().count());
        let serialized = summary.to_string();
        assert!(!serialized.contains(objective));
        assert_eq!(summary["objective_length"], objective.chars().count());
    }

    #[test]
    fn postgres_labels_match_abx_check_constraints() {
        assert_eq!(risk_label(RiskTier::Critical), "CRITICAL");
        assert_eq!(decision_label(CrownDecision::Escalate), "ESCALATE");
    }

    #[test]
    fn rate_limiter_blocks_at_limit_and_resets_after_window() {
        let tenant_id = Uuid::now_v7();
        let user_id = Uuid::now_v7();
        let principal = Principal { tenant_id, user_id };
        let limiter = RateLimiter::new(2, Duration::from_secs(60));
        let start = Instant::now();
        assert!(limiter.allow_at(&principal, start));
        assert!(limiter.allow_at(&principal, start + Duration::from_secs(1)));
        assert!(!limiter.allow_at(&principal, start + Duration::from_secs(2)));
        assert!(limiter.allow_at(&principal, start + Duration::from_secs(61)));
    }

    #[test]
    fn bearer_comparison_rejects_wrong_values() {
        assert!(token_equal(b"same-token", b"same-token"));
        assert!(!token_equal(b"same-token", b"other-token"));
        assert!(!token_equal(b"short", b"longer"));
    }
}
