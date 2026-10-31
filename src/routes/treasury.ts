import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import {
  analyzeFraudGraph,
  type AffiliateLedger,
  type EconomicLedger,
  type FraudEdge,
  type FraudEntity,
  type TreasuryRuntime,
} from '../economy';

// ISABELLA Ω · SCER Treasury + Affiliates + Fraud API v3 (state: draft | engine-generated).
// Expone la bóveda de saldos por parte, la red de afiliados y el análisis del grafo
// antifraude. Invariante: mover saldos aquí es contabilidad interna (fundsMoved:false),
// NO transfiere dinero real; las rutas mutantes son admin-gated y analizar fraude sólo
// eleva la revisión humana (nunca sanciona irreversiblemente).

export const TREASURY_ROUTES_VERSION = '1.0.0' as const;
export const TREASURY_METHOD_ID = 'I.YUN.TREASURY.move_funds.v1.0.0.HIGH.TERRITORIAL' as const;
export const AFFILIATE_METHOD_ID =
  'I.YUN.AFFILIATE.attribute_conversion.v1.0.0.MEDIUM.TERRITORIAL' as const;
export const FRAUD_METHOD_ID = 'I.YUN.FRAUD.analyze_graph.v1.0.0.MEDIUM.TERRITORIAL' as const;

export interface TreasuryRouteDeps {
  readonly app: Application;
  readonly ledger: EconomicLedger;
  readonly treasury: TreasuryRuntime;
  readonly affiliates: AffiliateLedger;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate. When omitted, no token is required (development). */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMinor(value: unknown): bigint | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  return null;
}

function fail(res: Response, error: unknown): void {
  const message = (error as Error).message || 'TREASURY_ERROR';
  const status = message.startsWith('TREASURY_INSUFFICIENT_FUNDS') ? 409 : 400;
  res.status(status).json({ success: false, error: message });
}

export function registerTreasuryRoutes(deps: TreasuryRouteDeps): void {
  const { app } = deps;

  app.get('/api/v3/treasury/balance/:partyId', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'treasury-balance')) return;
    const partyId = String(req.params.partyId ?? '');
    try {
      res.json({
        success: true,
        methodId: TREASURY_METHOD_ID,
        fundsMoved: false,
        partyId,
        balanceMinor: deps.treasury.balance(partyId).toString(),
      });
    } catch (error) {
      fail(res, error);
    }
  });

  const move =
    (kind: 'credit' | 'debit') =>
    (req: Request, res: Response): void => {
      if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
      if (!deps.enforceRateLimit(req, res, deps.rateLimiter, `treasury-${kind}`)) return;
      if (!isRecord(req.body)) {
        res.status(400).json({ success: false, error: 'TREASURY_BODY_REQUIRED' });
        return;
      }
      const partyId = typeof req.body.partyId === 'string' ? req.body.partyId.trim() : '';
      const amountMinor = parseMinor(req.body.amountMinor);
      if (!partyId) {
        res.status(400).json({ success: false, error: 'TREASURY_PARTY_REQUIRED' });
        return;
      }
      if (amountMinor === null || amountMinor <= 0n) {
        res.status(400).json({ success: false, error: 'TREASURY_AMOUNT_INVALID' });
        return;
      }
      try {
        const reference = typeof req.body.reference === 'string' ? req.body.reference : undefined;
        const movement =
          kind === 'credit'
            ? deps.treasury.credit(partyId, amountMinor, reference)
            : deps.treasury.debit(partyId, amountMinor, reference);
        res.json({
          success: true,
          methodId: TREASURY_METHOD_ID,
          fundsMoved: false,
          authorizationPerformed: false,
          movement,
          ledgerIntegrity: deps.ledger.verifyIntegrity(),
        });
      } catch (error) {
        fail(res, error);
      }
    };

  app.post('/api/v3/treasury/credit', (req, res) => move('credit')(req, res));
  app.post('/api/v3/treasury/debit', (req, res) => move('debit')(req, res));

  app.post('/api/v3/affiliates/register', (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'affiliates-register')) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: 'AFFILIATE_BODY_REQUIRED' });
      return;
    }
    const affiliateId = typeof req.body.affiliateId === 'string' ? req.body.affiliateId.trim() : '';
    if (!affiliateId) {
      res.status(400).json({ success: false, error: 'AFFILIATE_NOT_REGISTERED' });
      return;
    }
    try {
      const affiliate = deps.affiliates.register(
        affiliateId,
        Number(req.body.commissionBasisPoints)
      );
      res.json({ success: true, methodId: AFFILIATE_METHOD_ID, fundsMoved: false, affiliate });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post('/api/v3/affiliates/attribute', (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'affiliates-attribute')) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: 'AFFILIATE_BODY_REQUIRED' });
      return;
    }
    const orderMinor = parseMinor(req.body.orderMinor);
    if (orderMinor === null || orderMinor <= 0n) {
      res.status(400).json({ success: false, error: 'AFFILIATE_ORDER_INVALID' });
      return;
    }
    try {
      const result = deps.affiliates.attribute({
        affiliateId: String(req.body.affiliateId ?? ''),
        orderMinor,
        selfPurchase: req.body.selfPurchase === true,
        duplicateConversion: req.body.duplicateConversion === true,
        automatedClicks: req.body.automatedClicks === true,
        relatedAccounts: req.body.relatedAccounts === true,
        credentialReuse: req.body.credentialReuse === true,
        reference: typeof req.body.reference === 'string' ? req.body.reference : undefined,
      });
      res.json({
        success: true,
        methodId: AFFILIATE_METHOD_ID,
        fundsMoved: false,
        authorizationPerformed: false,
        commission: result,
      });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post('/api/v3/fraud/analyze', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'fraud-analyze')) return;
    if (
      !isRecord(req.body) ||
      !Array.isArray(req.body.entities) ||
      !Array.isArray(req.body.edges)
    ) {
      res.status(400).json({ success: false, error: 'FRAUD_GRAPH_REQUIRED' });
      return;
    }
    try {
      const analysis = analyzeFraudGraph(
        req.body.entities as FraudEntity[],
        req.body.edges as FraudEdge[]
      );
      res.json({
        success: true,
        methodId: FRAUD_METHOD_ID,
        fundsMoved: false,
        authorizationPerformed: false,
        analysis,
      });
    } catch (error) {
      fail(res, error);
    }
  });
}
