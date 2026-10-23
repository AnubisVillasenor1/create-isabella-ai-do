import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { AffiliateLedger, EconomicLedger, TreasuryRuntime } from "../../src/economy";
import { TREASURY_ROUTES_VERSION, registerTreasuryRoutes } from "../../src/routes/treasury";

type Handler = (req: Request, res: Response) => void | Promise<void>;

function makeRes() {
  const captured = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
}

function harness(options: { denyAdmin?: boolean; denyRate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
  } as unknown as Application;
  const ledger = new EconomicLedger(() => "2026-01-01T00:00:00.000Z");
  registerTreasuryRoutes({
    app,
    ledger,
    treasury: new TreasuryRuntime(ledger),
    affiliates: new AffiliateLedger(ledger),
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    ...(options.denyAdmin ? { authorizeAdmin: () => false } : {}),
  });
  return { handlers, ledger };
}

const call = (handlers: Map<string, Handler>, key: string, body: unknown, params: Record<string, string> = {}) => {
  const { res, captured } = makeRes();
  handlers.get(key)!({ body, params } as unknown as Request, res);
  return captured;
};

describe("Treasury + Affiliates + Fraud routes", () => {
  it("expone una versión de superficie", () => {
    expect(TREASURY_ROUTES_VERSION).toBe("1.0.0");
  });

  it("POST treasury/credit acredita sin mover fondos reales", () => {
    const { handlers } = harness();
    const captured = call(handlers, "POST /api/v3/treasury/credit", { partyId: "creator", amountMinor: "1000" });
    const body = captured.body as Record<string, unknown>;
    expect(captured.status).toBe(200);
    expect(body.fundsMoved).toBe(false);
    expect((body.movement as Record<string, unknown>).balanceMinor).toBe("1000");
    expect(body.ledgerIntegrity).toBe(true);
  });

  it("POST treasury/debit falla cerrado con saldo insuficiente (409)", () => {
    const { handlers } = harness();
    call(handlers, "POST /api/v3/treasury/credit", { partyId: "creator", amountMinor: "100" });
    const captured = call(handlers, "POST /api/v3/treasury/debit", { partyId: "creator", amountMinor: "9999" });
    expect(captured.status).toBe(409);
    expect((captured.body as Record<string, unknown>).error).toBe("TREASURY_INSUFFICIENT_FUNDS");
  });

  it("GET treasury/balance/:partyId reporta el saldo", () => {
    const { handlers } = harness();
    call(handlers, "POST /api/v3/treasury/credit", { partyId: "creator", amountMinor: "250" });
    const captured = call(handlers, "GET /api/v3/treasury/balance/:partyId", undefined, { partyId: "creator" });
    expect((captured.body as Record<string, unknown>).balanceMinor).toBe("250");
  });

  it("POST affiliates/register + attribute acumula comisión", () => {
    const { handlers } = harness();
    const reg = call(handlers, "POST /api/v3/affiliates/register", { affiliateId: "aff", commissionBasisPoints: 2000 });
    expect(reg.status).toBe(200);
    const captured = call(handlers, "POST /api/v3/affiliates/attribute", { affiliateId: "aff", orderMinor: "10000" });
    const body = captured.body as Record<string, unknown>;
    expect((body.commission as Record<string, unknown>).commissionMinor).toBe("2000");
    expect((body.commission as Record<string, unknown>).status).toBe("pending");
  });

  it("POST affiliates/attribute bloquea ante autocombra", () => {
    const { handlers } = harness();
    call(handlers, "POST /api/v3/affiliates/register", { affiliateId: "aff", commissionBasisPoints: 5000 });
    const captured = call(handlers, "POST /api/v3/affiliates/attribute", {
      affiliateId: "aff",
      orderMinor: "10000",
      selfPurchase: true,
    });
    const body = captured.body as Record<string, unknown>;
    expect((body.commission as Record<string, unknown>).status).toBe("blocked");
    expect((body.commission as Record<string, unknown>).commissionMinor).toBe("0");
  });

  it("POST fraud/analyze detecta cuentas relacionadas", () => {
    const { handlers } = harness();
    const captured = call(handlers, "POST /api/v3/fraud/analyze", {
      entities: [
        { id: "a1", kind: "account" },
        { id: "a2", kind: "account" },
        { id: "d1", kind: "device" },
      ],
      edges: [
        { from: "a1", to: "d1", relation: "shares_device" },
        { from: "a2", to: "d1", relation: "shares_device" },
      ],
    });
    const body = captured.body as Record<string, unknown>;
    expect((body.analysis as Record<string, unknown>).verdict).toMatchObject({ decision: "review" });
  });

  it("POST fraud/analyze rechaza un grafo ausente", () => {
    const { handlers } = harness();
    const captured = call(handlers, "POST /api/v3/fraud/analyze", {});
    expect(captured.status).toBe(400);
    expect((captured.body as Record<string, unknown>).error).toBe("FRAUD_GRAPH_REQUIRED");
  });

  it("respeta el admin gate en las rutas mutantes", () => {
    const { handlers } = harness({ denyAdmin: true });
    const captured = call(handlers, "POST /api/v3/treasury/credit", { partyId: "x", amountMinor: "1" });
    expect(captured.body).toBeUndefined();
  });
});
