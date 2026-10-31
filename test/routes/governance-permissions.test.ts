import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerOrderPermissionRoutes } from "../../src/routes/governance-permissions";
import {
  buildAllDecisions,
  mapOrderPermissions,
  verifyAuthorizationEnvelope,
  type OrderIntent,
} from "../../src/governance/permission-map";

type Handler = (req: Request, res: Response) => void;

interface Captured {
  status: number;
  body: unknown;
}

const order: OrderIntent = {
  orderId: "ORD-EMAIL-30",
  principalId: "user-1",
  description: "Enviar email a 30 clientes",
  steps: [
    { stepId: "read", methodId: "m.read", description: "leer", action: "read", resource: "clientes", occurrences: 1, baseRisk: "BAJO" },
    { stepId: "send", methodId: "m.send", description: "enviar", action: "send", resource: "email", occurrences: 30, baseRisk: "BAJO" },
    { stepId: "grant", methodId: "m.grant", description: "conceder", action: "grant", resource: "billing", occurrences: 1, baseRisk: "ALTO" },
  ],
};

function harness(denyAdmin = false) {
  const handlers = new Map<string, Handler>();
  const app = { post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler) } as unknown as Application;
  registerOrderPermissionRoutes({
    app,
    mapOrderPermissions: (intent) => mapOrderPermissions(intent),
    verifyOrderAuthorization: (envelope, catalog) => verifyAuthorizationEnvelope(envelope, catalog),
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
    ...(denyAdmin ? { authorizeAdmin: () => false } : {}),
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

describe("Permission Map Ω routes", () => {
  it("maps an order to a leveled permission catalog", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/governance/order-permissions")!({ body: { order } } as unknown as Request, res);
    const body = captured.body as { success: boolean; authorizationPerformed: boolean; executionPerformed: boolean; catalog: { totalPermissions: number; highestLevel: string; checklist: string } };
    expect(body.success).toBe(true);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
    expect(body.catalog.totalPermissions).toBe(3);
    expect(body.catalog.highestLevel).toBe("ALTO");
    expect(body.catalog.checklist).toContain("## ALTO");
  });

  it("rejects a mapping request without an order", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/governance/order-permissions")!({ body: {} } as unknown as Request, res);
    expect(captured.status).toBe(400);
  });

  it("seals a full human authorization and never executes", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    const catalog = mapOrderPermissions(order);
    handlers.get("POST /api/v1/governance/order-authorize")!(
      { body: { order, principalId: "user-1", decisions: buildAllDecisions(catalog, true) } } as unknown as Request,
      res,
    );
    const body = captured.body as { success: boolean; executionPerformed: boolean; verification: { status: string; mayProceed: boolean; responsibility: { clause: string } | null } };
    expect(body.success).toBe(true);
    expect(body.executionPerformed).toBe(false);
    expect(body.verification.status).toBe("AUTHORIZED");
    expect(body.verification.mayProceed).toBe(true);
    expect(body.verification.responsibility?.clause).toMatch(/recaen en el principal humano/);
  });

  it("reports PARTIAL when a critical permission is withheld", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    const catalog = mapOrderPermissions(order);
    const decisions = buildAllDecisions(catalog, true).map((d) => (d.permissionId.endsWith("::grant") ? { ...d, authorized: false } : d));
    handlers.get("POST /api/v1/governance/order-authorize")!(
      { body: { order, principalId: "user-1", decisions } } as unknown as Request,
      res,
    );
    const body = captured.body as { verification: { status: string; mayProceed: boolean } };
    expect(body.verification.status).toBe("PARTIAL");
    expect(body.verification.mayProceed).toBe(false);
  });

  it("rejects an authorization request missing required fields", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/governance/order-authorize")!({ body: { order } } as unknown as Request, res);
    expect(captured.status).toBe(400);
  });

  it("blocks the sealing endpoint when the admin gate denies", () => {
    const handlers = harness(true);
    const { res, captured } = makeRes();
    const catalog = mapOrderPermissions(order);
    handlers.get("POST /api/v1/governance/order-authorize")!(
      { body: { order, principalId: "user-1", decisions: buildAllDecisions(catalog, true) } } as unknown as Request,
      res,
    );
    expect(captured.body).toBeUndefined();
  });
});
