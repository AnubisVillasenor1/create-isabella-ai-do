import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerCivilizationRoutes } from "../../src/routes/civilization";
import { CIVILIZATION_ROUTES_VERSION } from "../../src/routes/civilization";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";

type Handler = (req: Request, res: Response) => void;

interface Captured {
  status: number;
  body: unknown;
}

function harness(options: { denyAdmin?: boolean; denyRate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = { post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler) } as unknown as Application;
  const runtime = new IsabellaGenesisRuntime();
  registerCivilizationRoutes({
    app,
    runCycle: (input) => runtime.runCivilizationCycle(input),
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    ...(options.denyAdmin ? { authorizeAdmin: () => false } : {}),
  });
  return handlers;
}

function makeRes(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 200, body: undefined };
  const res = {
    status(code: number) { captured.status = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
  };
  return { res: res as unknown as Response, captured };
}

describe("ISABELLA Ω · CCR-1 routes", () => {
  it("expone una versión de superficie", () => {
    expect(CIVILIZATION_ROUTES_VERSION).toBe("1.0.0");
  });

  it("devuelve el ciclo soberano y nunca autoriza ni ejecuta", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/civilization/cycle")!({ body: { input: "hola, buenos días" } } as unknown as Request, res);
    const body = captured.body as {
      success: boolean;
      authorizationPerformed: boolean;
      executionPerformed: boolean;
      cycle: { band: string; authorityPath: string; response: { bookpiHash: string } };
    };
    expect(body.success).toBe(true);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
    expect(body.cycle.authorityPath).toBe("FULL");
    expect(body.cycle.response.bookpiHash).toHaveLength(64);
  });

  it("falla cerrado con 400 si falta la entrada", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/civilization/cycle")!({ body: {} } as unknown as Request, res);
    expect(captured.status).toBe(400);
    expect(String((captured.body as { error: string }).error)).toMatch(/CIVILIZATION_INPUT_REQUIRED/);
  });

  it("bloquea el endpoint si el gate admin deniega", () => {
    const handlers = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/civilization/cycle")!({ body: { input: "hola" } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });

  it("bloquea el endpoint si el rate limit deniega", () => {
    const handlers = harness({ denyRate: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/civilization/cycle")!({ body: { input: "hola" } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });
});
