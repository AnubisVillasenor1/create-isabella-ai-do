/**
 * Revenue Fabric PostgreSQL Persistence
 * state: engine-generated
 * Persistent storage for ledger, settlements, wallets, usage events
 */

import { Pool, type PoolConfig } from 'pg';
import Stripe from 'stripe';
import { ImmutableLedger, type LedgerJournal } from './immutable-ledger';
import type { SettlementResult } from './normalized-settlement';
import type { UsageEvent, AggregatedUsage } from './metering-service';
import type { Wallet } from './types';

function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('SETTLEMENT_AMOUNT_INVALID');
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(minor / 100 - amount) > 0.000001) {
    throw new Error('SETTLEMENT_AMOUNT_MUST_HAVE_MAX_TWO_DECIMALS');
  }
  return minor;
}

function fromStoredAmount(value: unknown, amountUnit: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error('SETTLEMENT_STORAGE_AMOUNT_INVALID');
  return amountUnit === 'minor_v2' ? numeric / 100 : numeric;
}

function sameSettlementPayload(
  row: Record<string, unknown>,
  settlement: SettlementResult
): boolean {
  const amountUnit = row.amount_unit === 'minor_v2' ? 'minor_v2' : 'legacy_major';
  const moneyFields = [
    ['gross_amount', settlement.grossAmount],
    ['direct_cost', settlement.directCost],
    ['tax_amount', settlement.taxAmount],
    ['gateway_fee', settlement.gatewayFee],
    ['operating_income', settlement.operatingIncome],
    ['emergency_amount', settlement.emergencyAmount],
    ['innovation_amount', settlement.innovationAmount],
    ['treasury_amount', settlement.treasuryAmount],
    ['distributable_pool', settlement.distributablePool],
    ['user_share', settlement.userShare],
    ['platform_share', settlement.platformShare],
    ['platform_phoenix_fund', settlement.platformPhoenixFund],
    ['platform_infrastructure', settlement.platformInfrastructure],
    ['platform_dao', settlement.platformDao],
  ] as const;
  if (
    moneyFields.some(
      ([field, expected]) => Math.abs(fromStoredAmount(row[field], amountUnit) - expected) > 0.005
    )
  )
    return false;
  const rateFields = [
    ['user_rate', settlement.userRate],
    ['platform_rate', settlement.platformRate],
    ['iets_score', settlement.ietsScore],
  ] as const;
  if (rateFields.some(([field, expected]) => Math.abs(Number(row[field]) - expected) > 0.0001))
    return false;
  return (
    row.idempotency_key === settlement.idempotencyKey &&
    row.stream === settlement.stream &&
    row.currency === settlement.currency &&
    row.creator_id === (settlement.creatorId ?? null) &&
    Boolean(row.creator_eligible) === settlement.creatorEligible &&
    row.creator_eligibility_reason === settlement.creatorEligibilityReason &&
    row.iets_tier === settlement.ietsTier &&
    row.policy_version === settlement.policyVersion &&
    (row.external_payment_id ?? null) === (settlement.externalPaymentId ?? null)
  );
}

export interface RevenueFabricStorageConfig {
  readonly poolConfig: PoolConfig;
  readonly migrationPath: string;
}

export class RevenueFabricStorage {
  private pool: Pool;
  private schemaReady: Promise<void> = Promise.resolve();

  constructor(config: RevenueFabricStorageConfig) {
    this.pool = new Pool({
      ...config.poolConfig,
      allowExitOnIdle: true,
    });
    if (config.poolConfig.connectionString && process.env.RUNTIME_SMOKE !== '1') {
      this.schemaReady = this.initializeSchema();
      void this.schemaReady.catch((error: unknown) => {
        console.error('[RevenueFabricStorage] schema initialization failed', error);
      });
    }
  }

  async ready(): Promise<void> {
    await this.schemaReady;
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
          platform_phoenix_fund BIGINT NOT NULL DEFAULT 0,
          platform_infrastructure BIGINT NOT NULL DEFAULT 0,
          platform_dao BIGINT NOT NULL DEFAULT 0,
          creator_id VARCHAR(255),
          creator_eligible BOOLEAN NOT NULL DEFAULT FALSE,
          creator_eligibility_reason TEXT NOT NULL DEFAULT 'unknown',
          amount_unit TEXT NOT NULL DEFAULT 'minor_v2',
          iets_score NUMERIC(10,4) NOT NULL,
          iets_tier VARCHAR(16) NOT NULL,
          policy_version VARCHAR(64) NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          external_payment_id VARCHAR(255),
          journal_id UUID REFERENCES revenue_ledger_journals(journal_id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE revenue_settlements ADD COLUMN IF NOT EXISTS platform_phoenix_fund BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE revenue_settlements ADD COLUMN IF NOT EXISTS platform_infrastructure BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE revenue_settlements ADD COLUMN IF NOT EXISTS platform_dao BIGINT NOT NULL DEFAULT 0;
        ALTER TABLE revenue_settlements ADD COLUMN IF NOT EXISTS creator_id VARCHAR(255);
        ALTER TABLE revenue_settlements ADD COLUMN IF NOT EXISTS creator_eligible BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE revenue_settlements ADD COLUMN IF NOT EXISTS creator_eligibility_reason TEXT NOT NULL DEFAULT 'legacy_unknown';
        ALTER TABLE revenue_settlements ADD COLUMN IF NOT EXISTS amount_unit TEXT NOT NULL DEFAULT 'legacy_major';
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
          provider_event_created BIGINT NOT NULL DEFAULT 0,
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
        ALTER TABLE wallet_eligibility ADD COLUMN IF NOT EXISTS provider_event_created BIGINT NOT NULL DEFAULT 0;
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
      console.error('Revenue Fabric schema initialization failed:', error);
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
      return result.rows.map((row) => ({
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
    try {
      const restored = new ImmutableLedger();
      restored.restore(await this.getAllJournals());
      return restored.verifyChain();
    } catch {
      return false;
    }
  }

  // ==================== Settlements ====================
  async saveSettlementWithJournal(
    settlement: SettlementResult,
    journal: LedgerJournal
  ): Promise<{ idempotent: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [
        'isabella-revenue-fabric-ledger',
      ]);

      const existing = await client.query(
        'SELECT * FROM revenue_settlements WHERE idempotency_key = $1 FOR UPDATE',
        [settlement.idempotencyKey]
      );
      if (existing.rows[0]) {
        if (!sameSettlementPayload(existing.rows[0] as Record<string, unknown>, settlement)) {
          throw new Error('SETTLEMENT_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
        }
        const existingJournal = await client.query(
          'SELECT entry_hash FROM revenue_ledger_journals WHERE idempotency_key = $1',
          [settlement.idempotencyKey]
        );
        if (!existingJournal.rows[0] || existingJournal.rows[0].entry_hash !== journal.entryHash) {
          throw new Error('SETTLEMENT_JOURNAL_IDEMPOTENCY_MISMATCH');
        }
        await client.query(
          `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, event_id, payload, status)
           VALUES ('Settlement', $1, 'settlement.posted', $1, $2::jsonb, 'PENDING')
           ON CONFLICT (event_id) DO NOTHING`,
          [settlement.idempotencyKey, JSON.stringify({ settlement, journal })]
        );
        await client.query('COMMIT');
        return { idempotent: true };
      }

      const priorJournal = await client.query(
        'SELECT journal_id, entry_hash FROM revenue_ledger_journals WHERE idempotency_key = $1 FOR UPDATE',
        [settlement.idempotencyKey]
      );
      let journalId = journal.journalId;
      if (priorJournal.rows[0]) {
        if (priorJournal.rows[0].entry_hash !== journal.entryHash) {
          throw new Error('LEDGER_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
        }
        journalId = priorJournal.rows[0].journal_id;
      } else {
        const heads = await client.query(
          `SELECT head.entry_hash
           FROM revenue_ledger_journals AS head
           WHERE NOT EXISTS (
             SELECT 1 FROM revenue_ledger_journals AS child
             WHERE child.previous_hash = head.entry_hash
           )
           LIMIT 2`
        );
        if (heads.rows.length > 1)
          throw new Error('LEDGER_CHAIN_MULTIPLE_HEADS_REQUIRES_RECONCILIATION');
        const currentHead = heads.rows[0]?.entry_hash ?? 'GENESIS';
        if (journal.previousHash !== currentHead)
          throw new Error('LEDGER_CHAIN_HEAD_CHANGED_RETRY');

        await client.query(
          `INSERT INTO revenue_ledger_journals
           (journal_id, idempotency_key, settlement_id, postings, previous_hash, entry_hash, occurred_at, policy_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            journal.journalId,
            journal.idempotencyKey,
            journal.settlementId ?? null,
            JSON.stringify(journal.postings),
            journal.previousHash,
            journal.entryHash,
            journal.occurredAt,
            journal.policyVersion,
          ]
        );
      }

      await client.query(
        `INSERT INTO revenue_settlements
         (idempotency_key, stream, currency, gross_amount, direct_cost, tax_amount, gateway_fee,
          operating_income, emergency_amount, innovation_amount, treasury_amount, distributable_pool,
          user_rate, platform_rate, user_share, platform_share, platform_phoenix_fund, platform_infrastructure, platform_dao, creator_id, creator_eligible, creator_eligibility_reason, amount_unit,
          iets_score, iets_tier, policy_version, occurred_at, external_payment_id, journal_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)`,
        [
          settlement.idempotencyKey,
          settlement.stream,
          settlement.currency,
          toMinorUnits(settlement.grossAmount),
          toMinorUnits(settlement.directCost),
          toMinorUnits(settlement.taxAmount),
          toMinorUnits(settlement.gatewayFee),
          toMinorUnits(settlement.operatingIncome),
          toMinorUnits(settlement.emergencyAmount),
          toMinorUnits(settlement.innovationAmount),
          toMinorUnits(settlement.treasuryAmount),
          toMinorUnits(settlement.distributablePool),
          settlement.userRate,
          settlement.platformRate,
          toMinorUnits(settlement.userShare),
          toMinorUnits(settlement.platformShare),
          toMinorUnits(settlement.platformPhoenixFund),
          toMinorUnits(settlement.platformInfrastructure),
          toMinorUnits(settlement.platformDao),
          settlement.creatorId ?? null,
          settlement.creatorEligible,
          settlement.creatorEligibilityReason,
          'minor_v2',
          settlement.ietsScore,
          settlement.ietsTier,
          settlement.policyVersion,
          settlement.occurredAt,
          settlement.externalPaymentId ?? null,
          journalId,
        ]
      );
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, event_id, payload, status)
         VALUES ('Settlement', $1, 'settlement.posted', $1, $2::jsonb, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [settlement.idempotencyKey, JSON.stringify({ settlement, journal })]
      );
      await client.query('COMMIT');
      return { idempotent: false };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveSettlement(settlement: SettlementResult, journalId: string): Promise<void> {
    const journal = await this.getJournal(settlement.idempotencyKey);
    if (!journal || journal.journalId !== journalId) {
      throw new Error('SETTLEMENT_JOURNAL_MUST_BE_PERSISTED_WITH_MATCHING_ID');
    }
    await this.saveSettlementWithJournal(settlement, journal);
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
      const amountUnit = row.amount_unit ?? 'legacy_major';
      return {
        idempotencyKey: row.idempotency_key,
        stream: row.stream,
        currency: row.currency,
        grossAmount: fromStoredAmount(row.gross_amount, amountUnit),
        directCost: fromStoredAmount(row.direct_cost, amountUnit),
        taxAmount: fromStoredAmount(row.tax_amount, amountUnit),
        gatewayFee: fromStoredAmount(row.gateway_fee, amountUnit),
        operatingIncome: fromStoredAmount(row.operating_income, amountUnit),
        emergencyAmount: fromStoredAmount(row.emergency_amount, amountUnit),
        innovationAmount: fromStoredAmount(row.innovation_amount, amountUnit),
        treasuryAmount: fromStoredAmount(row.treasury_amount, amountUnit),
        distributablePool: fromStoredAmount(row.distributable_pool, amountUnit),
        userRate: Number(row.user_rate),
        platformRate: Number(row.platform_rate),
        userShare: fromStoredAmount(row.user_share, amountUnit),
        platformShare: fromStoredAmount(row.platform_share, amountUnit),
        platformPhoenixFund: fromStoredAmount(row.platform_phoenix_fund, amountUnit),
        platformInfrastructure: fromStoredAmount(row.platform_infrastructure, amountUnit),
        platformDao: fromStoredAmount(row.platform_dao, amountUnit),
        creatorId: row.creator_id ?? undefined,
        creatorEligible: Boolean(row.creator_eligible),
        creatorEligibilityReason: row.creator_eligibility_reason ?? 'legacy_unknown',
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
  async getOrCreateWallet(
    userId: string,
    walletType = 'earnings',
    currency = 'USD'
  ): Promise<Wallet> {
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
      throw new Error(
        'WALLET_CREDIT_DENIED: User not eligible to earn (free tier or inactive subscription)'
      );
    }
    if (amount <= 0) throw new Error('CREDIT_AMOUNT_MUST_BE_POSITIVE');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get or create wallet
      const walletResult = await client.query(
        `INSERT INTO revenue_wallets (user_id, wallet_type, currency)
         VALUES ($1, 'earnings', 'USD')
         ON CONFLICT (user_id, wallet_type, currency) DO UPDATE SET version = revenue_wallets.version + 1
         RETURNING *`,
        ['userId']
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
        [wallet.id, userId, amount, type, 'settlement', description, newAvailable]
      );

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async debitWallet(
    userId: string,
    amount: number,
    type: string,
    referenceId: string,
    description: string
  ): Promise<Wallet> {
    if (amount <= 0) throw new Error('DEBIT_AMOUNT_MUST_BE_POSITIVE');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const walletResult = await client.query(
        `SELECT * FROM revenue_wallets WHERE user_id = $1 AND wallet_type = 'earnings' AND currency = 'USD' FOR UPDATE`,
        [userId]
      );

      if (walletResult.rows.length === 0) {
        throw new Error('WALLET_NOT_FOUND');
      }

      const wallet = walletResult.rows[0];
      const available = Number(wallet.available_balance);

      if (available < amount) {
        throw new Error('INSUFFICIENT_BALANCE');
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
        [wallet.id, userId, amount, type, 'payout', description, newAvailable]
      );

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
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
  async setEarnEligibility(
    userId: string,
    canEarn: boolean,
    tier: string,
    subscriptionData?: {
      provider: string;
      externalId: string;
      periodEnd: Date;
      subscriptionStatus?: string;
    }
  ): Promise<void> {
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
        [
          userId,
          canEarn,
          tier,
          subscriptionData?.subscriptionStatus || 'free',
          subscriptionData?.provider || null,
          subscriptionData?.externalId || null,
          subscriptionData?.periodEnd || null,
        ]
      );
    } finally {
      client.release();
    }
  }

  async getEarnEligibility(
    userId: string
  ): Promise<{ canEarn: boolean; tier: string; subscriptionStatus: string } | null> {
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
      return result.rows.map((row) => ({
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
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const publicUrl = process.env.ISABELLA_PUBLIC_URL;
    if (!stripeSecret || !publicUrl) throw new Error('STRIPE_CHECKOUT_NOT_CONFIGURED');
    if (!userId || userId.length > 255) throw new Error('CHECKOUT_USER_ID_INVALID');
    if (!['premium', 'vip', 'enterprise'].includes(planCode))
      throw new Error('CHECKOUT_PLAN_NOT_PURCHASABLE');

    const base = new URL(publicUrl);
    const success = new URL(successUrl);
    const cancel = new URL(cancelUrl);
    if (
      (base.protocol !== 'https:' &&
        base.hostname !== 'localhost' &&
        base.hostname !== '127.0.0.1') ||
      success.origin !== base.origin ||
      cancel.origin !== base.origin
    ) {
      throw new Error('CHECKOUT_REDIRECT_ORIGIN_INVALID');
    }

    const stripe = new Stripe(stripeSecret);
    const productName =
      planCode === 'premium'
        ? 'Isabella Premium'
        : planCode === 'vip'
          ? 'Isabella VIP'
          : 'Isabella Enterprise';
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      success_url: success.toString(),
      cancel_url: cancel.toString(),
      client_reference_id: userId,
      allow_promotion_codes: true,
      metadata: { userId, planCode },
      subscription_data: { metadata: { userId, planCode } },
      line_items: [],
    };

    if (planCode === 'premium') {
      const referenceRaw = Number(process.env.ISABELLA_REFERENCE_AI_PRICE_CENTS ?? 2000);
      const markupRaw = Number(process.env.ISABELLA_PRICE_MARKUP_BPS ?? 2500);
      const referenceCents =
        Number.isSafeInteger(referenceRaw) && referenceRaw >= 100 && referenceRaw <= 100_000_000
          ? referenceRaw
          : 2000;
      const markupBps =
        Number.isSafeInteger(markupRaw) && markupRaw >= 0 && markupRaw <= 100_000
          ? markupRaw
          : 2500;
      const monthlyCents = Math.min(
        100_000_000,
        Math.ceil((referenceCents * (10_000 + markupBps)) / 10_000)
      );
      const configuredPremiumPrice = process.env.STRIPE_PRICE_PREMIUM;
      if (configuredPremiumPrice) {
        if (!/^price_[A-Za-z0-9]+$/.test(configuredPremiumPrice))
          throw new Error('STRIPE_PRICE_ID_INVALID:premium');
        const price = await stripe.prices.retrieve(configuredPremiumPrice);
        if (
          !price.active ||
          price.currency !== 'usd' ||
          price.unit_amount !== monthlyCents ||
          price.recurring?.interval !== 'month'
        ) {
          throw new Error('STRIPE_PRICE_POLICY_MISMATCH:premium');
        }
        sessionParams.line_items = [{ price: configuredPremiumPrice, quantity: 1 }];
      } else {
        sessionParams.line_items = [
          {
            price_data: {
              currency: 'usd',
              unit_amount: monthlyCents,
              recurring: { interval: 'month' },
              product_data: {
                name: productName,
                description: 'Acceso mensual al ecosistema Isabella',
              },
            },
            quantity: 1,
          },
        ];
      }
    } else {
      const priceId = process.env['STRIPE_PRICE_' + planCode.toUpperCase()];
      if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId))
        throw new Error('STRIPE_PRICE_ID_NOT_CONFIGURED:' + planCode);
      const price = await stripe.prices.retrieve(priceId);
      if (
        !price.active ||
        price.currency !== 'usd' ||
        price.recurring?.interval !== 'month' ||
        price.unit_amount == null
      ) {
        throw new Error('STRIPE_PRICE_POLICY_MISMATCH:' + planCode);
      }
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    }

    const minuteBucket = Math.floor(Date.now() / 60_000);
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: 'isabella-checkout-' + userId + '-' + planCode + '-' + minuteBucket,
    });
    if (!session.url) throw new Error('STRIPE_CHECKOUT_URL_MISSING');

    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO stripe_checkout_sessions (session_id, user_id, plan_code, status, metadata)
         VALUES ($1, $2, $3, 'pending', $4)
         ON CONFLICT (session_id) DO NOTHING`,
        [
          session.id,
          userId,
          planCode,
          JSON.stringify({ userId, planCode, stripeMode: 'subscription' }),
        ]
      );
      return { sessionId: session.id, url: session.url };
    } finally {
      client.release();
    }
  }

  async createBillingPortalSession(userId: string, returnUrl: string): Promise<{ url: string }> {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const publicUrl = process.env.ISABELLA_PUBLIC_URL;
    if (!stripeSecret || !publicUrl) throw new Error('STRIPE_BILLING_PORTAL_NOT_CONFIGURED');
    const base = new URL(publicUrl);
    const returnTarget = new URL(returnUrl);
    if (returnTarget.origin !== base.origin)
      throw new Error('BILLING_PORTAL_RETURN_ORIGIN_INVALID');

    const client = await this.pool.connect();
    let customerId: string | undefined;
    try {
      const result = await client.query(
        `SELECT provider_customer_id FROM commerce_subscriptions
         WHERE workspace_id = $1 AND provider_customer_id IS NOT NULL
         ORDER BY updated_at DESC LIMIT 1`,
        [userId]
      );
      customerId = result.rows[0]?.provider_customer_id;
    } finally {
      client.release();
    }
    if (!customerId) throw new Error('BILLING_PORTAL_CUSTOMER_NOT_FOUND');

    const stripe = new Stripe(stripeSecret);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnTarget.toString(),
    });
    if (!session.url) throw new Error('STRIPE_BILLING_PORTAL_URL_MISSING');
    return { url: session.url };
  }

  async handleStripeWebhook(event: {
    id: string;
    created: number;
    type: string;
    data: { object: Record<string, unknown> };
  }): Promise<{ duplicate: boolean; processed: boolean }> {
    if (
      !event.id ||
      event.id.length > 248 ||
      !Number.isSafeInteger(event.created) ||
      event.created <= 0
    ) {
      throw new Error('STRIPE_EVENT_METADATA_INVALID');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const claimed = await client.query(
        `INSERT INTO inbox_events (event_id, consumer_name, processed_at)
         VALUES ($1, 'stripe-revenue-fabric', NOW())
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        ['stripe:' + event.id]
      );
      if (claimed.rowCount === 0) {
        await client.query('COMMIT');
        return { duplicate: true, processed: false };
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as {
          id?: string;
          mode?: string;
          payment_status?: string;
          metadata?: { userId?: string; planCode?: string };
        };
        if (
          session.mode === 'subscription' &&
          (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')
        ) {
          const userId = session.metadata?.userId;
          const planCode = session.metadata?.planCode;
          if (!userId || !['premium', 'vip', 'enterprise'].includes(planCode ?? '')) {
            throw new Error('STRIPE_CHECKOUT_METADATA_INVALID');
          }
          await client.query(
            `UPDATE stripe_checkout_sessions
             SET status = 'completed', completed_at = NOW(), status_detail = 'checkout_completed_waiting_for_subscription_event'
             WHERE session_id = $1 AND user_id = $2 AND plan_code = $3`,
            [session.id ?? '', userId, planCode]
          );
        }
      } else if (
        [
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ].includes(event.type)
      ) {
        const subscription = event.data.object as {
          id?: string;
          customer?: string | { id?: string };
          status?: string;
          current_period_end?: number;
          metadata?: { userId?: string; planCode?: string };
        };
        const userId = subscription.metadata?.userId;
        const planCode = subscription.metadata?.planCode;
        const subscriptionId = subscription.id;
        if (
          !userId ||
          userId.length > 255 ||
          !subscriptionId ||
          !['premium', 'vip', 'enterprise'].includes(planCode ?? '')
        ) {
          throw new Error('STRIPE_SUBSCRIPTION_METADATA_INVALID');
        }

        const rawStatus =
          event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status;
        const status =
          rawStatus === 'active'
            ? 'active'
            : rawStatus === 'trialing'
              ? 'trialing'
              : rawStatus === 'past_due' || rawStatus === 'unpaid'
                ? 'past_due'
                : rawStatus === 'paused'
                  ? 'suspended'
                  : 'canceled';
        const periodEnd =
          typeof subscription.current_period_end === 'number'
            ? new Date(subscription.current_period_end * 1000)
            : null;
        const unexpired =
          periodEnd !== null &&
          Number.isFinite(periodEnd.getTime()) &&
          periodEnd.getTime() > Date.now();
        const eligible = planCode !== 'free' && status === 'active' && unexpired;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : (subscription.customer?.id ?? null);

        await client.query(
          `INSERT INTO commerce_subscriptions
           (workspace_id, plan_code, status, provider, external_ref, provider_customer_id,
            current_period_end, provider_event_created, created_at, updated_at)
           VALUES ($1, $2, $3, 'stripe', $4, $5, $6, $7, NOW(), NOW())
           ON CONFLICT (workspace_id) DO UPDATE SET
             plan_code = EXCLUDED.plan_code,
             status = EXCLUDED.status,
             provider = EXCLUDED.provider,
             external_ref = EXCLUDED.external_ref,
             provider_customer_id = EXCLUDED.provider_customer_id,
             current_period_end = EXCLUDED.current_period_end,
             provider_event_created = EXCLUDED.provider_event_created,
             updated_at = NOW()
           WHERE commerce_subscriptions.provider_event_created < EXCLUDED.provider_event_created`,
          [userId, planCode, status, subscriptionId, customerId, periodEnd, event.created]
        );

        await client.query(
          `INSERT INTO wallet_eligibility
           (user_id, can_earn, tier, subscription_status, subscription_provider,
            subscription_external_id, subscription_current_period_end, provider_event_created)
           VALUES ($1, $2, 'STARTER', $3, 'stripe', $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             can_earn = EXCLUDED.can_earn,
             subscription_status = EXCLUDED.subscription_status,
             subscription_provider = EXCLUDED.subscription_provider,
             subscription_external_id = EXCLUDED.subscription_external_id,
             subscription_current_period_end = EXCLUDED.subscription_current_period_end,
             provider_event_created = EXCLUDED.provider_event_created,
             last_verified_at = NOW(),
             updated_at = NOW()
           WHERE wallet_eligibility.provider_event_created < EXCLUDED.provider_event_created`,
          [userId, eligible, status, subscriptionId, periodEnd, event.created]
        );
      }

      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, event_id, payload, status)
         VALUES ('StripeEvent', $1, $2, $3, $4::jsonb, 'PENDING')
         ON CONFLICT (event_id) DO NOTHING`,
        [event.id, event.type, 'stripe:' + event.id, JSON.stringify(event)]
      );
      await client.query('COMMIT');
      return { duplicate: false, processed: true };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
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
    payload: unknown,
    eventId?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, event_id, payload)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          aggregateType,
          aggregateId,
          eventType,
          eventId ?? crypto.randomUUID(),
          JSON.stringify(payload),
        ]
      );
    } finally {
      client.release();
    }
  }

  async getPendingOutboxEvents(
    limit = 100
  ): Promise<Array<{ id: string; eventType: string; payload: unknown }>> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, event_type, payload FROM outbox_events WHERE status = 'PENDING' ORDER BY created_at LIMIT $1`,
        [limit]
      );
      return result.rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        payload: row.payload,
      }));
    } finally {
      client.release();
    }
  }

  async getOutboxStats(): Promise<{
    pending: number;
    published: number;
    failed: number;
    deadLetter: number;
  }> {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS published,
         COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
         COUNT(*) FILTER (WHERE status = 'FAILED' AND attempts >= 5)::int AS dead_letter
       FROM outbox_events`
    );
    const row = result.rows[0] ?? {};
    return {
      pending: Number(row.pending ?? 0),
      published: Number(row.published ?? 0),
      failed: Number(row.failed ?? 0),
      deadLetter: Number(row.dead_letter ?? 0),
    };
  }

  async getDeadLetterOutboxEvents(limit = 100): Promise<
    Array<{
      id: string;
      eventId: string;
      eventType: string;
      payload: unknown;
      attempts: number;
      lastError: string | null;
    }>
  > {
    const result = await this.pool.query(
      `SELECT id, event_id, event_type, payload, attempts, last_error
       FROM outbox_events
       WHERE status = 'FAILED' AND attempts >= 5
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(100, Math.floor(limit)))]
    );
    return result.rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      payload: row.payload,
      attempts: Number(row.attempts),
      lastError: row.last_error ?? null,
    }));
  }

  async retryDeadLetterOutboxEvent(eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE outbox_events
       SET status = 'PENDING', attempts = 0, last_error = NULL
       WHERE id = $1 AND status = 'FAILED' AND attempts >= 5
       RETURNING id`,
      [eventId]
    );
    return result.rowCount === 1;
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

export function createRevenueFabricStorage(
  config: RevenueFabricStorageConfig
): RevenueFabricStorage {
  return new RevenueFabricStorage(config);
}
