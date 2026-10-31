-- Durable provider-verified subscription state for Revenue Fabric eligibility.
CREATE TABLE IF NOT EXISTS commerce_subscriptions (
  workspace_id VARCHAR(255) PRIMARY KEY,
  plan_code VARCHAR(32) NOT NULL CHECK (plan_code IN ('free','premium','vip','enterprise')),
  status VARCHAR(32) NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','suspended')),
  provider VARCHAR(64) NOT NULL,
  external_ref VARCHAR(255) NOT NULL,
  provider_customer_id VARCHAR(255),
  current_period_end TIMESTAMPTZ,
  provider_event_created BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE commerce_subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(255);
ALTER TABLE commerce_subscriptions ADD COLUMN IF NOT EXISTS provider_event_created BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_commerce_subscriptions_status
  ON commerce_subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_commerce_subscriptions_plan
  ON commerce_subscriptions(plan_code, status);

COMMENT ON TABLE commerce_subscriptions IS
  'Server-maintained subscription state applied only after a verified payment-provider event. A missing/expired period is not eligible for creator revenue.';
