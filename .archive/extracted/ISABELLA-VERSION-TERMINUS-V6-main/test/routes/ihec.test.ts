import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { createIhec } from "../../src/ihec";
import { IHEC_ROUTES_VERSION, registerIhecRoutes } from "../../src/routes/ihec";

type Handler = (req: Request, res: Response) => unknown;

interface Captured {
  status: number;
  body: unknown;
}

function makeRes(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 200, body: undefined };
  const res = {
    status(code: number) { captured.status = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
  };
  return { res: res as unknown as Response, captured };
}

function harness(options: { denyAdmin?: boolean; denyRate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
  } as unknown as Application;
  const ihec = createIhec();
  registerIhecRoutes({
    app,
    ihec,
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    ...(options.denyAdmin ? { authorizeAdmin: () => false } : {}),
  });
  return { handlers, ihec };
}

describe("IHEC emergency routes", () => {
  it("expone una versión de superficie", () => {
    expect(IHEC_ROUTES_VERSION).toBe("1.0.0");
  });

  it("GET status responde el resumen (viewer)", () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/emergency/status")!({} as unknown as Request, res);
    const body = captured.body as { success: boolean; version: string; subsystems: number; authorizationPerformed: boolean };
    expect(body.success).toBe(true);
    expect(body.version).toBe("3.1.0");
    expect(body.subsystems).toBe(12);
    expect(body.authorizationPerformed).toBe(false);
  });

  it("GET status respeta el rate limit", () => {
    const { handlers } = harness({ denyRate: true });
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/emergency/status")!({} as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });

  it("POST snapshot está admin-gated", () => {
    const { handlers } = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/emergency/snapshot")!({ body: {} } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });

  it("POST snapshot sella y POST recover verifica integridad", () => {
    const { handlers } = harness();
    const snapRes = makeRes();
    handlers.get("POST /api/v1/emergency/snapshot")!({ body: { state: { a: 1 } } } as unknown as Request, snapRes.res);
    const snapshot = snapRes.captured.body as { hash: string };
    expect(snapshot.hash).toHaveLength(128);

    const recRes = makeRes();
    handlers.get("POST /api/v1/emergency/recover")!(
      { body: { snapshot: { state: { a: 1 }, memory: [], embeddings: [], graph: {}, credentials: {}, hash: snapshot.hash, capturedAt: "" } } } as unknown as Request,
      recRes.res,
    );
    expect(recRes.captured.status).toBe(200);
    expect((recRes.captured.body as { integrityVerified: boolean }).integrityVerified).toBe(true);
  });

  it("POST recover exige snapshot (400)", () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/emergency/recover")!({ body: {} } as unknown as Request, res);
    expect(captured.status).toBe(400);
  });

  it("GET cache / crisis / mutation / topology responden", () => {
    const { handlers } = harness();
    for (const path of [
      "GET /api/v1/emergency/cache",
      "GET /api/v1/emergency/crisis",
      "GET /api/v1/emergency/mutation",
      "GET /api/v1/emergency/governance",
      "GET /api/v1/emergency/telemetry",
    ]) {
      const { res, captured } = makeRes();
      handlers.get(path)!({ query: {} } as unknown as Request, res);
      expect((captured.body as { success: boolean }).success).toBe(true);
    }
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/emergency/topology")!({ query: { federation: "fed-9" } } as unknown as Request, res);
    expect((captured.body as { plan: { federation: string } }).plan.federation).toBe("fed-9");
  });

  it("POST failover registra gobernanza y planifica topología", () => {
    const { handlers, ihec } = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/emergency/failover")!({ body: { federation: "fed-2", reason: "test" } } as unknown as Request, res);
    const body = captured.body as { success: boolean; plan: { status: string }; governance: unknown[] };
    expect(body.success).toBe(true);
    expect(body.plan.status).toBe("reconfigured");
    expect(ihec.governance.trail()).toHaveLength(1);
  });

  it("POST rag puntúa candidatos", () => {
    const { handlers } = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/emergency/rag")!(
      { body: { query: "hola", candidates: [{ id: "a", text: "hola mundo", vectorScore: 0.9 }] } } as unknown as Request,
      res,
    );
    const body = captured.body as { result: { hits: { id: string }[] } };
    expect(body.result.hits[0]?.id).toBe("a");
  });
});
