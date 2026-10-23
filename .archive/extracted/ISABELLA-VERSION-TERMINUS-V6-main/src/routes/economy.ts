// ISABELLA Ω · SCER Economy API v3 (state: draft | engine-generated) expone el núcleo
// económico: valuación de activos cognitivos, cotización dinámica, plan de regalías y
// consulta del libro económico append-only.
//
// Invariante: calcular, cotizar y planificar NO mueven fondos y NO conceden autoridad.
// Toda respuesta declara `fundsMoved:false`; el asiento del libro es evidencia, no un pago.
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../security/rate-limit";
import {
  EconomicLedger,
  planRoyaltyDistribution,
  quotePrice,
  valuateAsset,
  type EconomicEvent,
  type RoyaltyParty,
} from "../economy";

export const ECONOMY_ROUTES_VERSION = "1.0.0" as const;
export const ECONOMY_METHOD_ID = "I.YUN.ECONOMY.settle_royalties.v1.0.0.LOW.TERRITORIAL" as const;

export interface EconomyRouteDeps {
  readonly app: Application;
  readonly ledger: EconomicLedger;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string,
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate. When omitted, no token is required (development). */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMinor(value: unknown): bigint | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return null;
}

export function registerEconomyRoutes(deps: EconomyRouteDeps): void {
  const { app } = deps;

  app.post("/api/v3/economy/calculate", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "economy-calculate")) return;
    const body: unknown = req.body;
    if (!isRecord(body) || !isRecord(body.valuation)) {
      res.status(400).json({ success: false, error: "ECONOMY_VALUATION_REQUIRED" });
      return;
    }
    try {
      const signals = {
        quality: Number(body.valuation.quality),
        demand: Number(body.valuation.demand),
        scarcity: Number(body.valuation.scarcity),
        evidenceCoverage: Number(body.valuation.evidenceCoverage),
      };
      const valuation = valuateAsset(signals);
      const pricingInput = isRecord(body.pricing) ? body.pricing : {};
      const basePriceMinor =
        pricingInput.basePriceMinor === undefined ? valuation.baseValueMinor : Number(pricingInput.basePriceMinor);
      const pricing = quotePrice({
        basePriceMinor,
        demandMultiplier: pricingInput.demandMultiplier as number | undefined,
        computeMultiplier: pricingInput.computeMultiplier as number | undefined,
        scarcityMultiplier: pricingInput.scarcityMultiplier as number | undefined,
        riskMultiplier: pricingInput.riskMultiplier as number | undefined,
        loyaltyDiscount: pricingInput.loyaltyDiscount as number | undefined,
      });
      res.json({
        success: true,
        methodId: ECONOMY_METHOD_ID,
        fundsMoved: false,
        authorizationPerformed: false,
        valuation,
        pricing,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: "ECONOMY_CALCULATION_INVALID", detail: (error as Error).message });
    }
  });

  app.post("/api/v3/economy/settle", (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "economy-settle")) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: "ECONOMY_BODY_REQUIRED" });
      return;
    }
    const totalMinor = parseMinor(req.body.totalMinor);
    if (totalMinor === null) {
      res.status(400).json({ success: false, error: "ECONOMY_TOTAL_MINOR_INVALID" });
      return;
    }
    const rawParties = req.body.parties;
    if (!Array.isArray(rawParties)) {
      res.status(400).json({ success: false, error: "ECONOMY_PARTIES_REQUIRED" });
      return;
    }
    try {
      const parties: RoyaltyParty[] = rawParties.map((entry) => {
        if (!isRecord(entry)) throw new Error("Royalty party must be an object.");
        return {
          partyId: String(entry.partyId ?? ""),
          role: String(entry.role ?? "") as RoyaltyParty["role"],
          basisPoints: Number(entry.basisPoints),
        };
      });
      const plan = planRoyaltyDistribution(totalMinor, parties);
      const reference = typeof req.body.reference === "string" ? req.body.reference : undefined;
      const event = deps.ledger.append({
        kind: "settlement.computed",
        payload: { totalMinor: plan.totalMinor, distributedMinor: plan.distributedMinor, shares: plan.shares, reference },
      });
      res.json({
        success: true,
        methodId: ECONOMY_METHOD_ID,
        fundsMoved: false,
        authorizationPerformed: false,
        plan,
        ledgerEvent: { sequence: event.sequence, id: event.id, hash: event.hash },
        ledgerIntegrity: deps.ledger.verifyIntegrity(),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: "ECONOMY_SETTLEMENT_INVALID", detail: (error as Error).message });
    }
  });

  app.get("/api/v3/economy/ledger", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "economy-ledger")) return;
    const head: EconomicEvent | null = deps.ledger.head();
    res.json({
      success: true,
      methodId: ECONOMY_METHOD_ID,
      fundsMoved: false,
      count: deps.ledger.size(),
      integrity: deps.ledger.verifyIntegrity(),
      head,
    });
  });
}
