-- ============================================================================
-- ISABELLA GENESIS ZERO-OPEX v3: DDL UNIFICADO DE BASE DE DATOS
-- ============================================================================

-- Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "age";
CREATE EXTENSION IF NOT EXISTS "pgmq";

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT create_graph('isabella_knowledge_graph');

-- ============================================================================
-- 1. GOVERNANCE LAYER
-- ============================================================================

CREATE TABLE IF NOT EXISTS governors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    public_key TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_code VARCHAR(100) UNIQUE NOT NULL,
    rego_definition TEXT NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT 'RC-0.1a',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID REFERENCES governance_policies(id),
    governor_id UUID REFERENCES governors(id),
    vote VARCHAR(20) NOT NULL,
    signature TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    details JSONB NOT NULL,
    prev_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. AGENT RUNTIME
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(255) NOT NULL,
    trust_tier VARCHAR(50) DEFAULT 'STARTER',
    status VARCHAR(50) DEFAULT 'IDLE',
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id),
    session_token TEXT UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agent_metrics (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID REFERENCES agents(id),
    tokens_used INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id),
    capability_name VARCHAR(100) NOT NULL,
    is_granted BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- 3. MEMORY MESH & VECTOR SEARCH
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES memory_objects(id),
    target_id UUID REFERENCES memory_objects(id),
    relation_type VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID REFERENCES memory_objects(id),
    tag VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID REFERENCES memory_objects(id),
    version INT NOT NULL,
    content_delta TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID REFERENCES memory_objects(id) ON DELETE CASCADE,
    embedding vector(1024) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw 
ON embeddings USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS semantic_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_raw TEXT NOT NULL,
    prompt_embedding vector(1024) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    hit_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_hnsw 
ON semantic_cache USING hnsw (prompt_embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 4. REVENUE FABRIC & AUDIT FABRIC
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_from VARCHAR(100) NOT NULL,
    account_to VARCHAR(100) NOT NULL,
    amount NUMERIC(18,4) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id),
    revenue_stream VARCHAR(100) NOT NULL,
    net_amount NUMERIC(18,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_name VARCHAR(50) NOT NULL,
    split_ratio NUMERIC(5,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'SETTLED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id),
    event_type VARCHAR(100) NOT NULL,
    cost NUMERIC(18,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_hash_chain (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID REFERENCES audit_events(id),
    prev_hash VARCHAR(64) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hash_id BIGINT REFERENCES audit_hash_chain(id),
    signature_algorithm VARCHAR(50) DEFAULT 'ML-DSA-65',
    signature TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. ARTIFACTS & HYPERROUTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifact_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID REFERENCES artifacts(id),
    version_number INT NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifact_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID REFERENCES artifacts(id),
    meta_key VARCHAR(100) NOT NULL,
    meta_value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routing_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_hash VARCHAR(64) NOT NULL,
    complexity_score INT NOT NULL,
    selected_model VARCHAR(100) NOT NULL,
    execution_time_ms INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routing_metrics (
    id BIGSERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    avg_latency_ms NUMERIC(10,2) DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    max_context_length INT NOT NULL
);

-- ============================================================================
-- 6. QUEUES (pgmq)
-- ============================================================================

-- Colas se crearán automáticamente con pgmq
-- SELECT pgmq.create('isabella_jobs');
-- SELECT pgmq.create('isabella_notifications');
-- SELECT pgmq.create('isabella_routing');

-- ============================================================================
-- 7. SEMANTIC CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS semantic_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_raw TEXT NOT NULL,
    prompt_embedding vector(1024) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    hit_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_hnsw 
ON semantic_cache USING hnsw (prompt_embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 7. INDICES ADICIONALES PARA RENDIMIENTO
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_trust_tier ON agents(trust_tier);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_token ON agent_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_objects_namespace ON memory_objects(namespace);
CREATE INDEX IF NOT EXISTS idx_embeddings_memory ON embeddings(memory_id);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_expires ON semantic_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_prompt_hash ON routing_decisions(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_audit_hash_chain_event ON audit_hash_chain(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_signatures_hash ON audit_signatures(hash_id);

-- ============================================================================
-- 8. VISTAS PARA MONITOREO
-- ============================================================================

CREATE OR REPLACE VIEW v_agent_health AS
SELECT 
    a.id,
    a.agent_name,
    a.trust_tier,
    a.status,
    COUNT(DISTINCT s.id) as active_sessions,
    COALESCE(SUM(m.tokens_used), 0) as total_tokens,
    AVG(m.latency_ms)::numeric(10,2) as avg_latency_ms
FROM agents a
LEFT JOIN agent_sessions s ON s.agent_id = a.id AND s.ended_at IS NULL
LEFT JOIN agent_metrics m ON m.agent_id = a.id
WHERE m.recorded_at > NOW() - INTERVAL '1 hour'
GROUP BY a.id, a.agent_name, a.trust_tier, a.status;

CREATE OR REPLACE VIEW v_revenue_summary AS
SELECT 
    revenue_stream,
    COUNT(*) as transaction_count,
    SUM(net_amount) as total_revenue,
    AVG(net_amount)::numeric(18,4) as avg_revenue
FROM revenues
GROUP BY revenue_stream;

CREATE OR REPLACE VIEW v_routing_performance AS
SELECT 
    model_name,
    SUM(success_count) as total_success,
    SUM(failure_count) as total_failure,
    CASE 
        WHEN SUM(success_count + failure_count) > 0 
        THEN AVG(avg_latency_ms)::numeric(10,2) 
        ELSE 0 
    END as avg_latency_ms
FROM routing_metrics
GROUP BY model_name;