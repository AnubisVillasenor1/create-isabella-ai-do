import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import {
  CUSTOMIZATION_CATALOG,
  CustomizationRegistry,
  buildMarketplaceCatalog,
  buildMarketplaceSnapshot,
  planMarketplaceEnablement,
  resolveMarketplacePack,
  type MarketplaceInventory,
} from "../../src/customization";
import { MARKETPLACE_ROUTES_VERSION, registerMarketplaceRoutes } from "../../src/routes/marketplace";

type Handler = (req: Request, res: Response) => void | Promise<void>;

function makeRes() {
  const captured = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { captured.status = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
  };
  return { res: res as unknown as Response, captured };
}

function buildRegistry(): CustomizationRegistry {
  const registry = new CustomizationRegistry();
  for (const entry of CUSTOMIZATION_CATALOG) registry.register(entry);
  return registry;
}

const INVENTORY: MarketplaceInventory = {
  customizations: CUSTOMIZATION_CATALOG.length,
  skills: 0,
  tools: 0,
  protocols: 0,
  modules: 0,
  capabilities: 0,
};

function harness(options: { denyAdmin?: boolean; denyRate?: boolean; omitAdmin?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
  } as unknown as Application;
  const registry = buildRegistry();
  registerMarketplaceRoutes({
    app,
    catalog: () => buildMarketplaceCatalog(registry),
    detail: (id) => registry.get(id),
    snapshot: () => buildMarketplaceSnapshot(registry, INVENTORY),
    pack: (id) => {
      const entry = registry.get(id);
      return entry && entry.kind === "plugin" ? resolveMarketplacePack(entry, registry) : undefined;
    },
    plan: (id) => {
      const entry = registry.get(id);
      return entry && entry.kind === "plugin"
        ? planMarketplaceEnablement(resolveMarketplacePack(entry, registry))
        : undefined;
    },
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    ...(!options.omitAdmin ? { authorizeAdmin: () => !options.denyAdmin } : {}),
  });
  return handlers;
}

const KIT = "isabella.plugin.antigravity-kit";

describe("Marketplace routes", () => {
  it("expone una versión de superficie", () => {
    expect(MARKETPLACE_ROUTES_VERSION).toBe("1.0.0");
  });

  it("GET customization/catalog lista el catálogo nativo (viewer)", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/customization/catalog")!({} as unknown as Request, res);
    const body = captured.body as { success: boolean; count: number; authorizationPerformed: boolean };
    expect(body.success).toBe(true);
    expect(body.count).toBe(CUSTOMIZATION_CATALOG.length);
    expect(body.authorizationPerformed).toBe(false);
  });

  it("GET customization/catalog/:id devuelve el detalle", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/customization/catalog/:id")!({ params: { id: KIT } } as unknown as Request, res);
    const body = captured.body as { success: boolean; entry: { id: string; kind: string } };
    expect(body.success).toBe(true);
    expect(body.entry.id).toBe(KIT);
    expect(body.entry.kind).toBe("plugin");
  });

  it("GET customization/catalog/:id responde 404 si no existe", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/customization/catalog/:id")!({ params: { id: "nope" } } as unknown as Request, res);
    expect(captured.status).toBe(404);
  });

  it("GET marketplace responde la instantánea sin autorizar", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/marketplace")!({} as unknown as Request, res);
    const body = captured.body as { success: boolean; authorizationPerformed: boolean; executionPerformed: boolean; digest: string };
    expect(body.success).toBe(true);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
    expect(body.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("GET marketplace/:packId resuelve el pack", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/marketplace/:packId")!({ params: { packId: KIT } } as unknown as Request, res);
    const body = captured.body as { success: boolean; pack: { id: string; enabled: boolean; missing: string[] } };
    expect(body.success).toBe(true);
    expect(body.pack.id).toBe(KIT);
    expect(body.pack.enabled).toBe(false);
    expect(body.pack.missing).toEqual([]);
  });

  it("GET marketplace/:packId responde 404 si no es un pack", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/marketplace/:packId")!({ params: { packId: "isabella.rule.invariant" } } as unknown as Request, res);
    expect(captured.status).toBe(404);
  });

  it("POST marketplace/plan exige packId", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/marketplace/plan")!({ body: {} } as unknown as Request, res);
    expect(captured.status).toBe(400);
    expect(String((captured.body as { error: string }).error)).toMatch(/PACK_ID_REQUIRED/);
  });

  it("POST marketplace/plan produce un plan no habilitado", () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/marketplace/plan")!({ body: { packId: KIT } } as unknown as Request, res);
    const body = captured.body as { success: boolean; status: string; enabled: boolean; authorizationPerformed: boolean; executionPerformed: boolean };
    expect(body.success).toBe(true);
    expect(body.status).toBe("PLANNED_NOT_ENABLED");
    expect(body.enabled).toBe(false);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
  });

  it("POST marketplace/plan respeta el gate admin", () => {
    const handlers = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/marketplace/plan")!({ body: { packId: KIT } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });

  it("falla cerrado si no existe el admin gate", () => {
    const handlers = harness({ omitAdmin: true });
    const { res, captured } = makeRes();
    handlers.get("POST /api/v1/marketplace/plan")!({ body: { packId: KIT } } as unknown as Request, res);
    expect(captured.status).toBe(503);
    expect((captured.body as { error: string }).error).toBe("MARKETPLACE_ADMIN_GATE_UNAVAILABLE");
  });

  it("respeta el rate limit", () => {
    const handlers = harness({ denyRate: true });
    const { res, captured } = makeRes();
    handlers.get("GET /api/v1/marketplace")!({} as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });
});
