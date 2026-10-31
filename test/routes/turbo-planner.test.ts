import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerTurboPlannerRoutes } from "../../src/routes/turbo-planner";
import { planTurboRoute, type TurboRequest } from "../../src/intelligence/turbo-planner";

type Handler = (req: Request, res: Response) => void;

interface Captured {
  status: number;
  body: unknown;
}

function harness(options: { denyAdmin?: boolean; denyRate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = { post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler) } as unknown as Application;
  registerTurboPlannerRoutes({
    app,
    planTurboRoute: (request) => planTurboRoute(request),
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

const request: TurboRequest = {
  intent: "genera el informe",
  inputTokens: 300,
  riskTier: "LOW",
  principalId: "user-1",
  federationId: 1,
};

describe("Turbo Route Planner Ω routes", () => {
  it("returns an auditable plan and never authorizes nor executes", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/turbo-plan")!({ body: { request } } as unknown as Request, res);
    const body = captured.body as { success: boolean; authorizationPerformed: boolean; executionPerformed: boolean; plan: { route: string; authorityPath: string; cachePolicy: string } };
    expect(body.success).toBe(true);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
    expect(body.plan.route).toBe("FAST");
    expect(body.plan.authorityPath).toBe("FULL");
    expect(body.plan.cachePolicy).toBe("SEMANTIC");
  });

  it("rejects a request without a planning payload", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/turbo-plan")!({ body: {} } as unknown as Request, res);
    expect(captured.status).toBe(400);
  });

  it("fails closed with 400 on malformed input", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/turbo-plan")!({ body: { request: { ...request, intent: "" } } } as unknown as Request, res);
    expect(captured.status).toBe(400);
    expect(String((captured.body as { error: string }).error)).toMatch(/TURBO_INTENT_REQUIRED/);
  });

  it("blocks the endpoint when the admin gate denies", () => {
    const handlers = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/turbo-plan")!({ body: { request } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });

  it("blocks the endpoint when the rate limit denies", () => {
    const handlers = harness({ denyRate: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/turbo-plan")!({ body: { request } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });
});
