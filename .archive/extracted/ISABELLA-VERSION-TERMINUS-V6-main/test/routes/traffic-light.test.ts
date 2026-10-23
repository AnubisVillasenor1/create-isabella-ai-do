import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerTrafficLightRoutes } from "../../src/routes/traffic-light";
import { classifyFlow } from "../../src/governance/traffic-light";

type Handler = (req: Request, res: Response) => void;

interface Captured {
  status: number;
  body: unknown;
}

function harness(options: { denyAdmin?: boolean; denyRate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = { post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler) } as unknown as Application;
  registerTrafficLightRoutes({
    app,
    classifyFlow: (input) => classifyFlow(input),
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

describe("Governed Flow Traffic Light Ω routes", () => {
  it("returns an auditable triage and never authorizes nor executes", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/triage")!({ body: { input: "hola, buenos días" } } as unknown as Request, res);
    const body = captured.body as {
      success: boolean;
      authorizationPerformed: boolean;
      executionPerformed: boolean;
      triage: { band: string; route: string; authorityPath: string; fastLane: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
    expect(body.triage.band).toBe("GREEN");
    expect(body.triage.route).toBe("FAST");
    expect(body.triage.fastLane).toBe(true);
    expect(body.triage.authorityPath).toBe("FULL");
  });

  it("classifies a destructive request as RED through the HTTP surface", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/triage")!({ body: { input: "borra permanentemente los registros" } } as unknown as Request, res);
    const body = captured.body as { triage: { band: string; humanReviewRequired: boolean } };
    expect(body.triage.band).toBe("RED");
    expect(body.triage.humanReviewRequired).toBe(true);
  });

  it("fails closed with 400 on missing input", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/triage")!({ body: {} } as unknown as Request, res);
    expect(captured.status).toBe(400);
    expect(String((captured.body as { error: string }).error)).toMatch(/TRAFFIC_INPUT_REQUIRED/);
  });

  it("blocks the endpoint when the admin gate denies", () => {
    const handlers = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/triage")!({ body: { input: "hola" } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });

  it("blocks the endpoint when the rate limit denies", () => {
    const handlers = harness({ denyRate: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/intelligence/triage")!({ body: { input: "hola" } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });
});
