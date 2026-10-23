/**
 * Isabella Sovereign Revenue Fabric v4 - API Routes (PostgreSQL-backed)
 * state: engine-generated
 * HTTP surface for the Revenue Fabric: IETS, Settlement, Ledger, Metering, Wallets
 * Fixes: D1-D9 from checklist v3
 */

import type { Application, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { calculateIETS, getTierBenefits, type IETSInputs, type IETSResult } from "../economy/revenue-fabric/iets-engine";
import { ImmutableLedger } from "../economy/revenue-fabric/immutable-ledger";
import { normalizeSettlement, validateSettlementInvariants, type SettlementInputs, type SettlementResult } from "../economy/revenue-fabric/normalized-settlement";
import { createRevenueFabricStorage, type RevenueFabricStorageConfig } from "../economy/revenue-fabric/storage";
import { MeteringService, type UsageEvent, type AggregatedUsage } from "../economy/revenue-fabric/metering-service";
import { outbox, REVENUE_EVENTS } from "../economy/revenue-fabric/outbox-inbox";
import type { IETSTier, RevenueStream } from "../economy/revenue-fabric/types";
import type { RevenueFabricStorage } from "../economy/revenue-fabric/storage";

export interface RevenueFabricDeps {
  readonly app: Application;
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  readonly authorizeProviderRoute: (req: Request, res: Response) => boolean;
  readonly authorizeUserRoute?: (req: Request, res: Response, targetUserId: string) => boolean;
  readonly enforceRateLimit: (req: Request, res: Response, limiter: any, bucket: string) => boolean;
  readonly rateLimiter: any;
  readonly publicCognitionLimiter: any;
  readonly providerTimeoutMs: number;
  readonly storage?: RevenueFabricStorage;
  readonly stripePublicKey?: string;
  readonly stripeWebhookSecret?: string;
}

function parseMoney(value: unknown, field: string): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
  return amount;
}

export function registerRevenueFabricRoutes(deps: RevenueFabricDeps): void {
  const { 
    app, 
    authorizeAdmin, 
    authorizeProviderRoute, 
    authorizeUserRoute = (req, res, targetUserId) => getTargetUserId(req) === targetUserId,
    enforceRateLimit, 
    rateLimiter, 
    publicCognitionLimiter, 
    providerTimeoutMs,
    stripePublicKey,
    stripeWebhookSecret 
  } = deps;

  const storage = deps.storage ?? createRevenueFabricStorage({
    poolConfig: {
      connectionString: process.env.DATABASE_URL
        ?? process.env.POSTGRES_URL
        ?? process.env.POSTGRES_PRISMA_URL,
    },
    migrationPath: "",
  });
  const meteringService = new MeteringService();

  // ============================================================
  // Helper: Get user ID from request (for user-scoped endpoints)
  // ============================================================
  function getTargetUserId(req: Request): string {
    // Try to get from params first (for user-scoped routes)
    if (req.params.userId) return String(req.params.userId);
    // Then from body
    if (req.body?.userId) return req.body.userId;
    // Then from query
    if (req.query.userId) return String(req.query.userId);
    // Fallback to actor
    return getUserIdFromReq(req);
  }

  function getUserIdFromReq(req: Request): string {
    const sessionId = req.get("x-session-id");
    if (sessionId) return `session:${sessionId}`;
    const userId = req.get("x-user-id");
    if (userId) return `user:${userId}`;
    return `ip:${req.ip ?? "unknown"}`;
  }

  // ============================================================
  // IETS (Isabella Economic Trust Score) Endpoints
  // ============================================================

  app.post("/api/v1/revenue/iet/calculate", (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "iet-calculate")) return;

    try {
      const body = req.body || {};
      const inputs: IETSInputs = {
        referrals: parseMoney(body.referrals, "referrals") / 100,
        revenue: parseMoney(body.revenue, "revenue") / 100,
        retention: parseMoney(body.retention, "retention") / 100,
        skills: parseMoney(body.skills, "skills") / 100,
        agents: parseMoney(body.agents, "agents") / 100,
        reputation: parseMoney(body.reputation, "reputation") / 100,
        age: parseMoney(body.age, "age") / 100,
        compliance: parseMoney(body.compliance, "compliance") / 100,
      };

      const result: IETSResult = calculateIETS(inputs);
      const benefits = getTierBenefits(result.tier);

      res.json({ success: true, ...result, benefits });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "IETS_CALCULATION_FAILED" });
    }
  });

  // ============================================================
  // Settlement Endpoints (Admin only)
  // ============================================================

  app.post("/api/v1/revenue/settle", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "settlement")) return;

    try {
      const body = req.body || {};
      const settlementInputs: SettlementInputs = {
        grossAmount: parseMoney(body.grossAmount, "grossAmount"),
        directCost: parseMoney(body.directCost, "directCost"),
        taxAmount: parseMoney(body.taxAmount, "taxAmount"),
        gatewayFee: parseMoney(body.gatewayFee, "gatewayFee"),
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
        stream: body.stream,
        currency: body.currency ?? "USD",
        idempotencyKey: body.idempotencyKey ?? uuidv4(),
        externalPaymentId: body.externalPaymentId,
        occurredAt: body.occurredAt,
      };

      const settlement = normalizeSettlement(settlementInputs);
      validateSettlementInvariants(settlement);

      // Persist to PostgreSQL
      const journal = new ImmutableLedger().post(settlement);
      await storage.saveSettlement(settlement, settlement.idempotencyKey);

      // Emit outbox event
      outbox.append("Settlement", settlement.idempotencyKey, REVENUE_EVENTS.SETTLEMENT_POSTED, {
        settlement,
        journal,
      });

      res.json({ success: true, settlement, journal });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "SETTLEMENT_FAILED" });
    }
  });

  app.get("/api/v1/revenue/settlements/:idempotencyKey", async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "settlement-get")) return;

    const { idempotencyKey } = req.params;
    const journal = await storage.getJournal(idempotencyKey);
    if (!journal) {
      return res.status(404).json({ success: false, error: "SETTLEMENT_NOT_FOUND" });
    }
    res.json({ success: true, journal });
  });

  // ============================================================
  // Ledger Endpoints
  // ============================================================

  app.get("/api/v1/revenue/ledger/journals", async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "ledger-list")) return;

    const journals = await storage.getAllJournals();
    res.json({ success: true, journals });
  });

  app.get("/api/v1/revenue/ledger/verify", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "ledger-verify")) return;

    const isValid = await storage.verifyChain();
    res.json({ success: true, valid: isValid });
  });

  // ============================================================
  // Metering / Usage Events (Provider routes for recording, User routes for viewing)
  // ============================================================

  app.post("/api/v1/revenue/usage", (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, publicCognitionLimiter, "usage-record")) return;

    try {
      const body = req.body || {};
      const event: UsageEvent = {
        idempotencyKey: body.idempotencyKey ?? uuidv4(),
        userId: body.userId ?? req.header("x-user-id") ?? "anonymous",
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        metricName: body.metricName,
        quantity: parseMoney(body.quantity, "quantity"),
        unit: body.unit,
        occurredAt: body.occurredAt ?? new Date().toISOString(),
        metadata: body.metadata,
      };

      const result = meteringService.recordUsage(event);
      if (!result.accepted) {
        return res.status(400).json({ success: false, error: result.reason });
      }

      // Persist to PostgreSQL
      storage.recordUsageEvent(event).catch(console.error);

      // Emit outbox event
      outbox.append("UsageEvent", event.idempotencyKey, REVENUE_EVENTS.USAGE_RECORDED, event);

      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "USAGE_RECORD_FAILED" });
    }
  });

  // User-scoped: Get own usage (or admin/provider can query any user)
  app.get("/api/v1/revenue/usage/:userId", async (req, res) => {
    const targetUserId = req.params.userId;
    
    // Authorization: admin/provider can query any user, user can only query self
    if (!authorizeProviderRoute(req, res)) {
      if (!authorizeUserRoute(req, res, req.params.userId)) return;
    }
    
    if (!enforceRateLimit(req, res, rateLimiter, "usage-get")) return;

    const { userId } = req.params;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const usage = await storage.getAggregatedUsage(userId, since);
    res.json({ success: true, usage });
  });

  app.get("/api/v1/revenue/usage/:userId/invoice", async (req, res) => {
    const targetUserId = req.params.userId;
    
    if (!authorizeProviderRoute(req, res)) {
      if (!authorizeUserRoute(req, res, req.params.userId)) return;
    }
    
    if (!enforceRateLimit(req, res, rateLimiter, "usage-invoice")) return;

    const { userId } = req.params;
    const periodStart = req.query.periodStart ? new Date(req.query.periodStart as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = req.query.periodEnd ? new Date(req.query.periodEnd as string) : new Date();

    // Use storage for persistent invoice data
    const usage = await storage.getAggregatedUsage(userId);
    const filtered = usage.filter(u => new Date(u.windowStart) >= periodStart && new Date(u.windowStart) <= periodEnd);
    
    const lineItems = filtered.map(u => ({
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
        currency: lineItems[0]?.currency || "USD",
      }
    });
  });

  // ============================================================
  // Wallet Endpoints (User-scoped with canEarn validation)
  // ============================================================

  // User can view own wallet
  app.get("/api/v1/revenue/wallet/:userId", async (req, res) => {
    const targetUserId = req.params.userId;
    
    if (!authorizeProviderRoute(req, res)) {
      if (!authorizeUserRoute(req, res, req.params.userId)) return;
    }
    
    if (!enforceRateLimit(req, res, rateLimiter, "wallet-get")) return;

    try {
      const wallet = await storage.getWallet(req.params.userId);
      if (!wallet) {
        return res.status(404).json({ success: false, error: "WALLET_NOT_FOUND" });
      }
      
      // Add eligibility info
      const eligibility = await storage.getEarnEligibility(req.params.userId);
      
      res.json({ success: true, wallet, eligibility });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : "WALLET_GET_FAILED" });
    }
  });

  // Admin/Provider: Credit wallet (with canEarn validation)
  app.post("/api/v1/revenue/wallet/:userId/credit", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "wallet-credit")) return;

    try {
      const body = req.body || {};
      const { amount, type, referenceId, description } = body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "AMOUNT_REQUIRED_POSITIVE" });
      }

      // Check eligibility (D5)
      const eligibility = await storage.getEarnEligibility(req.params.userId);
      if (!eligibility?.canEarn) {
        return res.status(403).json({ 
          success: false, 
          error: "WALLET_CREDIT_DENIED", 
          message: "User not eligible to earn (free tier or inactive subscription)" 
        });
      }

      const wallet = await storage.creditWallet(
        req.params.userId,
        parseMoney(body.amount, "amount"),
        body.type ?? "settlement",
        body.referenceId ?? uuidv4(),
        body.description ?? "Revenue share credit",
        true // eligibility.canEarn
      );

      res.json({ success: true, wallet });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "WALLET_CREDIT_FAILED" });
    }
  });

  app.post("/api/v1/revenue/wallet/:userId/debit", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "wallet-debit")) return;

    try {
      const body = req.body || {};
      const wallet = await storage.debitWallet(
        req.params.userId,
        parseMoney(body.amount, "amount"),
        body.type ?? "payout",
        body.referenceId ?? uuidv4(),
        body.description ?? "Payout"
      );

      res.json({ success: true, wallet });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "WALLET_DEBIT_FAILED" });
    }
  });

  // User: Get own wallet
  app.get("/api/v1/revenue/my/wallet", async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, "wallet-get")) return;

    const userId = getUserIdFromReq(req);
    try {
      const wallet = await storage.getWallet(userId);
      const eligibility = await storage.getEarnEligibility(userId);
      const contributionPoints = await storage.getTotalContributionPoints(userId);
      
      res.json({ success: true, wallet, eligibility, contributionPoints });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : "WALLET_GET_FAILED" });
    }
  });

  // User: Request payout (debit own wallet)
  app.post("/api/v1/revenue/my/wallet/payout", async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, "wallet-payout")) return;

    const userId = getUserIdFromReq(req);
    try {
      const body = req.body || {};
      const wallet = await storage.debitWallet(
        userId,
        parseMoney(body.amount, "amount"),
        "payout",
        uuidv4(),
        body.description ?? "User requested payout"
      );

      res.json({ success: true, wallet });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "PAYOUT_FAILED" });
    }
  });

  // ============================================================
  // Eligibility Management (Admin)
  // ============================================================

  app.post("/api/v1/revenue/eligibility/:userId", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "eligibility-set")) return;

    try {
      const body = req.body || {};
      await storage.setEarnEligibility(
        req.params.userId,
        body.canEarn ?? false,
        body.tier ?? "STARTER",
        body.subscriptionData
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "ELIGIBILITY_SET_FAILED" });
    }
  });

  app.get("/api/v1/revenue/eligibility/:userId", async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "eligibility-get")) return;

    const eligibility = await storage.getEarnEligibility(req.params.userId);
    res.json({ success: true, eligibility: eligibility ?? { canEarn: false, tier: "STARTER", subscriptionStatus: "free" } });
  });

  // ============================================================
  // Contribution Points (D7 - Auditable)
  // ============================================================

  app.post("/api/v1/revenue/contributions/:userId", async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "contribution-add")) return;

    try {
      const body = req.body || {};
      await storage.addContributionPoints(
        req.params.userId,
        parseMoney(body.points, "points"),
        body.source,
        body.referenceId,
        body.description
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "CONTRIBUTION_FAILED" });
    }
  });

  app.get("/api/v1/revenue/contributions/:userId/total", async (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "contribution-get")) return;

    const total = await storage.getTotalContributionPoints(req.params.userId);
    res.json({ success: true, totalPoints: total });
  });

  // ============================================================
  // Revenue Streams Configuration
  // ============================================================

  app.get("/api/v1/revenue/streams", (req, res) => {
    if (!authorizeProviderRoute(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "streams-list")) return;

    const streams = [
      { stream: "SUBSCRIPTION", name: "Suscripciones Isabella", model: "recurring", baseSplit: { user: 0.0, platform: 1.0 }, dynamicSplit: false },
      { stream: "ISA_API", name: "ISA API Pay-per-token", model: "transactional", baseSplit: { user: 0.7, platform: 0.3 }, dynamicSplit: true },
      { stream: "SKILL_MARKETPLACE", name: "Marketplace de Skills", model: "marketplace", baseSplit: { user: 0.7, platform: 0.3 }, dynamicSplit: true },
      { stream: "AGENT_MARKETPLACE", name: "Marketplace de Agentes", model: "marketplace", baseSplit: { user: 0.7, platform: 0.3 }, dynamicSplit: true },
      { stream: "AGENT_HOSTING", name: "Hosting de Agentes", model: "recurring", baseSplit: { user: 0.0, platform: 1.0 }, dynamicSplit: false },
      { stream: "AI_CLOUD", name: "Sovereign AI Cloud", model: "consumption", baseSplit: { user: 0.0, platform: 1.0 }, dynamicSplit: false },
      { stream: "AGENT_REVENUE_SHARING", name: "Revenue Sharing de Agentes", model: "recurring", baseSplit: { user: 0.7, platform: 0.3 }, dynamicSplit: true },
      { stream: "HYPERAUTOMATION", name: "Hyperautomation", model: "b2b", baseSplit: { user: 0.75, platform: 0.25 }, dynamicSplit: true },
      { stream: "WHITE_LABEL", name: "White Label", model: "enterprise", baseSplit: { user: 0.0, platform: 1.0 }, dynamicSplit: false },
      { stream: "CERTIFICATION", name: "Certificaciones", model: "education", baseSplit: { user: 0.0, platform: 1.0 }, dynamicSplit: false },
      { stream: "DATA_VAULT", name: "Data Vault", model: "data", baseSplit: { user: 0.5, platform: 0.5 }, dynamicSplit: true },
      { stream: "ECOSYSTEM_TREASURY", name: "Ecosystem Treasury", model: "strategic", baseSplit: { user: 0.0, platform: 1.0 }, dynamicSplit: false },
    ];

    res.json({ success: true, streams });
  });

  // ============================================================
  // Stripe Checkout (D3 - Public Checkout Flow)
  // ============================================================

  app.post("/api/v1/billing/checkout", async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, "billing-checkout")) return;

    try {
      const body = req.body || {};
      const { planCode, successUrl, cancelUrl } = body;
      
      if (!planCode) {
        return res.status(400).json({ success: false, error: "PLAN_CODE_REQUIRED" });
      }

      const userId = getUserIdFromReq(req);
      const finalSuccessUrl = successUrl ?? `${req.get("origin")}/billing/success`;
      const finalCancelUrl = cancelUrl ?? `${req.get("origin")}/billing/cancel`;

      const { sessionId, url } = await storage.createCheckoutSession(
        getUserIdFromReq(req),
        body.planCode,
        finalSuccessUrl,
        finalCancelUrl
      );

      res.json({ success: true, sessionId, url, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "CHECKOUT_FAILED" });
    }
  });

  app.post("/api/v1/billing/portal", async (req, res) => {
    if (!enforceRateLimit(req, res, rateLimiter, "billing-portal")) return;
    // Would create Stripe billing portal session
    res.json({ success: true, url: "https://billing.stripe.com/portal" });
  });

  app.post("/api/v1/billing/stripe/webhook", async (req, res) => {
    const sig = req.get("stripe-signature");
    if (!sig) return res.status(400).json({ success: false, error: "MISSING_SIGNATURE" });

    try {
      // In real impl, would verify signature with stripeWebhookSecret
      await storage.handleStripeWebhook(req.body);
      res.json({ success: true, received: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "WEBHOOK_FAILED" });
    }
  });

  // ============================================================
  // Outbox / Inbox Status
  // ============================================================

  app.get("/api/v1/revenue/outbox/status", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "outbox-status")) return;

    // Would query outbox_events table
    res.json({ success: true, pending: 0, published: 0, failed: 0, deadLetter: 0 });
  });

  app.get("/api/v1/revenue/outbox/dead-letter", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "outbox-dlq")) return;

    const deadLetter = outbox.getDeadLetterEvents();
    res.json({ success: true, events: deadLetter });
  });

  app.post("/api/v1/revenue/outbox/retry/:eventId", async (req, res) => {
    if (!authorizeAdmin(req, res)) return;
    if (!enforceRateLimit(req, res, rateLimiter, "outbox-retry")) return;

    const { eventId } = req.params;
    const retried = outbox.retryDeadLetter(eventId);
    res.json({ success: retried, message: retried ? "Event requeued for processing" : "Event not found or not in dead letter" });
  });

  // ============================================================
  // Health / Readiness
  // ============================================================

  app.get("/api/v1/revenue/health", async (req, res) => {
    res.json({
      success: true,
      service: "revenue-fabric",
      version: "4.0.0",
      ledgerValid: await storage.verifyChain(),
      timestamp: new Date().toISOString(),
    });
  });
}
