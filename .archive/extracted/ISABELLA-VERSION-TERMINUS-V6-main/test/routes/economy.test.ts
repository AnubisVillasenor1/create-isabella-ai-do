import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { EconomicLedger } from "../../src/economy";
import { ECONOMY_ROUTES_VERSION, registerEconomyRoutes } from "../../src/routes/economy";

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
  registerEconomyRoutes({
    app,
    ledger,
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    ...(options.denyAdmin ? { authorizeAdmin: () => false } : {}),
  });
  return { handlers, ledger };
}

function req(body: unknown): Request {
  return { body } as unknown as Request;
}

describe("Economy API v3 routes", () => {
  it("expone una versión de superficie", () => {
    expect(ECONOMY_ROUTES_VERSION).toBe("1.0.0");
  });

  it("POST economy/calculate valúa y cotiza sin mover fondos", () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v3/economy/calculate")!(
      req({ valuation: { quality: 100, demand: 100, scarcity: 100, evidenceCoverage: 100 } }),
      res,
    );
    const body = captured.body as Record<string, unknown>;
    expect(captured.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.fundsMoved).toBe(false);
    expect((body.valuation as Record<string, unknown>).score).toBe(100);
    expect((body.pricing as Record<string, unknown>).finalPriceMinor).toBe(100_000);
  });

  it("POST economy/calculate rechaza cuerpo sin valuación", () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v3/economy/calculate")!(req({}), res);
    expect(captured.status).toBe(400);
    expect((captured.body as Record<string, unknown>).error).toBe("ECONOMY_VALUATION_REQUIRED");
  });

  it("POST economy/settle planifica regalías y sella evidencia", () => {
    const { handlers, ledger } = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v3/economy/settle")!(
      req({
        totalMinor: "1000",
        parties: [
          { partyId: "creator", role: "creator", basisPoints: 7000 },
          { partyId: "platform", role: "platform", basisPoints: 3000 },
        ],
      }),
      res,
    );
    const body = captured.body as Record<string, unknown>;
    expect(captured.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.fundsMoved).toBe(false);
    expect((body.plan as Record<string, unknown>).distributedMinor).toBe("1000");
    expect(body.ledgerIntegrity).toBe(true);
    expect(ledger.size()).toBe(1);
  });

  it("POST economy/settle respeta el admin gate", () => {
    const { handlers } = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v3/economy/settle")!(req({ totalMinor: "10", parties: [] }), res);
    expect(captured.body).toBeUndefined();
    expect(captured.status).toBe(200);
  });

  it("POST economy/settle rechaza total o partes inválidas", () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v3/economy/settle")!(req({ totalMinor: "abc", parties: [] }), res);
    expect(captured.status).toBe(400);
    expect((captured.body as Record<string, unknown>).error).toBe("ECONOMY_TOTAL_MINOR_INVALID");

    const bad = makeRes();
    handlers.get("POST /api/v3/economy/settle")!(
      req({ totalMinor: "100", parties: [{ partyId: "a", role: "creator", basisPoints: 5000 }] }),
      bad.res,
    );
    expect(bad.captured.status).toBe(400);
    expect((bad.captured.body as Record<string, unknown>).error).toBe("ECONOMY_SETTLEMENT_INVALID");
  });

  it("GET economy/ledger reporta tamaño e integridad", () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v3/economy/ledger")!({} as unknown as Request, res);
    const body = captured.body as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.count).toBe(0);
    expect(body.integrity).toBe(true);
    expect(body.head).toBeNull();
  });
});
