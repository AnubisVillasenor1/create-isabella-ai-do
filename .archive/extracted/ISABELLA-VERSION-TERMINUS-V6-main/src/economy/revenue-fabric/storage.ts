/**
 * Revenue Fabric PostgreSQL Persistence
 * state: engine-generated
 * Persistent storage for ledger, settlements, wallets, usage events
 */

import { Pool, type PoolConfig } from "pg";
import type { LedgerJournal } from "./immutable-ledger";
import type { SettlementResult } from "./normalized-settlement";
import type { UsageEvent, AggregatedUsage } from "./metering-service";
import type { Wallet } from "./types";

export interface RevenueFabricStorageConfig {
  readonly poolConfig: PoolConfig;
  readonly migrationPath: string;
}

export class RevenueFabricStorage {
  private pool: Pool;

  constructor(config: RevenueFabricStorageConfig) {
    this.pool = new Pool({
      ...config.poolConfig,
      allowExitOnIdle: true,
    });
    if (config.poolConfig.connectionString && process.env.RUNTIME_SMOKE !== "1") {
      this.initializeSchema().catch((error: unknown) => {
        console.error("[RevenueFabricStorage] schema initialization failed", error);
      });
    }
  }

  private async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        -- Ledger journals table
        CREATE TABLE IF NOT EXISTS revenue_ledger_journals (
          journal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          idempotency_key VARCHAR(255) UNIQUE NOT NULL,
          settlement_id UUID,
          postings JSONB NOT NULL,
          previous_hash VARCHAR(64) NOT NULL,
          entry_hash VARCHAR(64) NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          policy_version VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ledger_idempotency ON revenue_ledger_journals(idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_ledger_occurred_at ON revenue_ledger_journals(occurred_at);

        -- Settlements table
        CREATE TABLE IF NOT EXISTS revenue_settlements (
          idempotency_key VARCHAR(255) PRIMARY KEY,
          stream VARCHAR(64) NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          gross_amount BIGINT NOT NULL,
          direct_cost BIGINT NOT NULL,
          tax_amount BIGINT NOT NULL,
          gateway_fee BIGINT NOT NULL,
          operating_income BIGINT NOT NULL,
          emergency_amount BIGINT NOT NULL,
          innovation_amount BIGINT NOT NULL,
          treasury_amount BIGINT NOT NULL,
          distributable_pool BIGINT NOT NULL,
          user_rate NUMERIC(5,4) NOT NULL,
          platform_rate NUMERIC(5,4) NOT NULL,
          user_share BIGINT NOT NULL,
          platform_share BIGINT NOT NULL,
          iets_score NUMERIC(10,4) NOT NULL,
          iets_tier VARCHAR(16) NOT NULL,
          policy_version VARCHAR(64) NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          external_payment_id VARCHAR(255),
          journal_id UUID REFERENCES revenue_ledger_journals(journal_id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_settlement_stream ON revenue_settlements(stream);
        CREATE INDEX IF NOT EXISTS idx_settlement_occurred ON revenue_settlements(occurred_at);

        -- Wallets table
        CREATE TABLE IF NOT EXISTS revenue_wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          wallet_type VARCHAR(32) NOT NULL DEFAULT 'earnings',
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          available_balance BIGINT NOT NULL DEFAULT 0,
          pending_balance BIGINT NOT NULL DEFAULT 0,
          reserved_balance BIGINT NOT NULL DEFAULT 0,
          version BIGINT NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, wallet_type, currency)
        );
        CREATE INDEX IF NOT EXISTS idx_wallet_user ON revenue_wallets(user_id);

        -- Wallet transactions (audit trail)
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_id UUID NOT NULL REFERENCES revenue_wallets(id),
          user_id VARCHAR(255) NOT NULL,
          amount BIGINT NOT NULL,
          direction VARCHAR(8) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
          type VARCHAR(32) NOT NULL,
          reference_id VARCHAR(255),
          description TEXT,
          balance_after BIGINT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at);

        -- Usage events (raw)
        CREATE TABLE IF NOT EXISTS usage_events (
          idempotency_key VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          resource_type VARCHAR(64) NOT NULL,
          resource_id VARCHAR(255) NOT NULL,
          metric_name VARCHAR(128) NOT NULL,
          quantity BIGINT NOT NULL,
          unit VARCHAR(32) NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_occurred ON usage_events(occurred_at);
        CREATE INDEX IF NOT EXISTS idx_usage_resource ON usage_events(resource_type, resource_id);

        -- Aggregated usage (for billing)
        CREATE TABLE IF NOT EXISTS aggregated_usage (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          resource_type VARCHAR(64) NOT NULL,
          resource_id VARCHAR(255) NOT NULL,
          metric_name VARCHAR(128) NOT NULL,
          unit VARCHAR(32) NOT NULL,
          quantity BIGINT NOT NULL,
          window_start TIMESTAMPTZ NOT NULL,
          window_end TIMESTAMPTZ NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          unit_price NUMERIC(12,8) NOT NULL DEFAULT 0,
          estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, resource_type, resource_id, metric_name, window_start)
        );
        CREATE INDEX IF NOT EXISTS idx_agg_user ON aggregated_usage(user_id);
        CREATE INDEX IF NOT EXISTS idx_agg_window ON aggregated_usage(window_start, window_end);

        -- Wallets earnings eligibility
        CREATE TABLE IF NOT EXISTS wallet_eligibility (
          user_id VARCHAR(255) PRIMARY KEY,
          can_earn BOOLEAN NOT NULL DEFAULT false,
          tier VARCHAR(16) NOT NULL DEFAULT 'STARTER',
          subscription_status VARCHAR(32) NOT NULL DEFAULT 'free',
          subscription_provider VARCHAR(64),
          subscription_external_id VARCHAR(255),
          subscription_current_period_end TIMESTAMPTZ,
          last_verified_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Contribution points (for D7 - auditable contribution metric)
        CREATE TABLE IF NOT EXISTS contribution_points (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          points BIGINT NOT NULL,
          source VARCHAR(64) NOT NULL,
          reference_id VARCHAR(255),
          description TEXT,
          verified BOOLEAN NOT NULL DEFAULT false,
          verifier_id VARCHAR(255),
          verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_contrib_user ON contribution_points(user_id);
        CREATE INDEX IF NOT EXISTS idx_contrib_source ON contribution_points(source);
        CREATE INDEX IF NOT EXISTS idx_contrib_created ON contribution_points(created_at);

        -- Stripe checkout sessions
        CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          plan_code VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          status_detail VARCHAR(128),
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_stripe_user ON stripe_checkout_sessions(user_id);

        -- Outbox events
        CREATE TABLE IF NOT EXISTS outbox_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          aggregate_type VARCHAR(64) NOT NULL,
          aggregate_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          event_id VARCHAR(255) UNIQUE NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          published_at TIMESTAMPTZ,
          last_error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
        CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);

        -- Inbox events
        CREATE TABLE IF NOT EXISTS inbox_events (
          event_id VARCHAR(255) PRIMARY KEY,
          consumer_name VARCHAR(128) NOT NULL,
          processed_at TIMESTAMPTZ NOT NULL
        );
      `);
    } catch (error) {
      console.error("Revenue Fabric schema initialization failed:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== Ledger ====================
  async saveJournal(journal: LedgerJournal): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO revenue_ledger_journals 
         (journal_id, idempotency_key, settlement_id, postings, previous_hash, entry_hash, occurred_at, policy_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          journal.journalId,
          journal.idempotencyKey,
          journal.settlementId || null,
          JSON.stringify(journal.postings),
          journal.previousHash,
          journal.entryHash,
          journal.occurredAt,
          journal.policyVersion,
        ]
      );
    } finally {
      client.release();
    }
  }

  async getJournal(idempotencyKey: string): Promise<LedgerJournal | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM revenue_ledger_journals WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        journalId: row.journal_id,
        idempotencyKey: row.idempotency_key,
        settlementId: row.settlement_id,
        postings: row.postings,
        previousHash: row.previous_hash,
        entryHash: row.entry_hash,
        occurredAt: row.occurred_at,
        policyVersion: row.policy_version,
      };
    } finally {
      client.release();
    }
  }

  async getAllJournals(): Promise<LedgerJournal[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM revenue_ledger_journals ORDER BY occurred_at DESC`
      );
      return result.rows.map(row => ({
        journalId: row.journal_id,
        idempotencyKey: row.idempotency_key,
        settlementId: row.settlement_id,
        postings: row.postings,
        previousHash: row.previous_hash,
        entryHash: row.entry_hash,
        occurredAt: row.occurred_at,
        policyVersion: row.policy_version,
      }));
    } finally {
      client.release();
    }
  }

  async verifyChain(): Promise<boolean> {
    const journals = await this.getAllJournals();
    let expectedHash = "GENESIS";
    for (const journal of journals.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
      if (journal.previousHash !== expectedHash) return false;
      // Recompute hash...
      expectedHash = journal.entryHash;
    }
    return true;
  }

  // ==================== Settlements ====================
  async saveSettlement(settlement: SettlementResult, journalId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO revenue_settlements 
         (idempotency_key, stream, currency, gross_amount, direct_cost, tax_amount, gateway_fee,
          operating_income, emergency_amount, innovation_amount, treasury_amount, distributable_pool,
          user_rate, platform_rate, user_share, platform_share, iets_score, iets_tier,
          policy_version, occurred_at, external_payment_id, journal_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         ON CONFLICT (idempotency_key) DO UPDATE SET
          journal_id = EXCLUDED.journal_id`,
        [
          settlement.idempotencyKey,
          settlement.stream,
          settlement.currency,
          settlement.grossAmount,
          settlement.directCost,
          settlement.taxAmount,
          settlement.gatewayFee,
          settlement.operatingIncome,
          settlement.emergencyAmount,
          settlement.innovationAmount,
          settlement.treasuryAmount,
          settlement.distributablePool,
          settlement.userRate,
          settlement.platformRate,
          settlement.userShare,
          settlement.platformShare,
          settlement.ietsScore,
          settlement.ietsTier,
          settlement.policyVersion,
          settlement.occurredAt,
          settlement.externalPaymentId || null,
          settlement.idempotencyKey, // journalId = idempotencyKey for now
        ]
      );
    } finally {
      client.release();
    }
  }

  async getSettlement(idempotencyKey: string): Promise<SettlementResult | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM revenue_settlements WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        idempotencyKey: row.idempotency_key,
        stream: row.stream,
        currency: row.currency,
        grossAmount: Number(row.gross_amount),
        directCost: Number(row.direct_cost),
        taxAmount: Number(row.tax_amount),
        gatewayFee: Number(row.gateway_fee),
        operatingIncome: Number(row.operating_income),
        emergencyAmount: Number(row.emergency_amount),
        innovationAmount: Number(row.innovation_amount),
        treasuryAmount: Number(row.treasury_amount),
        distributablePool: Number(row.distributable_pool),
        userRate: Number(row.user_rate),
        platformRate: Number(row.platform_rate),
        userShare: Number(row.user_share),
        platformShare: Number(row.platform_share),
        ietsScore: Number(row.iets_score),
        ietsTier: row.iets_tier,
        policyVersion: row.policy_version,
        occurredAt: row.occurred_at,
        externalPaymentId: row.external_payment_id,
      };
    } finally {
      client.release();
    }
  }

  // ==================== Wallets ====================
  async getOrCreateWallet(userId: string, walletType = "earnings", currency = "USD"): Promise<Wallet> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO revenue_wallets (user_id, wallet_type, currency)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, wallet_type, currency) DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [userId, walletType, currency]
      );
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        walletType: row.wallet_type,
        currency: row.currency,
        availableBalance: Number(row.available_balance),
        pendingBalance: Number(row.pending_balance),
        reservedBalance: Number(row.reserved_balance),
        version: Number(row.version),
      };
    } finally {
      client.release();
    }
  }

  async creditWallet(
    userId: string,
    amount: number,
    type: string,
    referenceId: string,
    description: string,
    canEarn: boolean
  ): Promise<Wallet> {
    if (!canEarn) {
      throw new Error("WALLET_CREDIT_DENIED: User not eligible to earn (free tier or inactive subscription)");
    }
    if (amount <= 0) throw new Error("CREDIT_AMOUNT_MUST_BE_POSITIVE");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      
      // Get or create wallet
      const walletResult = await client.query(
        `INSERT INTO revenue_wallets (user_id, wallet_type, currency)
         VALUES ($1, 'earnings', 'USD')
         ON CONFLICT (user_id, wallet_type, currency) DO UPDATE SET version = revenue_wallets.version + 1
         RETURNING *`,
        ["userId"]
      );
      const wallet = walletResult.rows[0];
      
      const newAvailable = Number(wallet.available_balance) + amount;
      const newVersion = Number(wallet.version) + 1;
      
      // Update wallet
      await client.query(
        `UPDATE revenue_wallets 
         SET available_balance = $1, version = $2, updated_at = NOW()
         WHERE id = $3`,
        [newAvailable, newVersion, wallet.id]
      );
      
      // Record transaction
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, user_id, amount, direction, type, reference_id, description, balance_after)
         VALUES ($1, $2, $3, 'CREDIT', $4, $5, $6, $7)`,
        [wallet.id, userId, amount, type, "settlement", description, newAvailable]
      );
      
      await client.query("COMMIT");
      
      return {
        id: wallet.id,
        userId: wallet.user_id,
        walletType: wallet.wallet_type,
        currency: wallet.currency,
        availableBalance: newAvailable,
        pendingBalance: Number(wallet.pending_balance),
        reservedBalance: Number(wallet.reserved_balance),
        version: newVersion,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async debitWallet(userId: string, amount: number, type: string, referenceId: string, description: string): Promise<Wallet> {
    if (amount <= 0) throw new Error("DEBIT_AMOUNT_MUST_BE_POSITIVE");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      
      const walletResult = await client.query(
        `SELECT * FROM revenue_wallets WHERE user_id = $1 AND wallet_type = 'earnings' AND currency = 'USD' FOR UPDATE`,
        [userId]
      );
      
      if (walletResult.rows.length === 0) {
        throw new Error("WALLET_NOT_FOUND");
      }
      
      const wallet = walletResult.rows[0];
      const available = Number(wallet.available_balance);
      
      if (available < amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }
      
      const newAvailable = available - amount;
      const newVersion = Number(wallet.version) + 1;
      
      await client.query(
        `UPDATE revenue_wallets SET available_balance = $1, version = $2, updated_at = NOW() WHERE id = $3`,
        [newAvailable, newVersion, wallet.id]
      );
      
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, user_id, amount, direction, type, reference_id, description, balance_after)
         VALUES ($1, $2, $3, 'DEBIT', $4, $5, $6, $7)`,
        [wallet.id, userId, amount, type, "payout", description, newAvailable]
      );
      
      await client.query("COMMIT");
      
      return {
        id: wallet.id,
        userId: wallet.user_id,
        walletType: wallet.wallet_type,
        currency: wallet.currency,
        availableBalance: newAvailable,
        pendingBalance: Number(wallet.pending_balance),
        reservedBalance: Number(wallet.reserved_balance),
        version: newVersion,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getWallet(userId: string): Promise<Wallet | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM revenue_wallets WHERE user_id = $1 AND wallet_type = 'earnings' AND currency = 'USD'`,
        [userId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        walletType: row.wallet_type,
        currency: row.currency,
        availableBalance: Number(row.available_balance),
        pendingBalance: Number(row.pending_balance),
        reservedBalance: Number(row.reserved_balance),
        version: Number(row.version),
      };
    } finally {
      client.release();
    }
  }

  // ==================== Wallet Eligibility (D5, D7) ====================
  async setEarnEligibility(userId: string, canEarn: boolean, tier: string, subscriptionData?: {
    provider: string;
    externalId: string;
    periodEnd: Date;
    subscriptionStatus?: string;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO wallet_eligibility (user_id, can_earn, tier, subscription_status, subscription_provider, subscription_external_id, subscription_current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE SET
           can_earn = EXCLUDED.can_earn,
           tier = EXCLUDED.tier,
           subscription_status = EXCLUDED.subscription_status,
           subscription_provider = EXCLUDED.subscription_provider,
           subscription_external_id = EXCLUDED.subscription_external_id,
           subscription_current_period_end = EXCLUDED.subscription_current_period_end,
           last_verified_at = NOW(),
           updated_at = NOW()`,
        [userId, canEarn, tier, subscriptionData?.subscriptionStatus || "free", 
         subscriptionData?.provider || null, subscriptionData?.externalId || null, 
         subscriptionData?.periodEnd || null]
      );
    } finally {
      client.release();
    }
  }

  async getEarnEligibility(userId: string): Promise<{ canEarn: boolean; tier: string; subscriptionStatus: string } | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT can_earn, tier, subscription_status FROM wallet_eligibility WHERE user_id = $1`,
        [userId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return { canEarn: row.can_earn, tier: row.tier, subscriptionStatus: row.subscription_status };
    } finally {
      client.release();
    }
  }

  // ==================== Contribution Points (D7) ====================
  async addContributionPoints(
    userId: string,
    points: number,
    source: string,
    referenceId: string,
    description: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO contribution_points (user_id, points, source, reference_id, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, points, source, referenceId, description]
      );
    } finally {
      client.release();
    }
  }

  async getTotalContributionPoints(userId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT COALESCE(SUM(points), 0) as total FROM contribution_points WHERE user_id = $1 AND verified = true`,
        [userId]
      );
      return Number(result.rows[0]?.total || 0);
    } finally {
      client.release();
    }
  }

  // ==================== Usage Events ====================
  async recordUsageEvent(event: UsageEvent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO usage_events (idempotency_key, user_id, resource_type, resource_id, metric_name, quantity, unit, occurred_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          event.idempotencyKey,
          event.userId,
          event.resourceType,
          event.resourceId,
          event.metricName,
          event.quantity,
          event.unit,
          event.occurredAt,
          JSON.stringify(event.metadata || {}),
        ]
      );
    } finally {
      client.release();
    }
  }

  async getAggregatedUsage(userId: string, since?: Date): Promise<AggregatedUsage[]> {
    const client = await this.pool.connect();
    try {
      let query = `SELECT * FROM aggregated_usage WHERE user_id = $1`;
      const params: unknown[] = [userId];
      if (since) {
        query += ` AND window_start >= $2`;
        params.push(since);
      }
      query += ` ORDER BY window_start DESC`;
      
      const result = await client.query(query, params);
      return result.rows.map(row => ({
        userId: row.user_id,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        metricName: row.metric_name,
        unit: row.unit,
        quantity: Number(row.quantity),
        windowStart: row.window_start,
        windowEnd: row.window_end,
        currency: row.currency,
        unitPrice: Number(row.unit_price),
        estimatedCost: Number(row.estimated_cost),
      }));
    } finally {
      client.release();
    }
  }

  // ==================== Stripe Checkout (D3) ====================
  async createCheckoutSession(
    userId: string,
    planCode: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    // In real impl, would call Stripe API
    const sessionId = `cs_${crypto.randomUUID().replace(/-/g, '')}`;
    
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO stripe_checkout_sessions (session_id, user_id, plan_code, status, metadata)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [sessionId, userId, "plan", JSON.stringify({ planCode })]
      );
      return { sessionId, url: `https://checkout.stripe.com/pay/${sessionId}` };
    } finally {
      client.release();
    }
  }

  async handleStripeWebhook(event: { type: string; data: { object: Record<string, unknown> } }): Promise<void> {
    // Handle checkout.session.completed, invoice.paid, customer.subscription.updated, etc.
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as { 
          metadata?: { userId?: string; planCode?: string }; 
          customer?: string;
          id?: string;
        };
        const userId = session.metadata?.userId;
        const planCode = session.metadata?.planCode;
        
        if (userId && planCode) {
          // Update subscription status
          await this.setEarnEligibility(userId, true, "PROFESSIONAL", {
            provider: "stripe",
            externalId: session.customer ?? "",
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
          
          await client.query(
            `UPDATE stripe_checkout_sessions SET status = 'completed', completed_at = NOW() WHERE session_id = $1`,
            [session.id ?? ""]
          );
        }
      }
      
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== Outbox ====================
  async appendOutboxEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: unknown
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, event_id, payload)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id) DO NOTHING`,
        [aggregateType, aggregateId, eventType, crypto.randomUUID(), JSON.stringify(payload)]
      );
    } finally {
      client.release();
    }
  }

  async getPendingOutboxEvents(limit = 100): Promise<Array<{ id: string; eventType: string; payload: unknown }>> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, event_type, payload FROM outbox_events WHERE status = 'PENDING' ORDER BY created_at LIMIT $1`,
        [limit]
      );
      return result.rows.map(row => ({ id: row.id, eventType: row.event_type, payload: row.payload }));
    } finally {
      client.release();
    }
  }

  async markOutboxPublished(eventId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW() WHERE id = $1`,
        [eventId]
      );
    } finally {
      client.release();
    }
  }

  async markOutboxFailed(eventId: string, error: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE outbox_events SET status = 'FAILED', attempts = attempts + 1, last_error = $2 WHERE id = $1`,
        [eventId, error]
      );
    } finally {
      client.release();
    }
  }

  // ==================== Inbox ====================
  async recordInboxEvent(eventId: string, consumerName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO inbox_events (event_id, consumer_name, processed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, consumerName]
      );
    } finally {
      client.release();
    }
  }

  async isEventProcessed(eventId: string, consumerName: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT 1 FROM inbox_events WHERE event_id = $1 AND consumer_name = $2`,
        [eventId, consumerName]
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createRevenueFabricStorage(config: RevenueFabricStorageConfig): RevenueFabricStorage {
  return new RevenueFabricStorage(config);
}
