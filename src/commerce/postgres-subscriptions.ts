import type { Pool } from 'pg';
import type { PlanId, SubscriptionStatus } from './types';
import type { SubscriptionPersistence, SubscriptionRecord } from './subscriptions';

type SubscriptionRow = {
  workspace_id: string;
  plan_code: PlanId;
  status: SubscriptionStatus;
  provider: string;
  external_ref: string | null;
  provider_customer_id: string | null;
  current_period_end: Date | string | null;
  updated_at: Date | string;
  created_at: Date | string;
};

function asIso(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function mapRow(row: SubscriptionRow): SubscriptionRecord {
  const createdAt = asIso(row.created_at);
  const updatedAt = asIso(row.updated_at);
  if (!createdAt || !updatedAt) throw new Error('SUBSCRIPTION_PERSISTENCE_INVALID_TIMESTAMP');
  return Object.freeze({
    workspaceId: row.workspace_id,
    planCode: row.plan_code,
    status: row.status,
    provider: row.provider,
    externalRef: row.external_ref ?? undefined,
    providerCustomerId: row.provider_customer_id ?? undefined,
    currentPeriodEnd: asIso(row.current_period_end),
    createdAt,
    updatedAt,
  });
}

/**
 * PostgreSQL-backed SubscriptionPersistence. Provider references and plan/status
 * values are written only by the server after a verified provider event.
 */
export class PostgresSubscriptionPersistence implements SubscriptionPersistence {
  constructor(private readonly pool: Pool) {}

  async get(workspaceId: string): Promise<SubscriptionRecord | null> {
    const result = await this.pool.query<SubscriptionRow>(
      `SELECT workspace_id, plan_code, status, provider, external_ref, provider_customer_id, current_period_end, updated_at, created_at
       FROM commerce_subscriptions WHERE workspace_id = $1 LIMIT 1`,
      [workspaceId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async save(record: SubscriptionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO commerce_subscriptions
       (workspace_id, plan_code, status, provider, external_ref, provider_customer_id, current_period_end, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (workspace_id) DO UPDATE SET
         plan_code = EXCLUDED.plan_code,
         status = EXCLUDED.status,
         provider = EXCLUDED.provider,
         external_ref = EXCLUDED.external_ref,
         provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, commerce_subscriptions.provider_customer_id),
         current_period_end = EXCLUDED.current_period_end,
         updated_at = EXCLUDED.updated_at`,
      [
        record.workspaceId,
        record.planCode,
        record.status,
        record.provider,
        record.externalRef ?? null,
        record.providerCustomerId ?? null,
        record.currentPeriodEnd ?? null,
        record.updatedAt,
        record.createdAt,
      ]
    );
  }

  async list(): Promise<readonly SubscriptionRecord[]> {
    const result = await this.pool.query<SubscriptionRow>(
      `SELECT workspace_id, plan_code, status, provider, external_ref, provider_customer_id, current_period_end, updated_at, created_at
       FROM commerce_subscriptions ORDER BY updated_at DESC`
    );
    return Object.freeze(result.rows.map(mapRow));
  }
}
