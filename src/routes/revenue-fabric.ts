/**
 * Isabella Sovereign Revenue Fabric v4 - API Routes (PostgreSQL-backed)
 * state: engine-generated
 * HTTP surface for the Revenue Fabric: IETS, Settlement, Ledger, Metering, Wallets
 * Fixes: D1-D9 from checklist v3
 */

import type { Application, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateIETS,
  getTierBenefits,
  type IETSInputs,
  type IETSResult,
} from '../economy/revenue-fabric/iets-engine';
import { ImmutableLedger } from '../economy/revenue-fabric/immutable-ledger';
import {
  normalizeSettlement,
  validateSettlementInvariants,
  type SettlementInputs,
  type SettlementResult,
} from '../economy/revenue-fabric/normalized-settlement';
import {
  createRevenueFabricStorage,
  type RevenueFabricStorageConfig,
} from '../economy/revenue-fabric/storage';
import {
  MeteringService,
  type UsageEvent,
  type AggregatedUsage,
} from '../economy/revenue-fabric/metering-service';
import { outbox, REVENUE_EVENTS } from '../economy/revenue-fabric/outbox-inbox';
import type { IETSTier, RevenueStream } from '../economy/revenue-fabric/types';
import type { PlanId, SubscriptionStatus } from '../commerce/types';
import { verifyStripeWebhookSignature } from '../commerce/webhook';
import type { RevenueFabricStorage } from '../economy/revenue-fabric/storage';
import type { FixedWindowRateLimiter } from '../security/rate-limit';

export interface RevenueFabricDeps {
  readonly app: Application;
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  readonly authorizeProviderRoute: (req: Request, res: Response) => boolean;
  readonly authorizeUserRoute?: (
    req: Request,
    res: Response,
    targetUserId: string
  ) => boolean | Promise<boolean>;
  readonly resolveAuthenticatedUserId?: (req: Request) => Promise<string | null>;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly publicCognitionLimiter: FixedWindowRateLimiter;
  readonly providerTimeoutMs: number;
  readonly storage?: RevenueFabricStorage;
  readonly stripePublicKey?: string;
  readonly stripeWebhookSecret?: string;
  readonly resolveCreatorEligibility?: (
    workspaceId: string
  ) => Promise<{ plan: PlanId; status: SubscriptionStatus } | null>;
}

function parseMoney(value: unknown, field: string): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
  return amount;
}

/**
 * Financial writes must be retry-safe. Never synthesize a new idempotency key
 * per request: a network retry would otherwise create a second settlement/event.
 */
export function parseIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (key.length < 8 || key.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
}

export function registerRevenueFabricRoutes(deps: RevenueFabricDeps): void {
  const {
    app,
    authorizeAdmin,
    authorizeProviderRoute,
    authorizeUserRoute = async (req, _res, targetUserId) => {
      const actorId = deps.resolveAuthenticatedUserId
        ? await deps.resolveAuthenticatedUserId(req)
        : null;
      return actorId === targetUserId;
    },
    enforceRateLimit,
    rateLimiter,
    publicCognitionLimiter,
    providerTimeoutMs,
    stripePublicKey,
    stripeWebhookSecret,
    resolveAuthenticatedUserId,
  } = deps;

  const storage =
    deps.storage ??
    createRevenueFabricStorage({
      poolConfig: {
        connectionString:
          process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL,
        // Vercel's development proxy can present a self-signed chain. Keep TLS
        // enabled locally while allowing the managed preview certificate; never
        // relax certificate validation in production.
        ...(process.env.NODE_ENV === 'production' ? {} : { ssl: { rejectUnauthorized: false } }),
      },
      migrationPath: '',
    });
  const meteringService = new MeteringService();

  // Wallet access must use identity verified by the host (e.g. Supabase Auth).
  // Client-controlled x-user-id / x-session-id headers are not credentials.
  async function getAuthenticatedWalletUserId(req: Request, res: Response): Promise<string | null> {
    const userId = deps.resolveAuthenticatedUserId
      ? await deps.resolveAuthenticatedUserId(req)
      : null;
    if (!userId) {
      res.status(401).json({ success: false, error: 'AUTHENTICATED_USER_REQUIRED' });
      return null;
    }
    return userId;
  }

  // ============================================================
  // IETS (Isabella Economic Trust Score) Endpoints
  // ============================================================

  app.post('/api/v1/revenue/iet/calculate', (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'iet-calculate')) return;

    try {
      const body = req.body || {};
      const inputs: IETSInputs = {
        referrals: parseMoney(body.referrals, 'referrals') / 100,
        revenue: parseMoney(body.revenue, 'revenue') / 100,
        retention: parseMoney(body.retention, 'retention') / 100,
        skills: parseMoney(body.skills, 'skills') / 100,
        agents: parseMoney(body.agents, 'agents') / 100,
        reputation: parseMoney(body.reputation, 'reputation') / 100,
        age: parseMoney(body.age, 'age') / 100,
        compliance: parseMoney(body.compliance, 'compliance') / 100,
      };

      const result: IETSResult = calculateIETS(inputs);
      const benefits = getTierBenefits(result.tier);

      res.json({ success: true, ...result, benefits });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'IETS_CALCULATION_FAILED',
      });
    }
  });

  // ============================================================
  // Settlement Endpoints (Admin only)
  // ============================================================

  app.post('/api/v1/revenue/settle', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'settlement')) return;

    try {
      const body = req.body || {};
      const idempotencyKey = parseIdempotencyKey(body.idempotencyKey);
      if (!idempotencyKey) {
        return res.status(400).json({
          success: false,
          error: 'IDEMPOTENCY_KEY_REQUIRED',
          message:
            'Envía una clave idempotente estable (8–200 caracteres) para evitar settlements duplicados al reintentar.',
        });
      }
      const stream = body.stream as RevenueStream;
      const creatorId = typeof body.creatorId === 'string' ? body.creatorId.trim() : '';
      const creatorWorkspaceId =
        typeof body.creatorWorkspaceId === 'string' ? body.creatorWorkspaceId.trim() : '';
      const creatorStreams = new Set<RevenueStream>([
        'ISA_API',
        'SKILL_MARKETPLACE',
        'AGENT_MARKETPLACE',
        'AGENT_REVENUE_SHARING',
        'HYPERAUTOMATION',
        'DATA_VAULT',
      ]);
      let creatorEligibility: { plan: PlanId; status: SubscriptionStatus } | null = null;
      if (creatorStreams.has(stream)) {
        if (!creatorId || !creatorWorkspaceId) {
          return res
            .status(400)
            .json({ success: false, error: 'CREATOR_ID_AND_WORKSPACE_REQUIRED' });
        }
        if (!deps.resolveCreatorEligibility) {
          return res
            .status(503)
            .json({ success: false, error: 'CREATOR_ELIGIBILITY_SOURCE_UNAVAILABLE' });
        }
        creatorEligibility = await deps.resolveCreatorEligibility(creatorWorkspaceId);
      }

      const settlementInputs: SettlementInputs = {
        grossAmount: parseMoney(body.grossAmount, 'grossAmount'),
        directCost: parseMoney(body.directCost, 'directCost'),
        taxAmount: parseMoney(body.taxAmount, 'taxAmount'),
        gatewayFee: parseMoney(body.gatewayFee, 'gatewayFee'),
        ietsInputs: {
          referrals: body.ietsInputs?.referrals ?? 0,
          revenue: body.ietsInputs?.revenue ?? 0,
          retention: body.ietsInputs?.retention ?? 0,
          skills: body.ietsInputs?.skills ?? 0,
          agents: body.ietsInputs?.agents ?? 0,
          reputation: body.ietsInputs?.reputation ?? 0,
          age: body.ietsInputs?.age ?? 0,
          compliance: body.ietsInputs?.compliance ?? 0,
        },
        stream,
        creatorId: creatorId || undefined,
        creatorWorkspaceId: creatorWorkspaceId || undefined,
        creatorPlan: creatorEligibility?.plan ?? 'free',
        creatorSubscriptionStatus: creatorEligibility?.status ?? 'canceled',
        consentEvidenceRef: body.consentEvidenceRef,
        dataLicenceEvidenceRef: body.dataLicenceEvidenceRef,
        dataVaultCreatorRateBps: body.dataVaultCreatorRateBps,
        currency: body.currency ?? 'USD',
        idempotencyKey,
        externalPaymentId: body.externalPaymentId,
        occurredAt: body.occurredAt,
      };

      const settlement = normalizeSettlement(settlementInputs);
      validateSettlementInvariants(settlement);

      // Rebuild the ledger head from PostgreSQL for each request. The durable
      // transaction atomically inserts the journal and settlement and checks the
      // current head under an advisory lock; concurrent writers are retried.
      let journal: ReturnType<ImmutableLedger['post']> | undefined;
      let persisted: { idempotent: boolean } | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const ledger = new ImmutableLedger();
        ledger.restore(await storage.getAllJournals());
        journal = ledger.post(settlement);
        try {
          persisted = await storage.saveSettlementWithJournal(settlement, journal);
          break;
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (code === 'LEDGER_CHAIN_HEAD_CHANGED_RETRY' && attempt < 2) continue;
          throw error;
        }
      }
      if (!journal || !persisted) throw new Error('SETTLEMENT_PERSISTENCE_RETRY_EXHAUSTED');

      // Emit only after a new durable transaction commits; retries are idempotent.
      if (!persisted.idempotent) {
        outbox.append('Settlement', settlement.idempotencyKey, REVENUE_EVENTS.SETTLEMENT_POSTED, {
          settlement,
          journal,
        });
      }

      res.json({ success: true, settlement, journal, idempotent: persisted.idempotent });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'SETTLEMENT_FAILED';
      const status = error.includes('IDEMPOTENCY_KEY_REUSED')
        ? 409
        : error.includes('CHAIN_HEAD_CHANGED')
          ? 409
          : error.includes('CHAIN_MULTIPLE_HEADS') ||
              error.includes('CHAIN_DISCONNECTED') ||
              error.includes('HASH_MISMATCH')
            ? 503
            : error.includes('PERSISTENCE')
              ? 503
              : 400;
      res
        .status(status)
        .json({ success: false, error, retryable: status === 409 || status >= 500 });
    }
  });

  app.get('/api/v1/revenue/settlements/:idempotencyKey', async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'settlement-get')) return;

    const { idempotencyKey } = req.params;
    const journal = await storage.getJournal(idempotencyKey);
    if (!journal) {
      return res.status(404).json({ success: false, error: 'SETTLEMENT_NOT_FOUND' });
    }
    res.json({ success: true, journal });
  });

  // ============================================================
  // Ledger Endpoints
  // ============================================================

  app.get('/api/v1/revenue/ledger/journals', async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'ledger-list')) return;

    const journals = await storage.getAllJournals();
    res.json({ success: true, journals });
  });

  app.get('/api/v1/revenue/ledger/verify', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'ledger-verify')) return;

    const isValid = await storage.verifyChain();
    res.json({ success: true, valid: isValid });
  });

  // ============================================================
  // Metering / Usage Events (Provider routes for recording, User routes for viewing)
  // ============================================================

  app.post('/api/v1/revenue/usage', async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, publicCognitionLimiter, 'usage-record')) return;

    try {
      const body = req.body || {};
      const idempotencyKey = parseIdempotencyKey(body.idempotencyKey);
      if (!idempotencyKey) {
        return res.status(400).json({
          success: false,
          error: 'IDEMPOTENCY_KEY_REQUIRED',
          message:
            'Envía una clave idempotente estable para evitar registrar el mismo consumo más de una vez.',
        });
      }
      const event: UsageEvent = {
        idempotencyKey,
        userId: body.userId ?? req.header('x-user-id') ?? 'anonymous',
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        metricName: body.metricName,
        quantity: parseMoney(body.quantity, 'quantity'),
        unit: body.unit,
        occurredAt: body.occurredAt ?? new Date().toISOString(),
        metadata: body.metadata,
      };

      const result = meteringService.recordUsage(event);
      if (!result.accepted) {
        return res.status(400).json({ success: false, error: result.reason });
      }

      // Persist usage and its durable outbox event before acknowledging the request.
      await storage.recordUsageEvent(event);
      await storage.appendOutboxEvent(
        'UsageEvent',
        event.idempotencyKey,
        REVENUE_EVENTS.USAGE_RECORDED,
        event,
        event.idempotencyKey
      );

      // Emit the in-process notification only after durable persistence.
      outbox.append('UsageEvent', event.idempotencyKey, REVENUE_EVENTS.USAGE_RECORDED, event);

      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'USAGE_RECORD_FAILED',
      });
    }
  });

  // User-scoped: Get own usage (or admin/provider can query any user)
  app.get('/api/v1/revenue/usage/:userId', async (req, res) => {
    const targetUserId = req.params.userId;

    // Authorization: admin/provider can query any user, user can only query self
    if (!authorizeProviderRoute(req, res)) {
      if (!(await authorizeUserRoute(req, res, req.params.userId))) return;
    }

    if (!enforceRateLimit(req, res, rateLimiter, 'usage-get')) return;

    const { userId } = req.params;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const usage = await storage.getAggregatedUsage(userId, since);
    res.json({ success: true, usage });
  });

  app.get('/api/v1/revenue/usage/:userId/invoice', async (req, res) => {
    const targetUserId = req.params.userId;

    if (!authorizeProviderRoute(req, res)) {
      if (!(await authorizeUserRoute(req, res, req.params.userId))) return;
    }

    if (!enforceRateLimit(req, res, rateLimiter, 'usage-invoice')) return;

    const { userId } = req.params;
    const periodStart = req.query.periodStart
      ? new Date(req.query.periodStart as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = req.query.periodEnd ? new Date(req.query.periodEnd as string) : new Date();

    // Use storage for persistent invoice data
    const usage = await storage.getAggregatedUsage(userId);
    const filtered = usage.filter(
      (u) => new Date(u.windowStart) >= periodStart && new Date(u.windowStart) <= periodEnd
    );

    const lineItems = filtered.map((u) => ({
      resourceType: u.resourceType,
      resourceId: u.resourceId,
      metricName: u.metricName,
      quantity: u.quantity,
      unit: u.unit,
      unitPrice: u.unitPrice,
      currency: u.currency,
      estimatedCost: u.estimatedCost,
    }));

    const totalEstimatedCost = lineItems.reduce((sum, item) => sum + item.estimatedCost, 0);

    res.json({
      success: true,
      invoice: {
        userId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        lineItems,
        totalEstimatedCost,
        currency: lineItems[0]?.currency || 'USD',
      },
    });
  });

  // ============================================================
  // Wallet Endpoints (User-scoped with canEarn validation)
  // ============================================================

  // User can view own wallet
  app.get('/api/v1/revenue/wallet/:userId', async (req, res) => {
    const targetUserId = req.params.userId;

    if (!authorizeProviderRoute(req, res)) {
      if (!(await authorizeUserRoute(req, res, req.params.userId))) return;
    }

    if (!enforceRateLimit(req, res, rateLimiter, 'wallet-get')) return;

    try {
      const wallet = await storage.getWallet(req.params.userId);
      if (!wallet) {
        return res.status(404).json({ success: false, error: 'WALLET_NOT_FOUND' });
      }

      // Add eligibility info
      const eligibility = await storage.getEarnEligibility(req.params.userId);

      res.json({ success: true, wallet, eligibility });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, error: err instanceof Error ? err.message : 'WALLET_GET_FAILED' });
    }
  });

  // Admin/Provider: Credit wallet (with canEarn validation)
  app.post('/api/v1/revenue/wallet/:userId/credit', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'wallet-credit')) return;

    try {
      const body = req.body || {};
      const { amount, type, referenceId, description } = body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'AMOUNT_REQUIRED_POSITIVE' });
      }

      // Check eligibility (D5)
      const eligibility = await storage.getEarnEligibility(req.params.userId);
      if (!eligibility?.canEarn) {
        return res.status(403).json({
          success: false,
          error: 'WALLET_CREDIT_DENIED',
          message: 'User not eligible to earn (free tier or inactive subscription)',
        });
      }

      const wallet = await storage.creditWallet(
        req.params.userId,
        parseMoney(body.amount, 'amount'),
        body.type ?? 'settlement',
        body.referenceId ?? uuidv4(),
        body.description ?? 'Revenue share credit',
        true // eligibility.canEarn
      );

      res.json({ success: true, wallet });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'WALLET_CREDIT_FAILED',
      });
    }
  });

  app.post('/api/v1/revenue/wallet/:userId/debit', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'wallet-debit')) return;

    try {
      const body = req.body || {};
      const wallet = await storage.debitWallet(
        req.params.userId,
        parseMoney(body.amount, 'amount'),
        body.type ?? 'payout',
        body.referenceId ?? uuidv4(),
        body.description ?? 'Payout'
      );

      res.json({ success: true, wallet });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'WALLET_DEBIT_FAILED',
      });
    }
  });

  // User: Get own wallet
  app.get('/api/v1/revenue/my/wallet', async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, 'wallet-get')) return;

    const userId = await getAuthenticatedWalletUserId(req, res);
    if (!userId) return;
    try {
      const wallet = await storage.getWallet(userId);
      const eligibility = await storage.getEarnEligibility(userId);
      const contributionPoints = await storage.getTotalContributionPoints(userId);

      res.json({ success: true, wallet, eligibility, contributionPoints });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, error: err instanceof Error ? err.message : 'WALLET_GET_FAILED' });
    }
  });

  // Payouts are intentionally fail-closed until a real payout provider, KYC,
  // tax/withholding policy, holdback and reconciliation are configured.
  // A request must never debit a wallet before an external transfer is confirmed.
  app.post('/api/v1/revenue/my/wallet/payout', async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, 'wallet-payout')) return;

    const userId = await getAuthenticatedWalletUserId(req, res);
    if (!userId) return;

    res.status(503).json({
      success: false,
      error: 'PAYOUTS_NOT_CONFIGURED',
      message: 'No hay un proveedor de pagos salientes certificado. El saldo permanece intacto.',
    });
  });

  // ============================================================
  // Eligibility Management (Admin)
  // ============================================================

  app.post('/api/v1/revenue/eligibility/:userId', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'eligibility-set')) return;

    try {
      const body = req.body || {};
      await storage.setEarnEligibility(
        req.params.userId,
        body.canEarn ?? false,
        body.tier ?? 'STARTER',
        body.subscriptionData
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'ELIGIBILITY_SET_FAILED',
      });
    }
  });

  app.get('/api/v1/revenue/eligibility/:userId', async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'eligibility-get')) return;

    const eligibility = await storage.getEarnEligibility(req.params.userId);
    res.json({
      success: true,
      eligibility: eligibility ?? { canEarn: false, tier: 'STARTER', subscriptionStatus: 'free' },
    });
  });

  // ============================================================
  // Contribution Points (D7 - Auditable)
  // ============================================================

  app.post('/api/v1/revenue/contributions/:userId', async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'contribution-add')) return;

    try {
      const body = req.body || {};
      await storage.addContributionPoints(
        req.params.userId,
        parseMoney(body.points, 'points'),
        body.source,
        body.referenceId,
        body.description
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'CONTRIBUTION_FAILED',
      });
    }
  });

  app.get('/api/v1/revenue/contributions/:userId/total', async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'contribution-get')) return;

    const total = await storage.getTotalContributionPoints(req.params.userId);
    res.json({ success: true, totalPoints: total });
  });

  // ============================================================
  // Revenue Streams Configuration
  // ============================================================

  app.get('/api/v1/revenue/streams', (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'streams-list')) return;

    const streams = [
      {
        stream: 'SUBSCRIPTION',
        name: 'Suscripciones Isabella',
        model: 'recurring',
        baseSplit: { user: 0.0, platform: 1.0 },
        dynamicSplit: false,
      },
      {
        stream: 'ISA_API',
        name: 'ISA API Pay-per-token',
        model: 'transactional',
        baseSplit: { user: 0.7, platform: 0.3 },
        dynamicSplit: true,
      },
      {
        stream: 'SKILL_MARKETPLACE',
        name: 'Marketplace de Skills',
        model: 'marketplace',
        baseSplit: { user: 0.7, platform: 0.3 },
        dynamicSplit: true,
      },
      {
        stream: 'AGENT_MARKETPLACE',
        name: 'Marketplace de Agentes',
        model: 'marketplace',
        baseSplit: { user: 0.7, platform: 0.3 },
        dynamicSplit: true,
      },
      {
        stream: 'AGENT_HOSTING',
        name: 'Hosting de Agentes',
        model: 'recurring',
        baseSplit: { user: 0.0, platform: 1.0 },
        dynamicSplit: false,
      },
      {
        stream: 'AI_CLOUD',
        name: 'Sovereign AI Cloud',
        model: 'consumption',
        baseSplit: { user: 0.0, platform: 1.0 },
        dynamicSplit: false,
      },
      {
        stream: 'AGENT_REVENUE_SHARING',
        name: 'Revenue Sharing de Agentes',
        model: 'recurring',
        baseSplit: { user: 0.7, platform: 0.3 },
        dynamicSplit: true,
      },
      {
        stream: 'HYPERAUTOMATION',
        name: 'Hyperautomation',
        model: 'b2b',
        baseSplit: { user: 0.75, platform: 0.25 },
        dynamicSplit: true,
      },
      {
        stream: 'WHITE_LABEL',
        name: 'White Label',
        model: 'enterprise',
        baseSplit: { user: 0.0, platform: 1.0 },
        dynamicSplit: false,
      },
      {
        stream: 'CERTIFICATION',
        name: 'Certificaciones',
        model: 'education',
        baseSplit: { user: 0.0, platform: 1.0 },
        dynamicSplit: false,
      },
      {
        stream: 'DATA_VAULT',
        name: 'Data Vault',
        model: 'data',
        baseSplit: { user: 0.5, platform: 0.5 },
        dynamicSplit: true,
      },
      {
        stream: 'ECOSYSTEM_TREASURY',
        name: 'Ecosystem Treasury',
        model: 'strategic',
        baseSplit: { user: 0.0, platform: 1.0 },
        dynamicSplit: false,
      },
    ];

    res.json({ success: true, streams });
  });

  // ============================================================
  // Stripe Checkout (D3 - Public Checkout Flow)
  // ============================================================

  app.post('/api/v1/billing/checkout', async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, 'billing-checkout')) return;

    try {
      const body = req.body || {};
      const planCode = typeof body.planCode === 'string' ? body.planCode : '';
      if (!planCode) return res.status(400).json({ success: false, error: 'PLAN_CODE_REQUIRED' });

      const userId = resolveAuthenticatedUserId ? await resolveAuthenticatedUserId(req) : null;
      if (!userId)
        return res.status(401).json({ success: false, error: 'AUTHENTICATED_USER_REQUIRED' });
      const publicUrl = process.env.ISABELLA_PUBLIC_URL;
      if (!publicUrl)
        return res
          .status(503)
          .json({ success: false, error: 'ISABELLA_PUBLIC_URL_NOT_CONFIGURED' });

      const base = new URL(publicUrl);
      const finalSuccessUrl =
        new URL('/billing/success', base).toString() + '?session_id={CHECKOUT_SESSION_ID}';
      const finalCancelUrl = new URL('/billing/cancel', base).toString();
      const { sessionId, url } = await storage.createCheckoutSession(
        userId,
        planCode,
        finalSuccessUrl,
        finalCancelUrl
      );
      res.json({
        success: true,
        sessionId,
        url,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'CHECKOUT_FAILED';
      const status = error.includes('NOT_CONFIGURED')
        ? 503
        : error.includes('AUTHENTICATED_USER')
          ? 401
          : 400;
      res.status(status).json({ success: false, error });
    }
  });

  app.post('/api/v1/billing/portal', async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, 'billing-portal')) return;
    try {
      const userId = resolveAuthenticatedUserId ? await resolveAuthenticatedUserId(req) : null;
      if (!userId)
        return res.status(401).json({ success: false, error: 'AUTHENTICATED_USER_REQUIRED' });
      const publicUrl = process.env.ISABELLA_PUBLIC_URL;
      if (!publicUrl)
        return res
          .status(503)
          .json({ success: false, error: 'ISABELLA_PUBLIC_URL_NOT_CONFIGURED' });
      const returnUrl = new URL('/billing', publicUrl).toString();
      const portal = await storage.createBillingPortalSession(userId, returnUrl);
      res.json({ success: true, url: portal.url });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'BILLING_PORTAL_FAILED';
      const status = error.includes('NOT_CONFIGURED')
        ? 503
        : error.includes('CUSTOMER_NOT_FOUND')
          ? 404
          : error.includes('ORIGIN_INVALID')
            ? 400
            : 502;
      res.status(status).json({ success: false, error });
    }
  });

  app.post('/api/v1/billing/stripe/webhook', async (req, res) => {
    const signature = req.get('stripe-signature');
    const rawBody =
      (req as Request & { rawBody?: string }).rawBody ??
      (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : undefined);
    if (!signature) return res.status(400).json({ success: false, error: 'MISSING_SIGNATURE' });
    if (!rawBody) return res.status(400).json({ success: false, error: 'RAW_BODY_UNAVAILABLE' });
    if (!stripeWebhookSecret)
      return res
        .status(503)
        .json({ success: false, error: 'STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED' });
    if (!verifyStripeWebhookSignature(rawBody, signature, stripeWebhookSecret)) {
      return res.status(401).json({ success: false, error: 'INVALID_STRIPE_SIGNATURE' });
    }

    try {
      const event = JSON.parse(rawBody) as {
        id?: string;
        created?: number;
        type?: string;
        data?: { object?: Record<string, unknown> };
      };
      if (!event.id || !event.type || !event.data?.object || typeof event.created !== 'number') {
        return res.status(400).json({ success: false, error: 'STRIPE_EVENT_SHAPE_INVALID' });
      }
      const result = await storage.handleStripeWebhook({
        id: event.id,
        created: event.created,
        type: event.type,
        data: { object: event.data.object },
      });
      res.json({ success: true, received: true, ...result });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'WEBHOOK_FAILED';
      const status = error.includes('METADATA_INVALID') ? 400 : 503;
      res.status(status).json({ success: false, error, retryable: status >= 500 });
    }
  });

  // ============================================================
  // Outbox / Inbox Status
  // ============================================================

  app.get('/api/v1/revenue/outbox/status', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'outbox-status')) return;

    const stats = await storage.getOutboxStats();
    res.json({ success: true, ...stats });
  });

  app.get('/api/v1/revenue/outbox/dead-letter', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'outbox-dlq')) return;

    const deadLetter = await storage.getDeadLetterOutboxEvents();
    res.json({ success: true, events: deadLetter });
  });

  app.post('/api/v1/revenue/outbox/retry/:eventId', async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, 'outbox-retry')) return;

    const { eventId } = req.params;
    const retried = await storage.retryDeadLetterOutboxEvent(eventId);
    res.json({
      success: retried,
      message: retried ? 'Event requeued for processing' : 'Event not found or not in dead letter',
    });
  });

  // ============================================================
  // Health / Readiness
  // ============================================================

  async function getRevenueHealthDiagnostics() {
    const durableDatabaseConfigured = Boolean(
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL
    );
    const ledgerValid = durableDatabaseConfigured
      ? await storage.verifyChain().catch(() => false)
      : false;
    const ready = durableDatabaseConfigured && ledgerValid;
    return {
      ready,
      ledgerValid,
      durableDatabaseConfigured,
      // A database URL does not prove that the subscription migration is applied.
      subscriptionPersistenceSchema: 'unverified' as const,
      stripeCheckoutEnvConfigured: Boolean(
        process.env.STRIPE_SECRET_KEY && process.env.ISABELLA_PUBLIC_URL
      ),
      stripeWebhookSecretConfigured: Boolean(stripeWebhookSecret),
      supabaseAuthEnvConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      creatorPayoutsEnabled: false,
    };
  }

  // Public health response exposes only service state. Operators may request details
  // with ?details=true, but only after admin authentication.
  app.get('/api/v1/revenue/health', async (req, res) => {
    if (req.query.details === 'true') {
      if (!authorizeAdmin(req, res)) return;
      const diagnostics = await getRevenueHealthDiagnostics();
      return res.status(diagnostics.ready ? 200 : 503).json({
        success: diagnostics.ready,
        service: 'revenue-fabric',
        version: '5.0.0',
        ...diagnostics,
        timestamp: new Date().toISOString(),
      });
    }
    const diagnostics = await getRevenueHealthDiagnostics();
    return res.status(diagnostics.ready ? 200 : 503).json({
      success: diagnostics.ready,
      status: diagnostics.ready ? 'ready' : 'degraded',
      service: 'revenue-fabric',
      version: '5.0.0',
      timestamp: new Date().toISOString(),
    });
  });
}
