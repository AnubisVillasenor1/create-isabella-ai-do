-- Isabella Sovereign Revenue Fabric v4 - Initial Schema
-- Migration: 001_initial_schema.sql
-- state: engine-generated

-- ============================================================
-- USERS & IDENTITY
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    tier VARCHAR(32) NOT NULL DEFAULT 'free',
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    kyc_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    jurisdiction VARCHAR(8) NOT NULL DEFAULT 'MX',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_public_id ON users(public_id);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);

-- ============================================================
-- WALLETS
-- ============================================================

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_type VARCHAR(32) NOT NULL, -- 'EARNINGS', 'SPENDING', 'RESERVED', 'VAULT'
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    available_balance NUMERIC(28,8) NOT NULL DEFAULT 0,
    pending_balance NUMERIC(28,8) NOT NULL DEFAULT 0,
    reserved_balance NUMERIC(28,8) NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, wallet_type, currency)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- ============================================================
-- TRUST SCORES (IETS)
-- ============================================================

CREATE TABLE trust_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referrals_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    revenue_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    retention_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    skills_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    agents_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    reputation_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    age_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    compliance_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    total_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    tier VARCHAR(32) NOT NULL DEFAULT 'STARTER',
    policy_version VARCHAR(64) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_scores_user_id ON trust_scores(user_id);
CREATE INDEX idx_trust_scores_tier ON trust_scores(tier);
CREATE INDEX idx_trust_scores_valid_from ON trust_scores(valid_from);

-- ============================================================
-- USAGE EVENTS (Metering)
-- ============================================================

CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(64) NOT NULL,
    resource_id UUID NOT NULL,
    metric_name VARCHAR(64) NOT NULL,
    quantity NUMERIC(28,8) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_resource ON usage_events(resource_type, resource_id);
CREATE INDEX idx_usage_events_occurred_at ON usage_events(occurred_at);
CREATE INDEX idx_usage_events_idempotency ON usage_events(idempotency_key);

-- ============================================================
-- SETTLEMENTS
-- ============================================================

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revenue_stream VARCHAR(64) NOT NULL,
    external_payment_id VARCHAR(128),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    gross_amount NUMERIC(28,8) NOT NULL,
    direct_cost NUMERIC(28,8) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(28,8) NOT NULL DEFAULT 0,
    gateway_fee NUMERIC(28,8) NOT NULL DEFAULT 0,
    operating_income NUMERIC(28,8) NOT NULL,
    emergency_amount NUMERIC(28,8) NOT NULL,
    innovation_amount NUMERIC(28,8) NOT NULL,
    treasury_amount NUMERIC(28,8) NOT NULL,
    distributable_pool NUMERIC(28,8) NOT NULL,
    user_rate NUMERIC(6,4) NOT NULL,
    platform_rate NUMERIC(6,4) NOT NULL,
    user_share NUMERIC(28,8) NOT NULL,
    platform_share NUMERIC(28,8) NOT NULL,
    iets_score NUMERIC(6,2) NOT NULL,
    iets_tier VARCHAR(32) NOT NULL,
    policy_version VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

CREATE INDEX idx_settlements_user_id ON settlements(user_id);
CREATE INDEX idx_settlements_stream ON settlements(revenue_stream);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_created_at ON settlements(created_at);
CREATE INDEX idx_settlements_idempotency ON settlements(idempotency_key);

-- ============================================================
-- LEDGER - JOURNALS (Double-Entry, Append-Only)
-- ============================================================

CREATE TABLE ledger_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID UNIQUE NOT NULL,
    settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,
    transaction_type VARCHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    previous_hash CHAR(64) NOT NULL,
    entry_hash CHAR(64) NOT NULL,
    policy_version VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_journals_idempotency ON ledger_journals(idempotency_key);
CREATE INDEX idx_ledger_journals_settlement ON ledger_journals(settlement_id);
CREATE INDEX idx_ledger_journals_occurred_at ON ledger_journals(occurred_at);

-- ============================================================
-- LEDGER - POSTINGS
-- ============================================================

CREATE TABLE ledger_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES ledger_journals(id) ON DELETE CASCADE,
    account_code VARCHAR(64) NOT NULL,
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(28,8) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    memo TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_postings_journal_id ON ledger_postings(journal_id);
CREATE INDEX idx_ledger_postings_account ON ledger_postings(account_code);

-- ============================================================
-- OUTBOX EVENTS
-- ============================================================

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    event_id UUID UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    last_error TEXT
);

CREATE INDEX idx_outbox_status ON outbox_events(status);
CREATE INDEX idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);
CREATE INDEX idx_outbox_event_id ON outbox_events(event_id);
CREATE INDEX idx_outbox_created_at ON outbox_events(created_at);

-- ============================================================
-- INBOX EVENTS (Idempotency barrier)
-- ============================================================

CREATE TABLE inbox_events (
    event_id UUID NOT NULL,
    consumer_name VARCHAR(64) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL,
    PRIMARY KEY (event_id, consumer_name)
);

CREATE INDEX idx_inbox_consumer ON inbox_events(consumer_name);

-- ============================================================
-- REVENUE STREAMS CONFIGURATION
-- ============================================================

CREATE TABLE revenue_streams (
    stream VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    model VARCHAR(32) NOT NULL,
    base_user_split NUMERIC(6,4) NOT NULL,
    base_platform_split NUMERIC(6,4) NOT NULL,
    dynamic_split BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default revenue streams
INSERT INTO revenue_streams (stream, name, model, base_user_split, base_platform_split, dynamic_split, description) VALUES
('SUBSCRIPTION', 'Suscripciones Isabella', 'recurring', 0.0000, 1.0000, FALSE, 'Planes mensuales/anuales - 100% plataforma'),
('ISA_API', 'ISA API Pay-per-token', 'transactional', 0.7000, 0.3000, TRUE, 'API de terceros - Reparto dinámico por IETS'),
('SKILL_MARKETPLACE', 'Marketplace de Skills', 'marketplace', 0.7000, 0.3000, TRUE, 'Skills, prompts, workflows, plugins - Dinámico 50/50 a 90/10'),
('AGENT_MARKETPLACE', 'Marketplace de Agentes', 'marketplace', 0.7000, 0.3000, TRUE, 'Agentes publicados - Dinámico 50/50 a 90/10'),
('AGENT_HOSTING', 'Hosting de Agentes', 'recurring', 0.0000, 1.0000, FALSE, 'Starter / Pro / Enterprise - 100% plataforma'),
('AI_CLOUD', 'Sovereign AI Cloud', 'consumption', 0.0000, 1.0000, FALSE, 'GPU, CPU, inferencia, storage - Margen sobre costo'),
('AGENT_REVENUE_SHARING', 'Revenue Sharing de Agentes', 'recurring', 0.7000, 0.3000, TRUE, 'Ingresos generados por agentes - Dinámico por IETS'),
('HYPERAUTOMATION', 'Hyperautomation', 'b2b', 0.7500, 0.2500, TRUE, 'CRM, ERP, facturación, ventas - 15-25% plataforma'),
('WHITE_LABEL', 'White Label', 'enterprise', 0.0000, 1.0000, FALSE, 'Licencia anual - 100% plataforma'),
('CERTIFICATION', 'Certificaciones', 'education', 0.0000, 1.0000, FALSE, 'Exámenes y credenciales - 100% plataforma'),
('DATA_VAULT', 'Data Vault', 'data', 0.5000, 0.5000, TRUE, 'Datasets anonimizados - Según consentimiento y compliance'),
('ECOSYSTEM_TREASURY', 'Ecosystem Treasury', 'strategic', 0.0000, 1.0000, FALSE, 'Inversión, licencias, partnerships - 100% plataforma');

-- ============================================================
-- SETTLEMENT POLICIES
-- ============================================================

CREATE TABLE settlement_policies (
    version VARCHAR(64) PRIMARY KEY,
    emergency_rate NUMERIC(6,4) NOT NULL DEFAULT 0.01,
    innovation_rate NUMERIC(6,4) NOT NULL DEFAULT 0.01,
    treasury_rate NUMERIC(6,4) NOT NULL DEFAULT 0.01,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO settlement_policies (version, emergency_rate, innovation_rate, treasury_rate, description) VALUES
('isabella-ifrf-v4.0.0', 0.01, 0.01, 0.01, 'IFRF v4 - Emergency 1%, Innovation 1%, Treasury 1%');

-- ============================================================
-- VAULTS
-- ============================================================

CREATE TABLE vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_type VARCHAR(32) NOT NULL UNIQUE, -- 'EMERGENCY', 'INNOVATION', 'TREASURY'
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    balance NUMERIC(28,8) NOT NULL DEFAULT 0,
    policy_version VARCHAR(64) NOT NULL REFERENCES settlement_policies(version),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO vaults (vault_type, currency, balance, policy_version) VALUES
('EMERGENCY', 'USD', 0, 'isabella-ifrf-v4.0.0'),
('INNOVATION', 'USD', 0, 'isabella-ifrf-v4.0.0'),
('TREASURY', 'USD', 0, 'isabella-ifrf-v4.0.0');

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vaults_updated_at BEFORE UPDATE ON vaults
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- LEDGER BALANCE CONSTRAINT (Postings must balance)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_ledger_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_debits NUMERIC(28,8);
    v_credits NUMERIC(28,8);
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_debits
        FROM ledger_postings
        WHERE journal_id = NEW.journal_id AND direction = 'DEBIT';

        SELECT COALESCE(SUM(amount), 0) INTO v_credits
        FROM ledger_postings
        WHERE journal_id = NEW.journal_id AND direction = 'CREDIT';

        IF v_debits != v_credits THEN
            RAISE EXCEPTION 'LEDGER_NOT_BALANCED: debits (%) != credits (%)', v_debits, v_credits;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_ledger_postings_balance
    AFTER INSERT OR UPDATE ON ledger_postings
    FOR EACH ROW EXECUTE FUNCTION validate_ledger_balance();