import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { HF_HUB_ROUTES_VERSION, registerHfHubRoutes } from "../../src/routes/hf-hub";

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

function harness(options: { denyAdmin?: boolean; denyRate?: boolean; catalogThrows?: boolean; ingestThrows?: string } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
  } as unknown as Application;
  registerHfHubRoutes({
    app,
    queryCatalog: async () => {
      if (options.catalogThrows) throw new Error("HF_HUB_HTTP_503");
      return { models: [], datasets: [], disclaimer: "x" };
    },
    ingestDataset: async () => {
      if (options.ingestThrows) throw new Error(options.ingestThrows);
      return { id: "hf:dataset:abc", status: "PENDING_REVIEW" } as never;
    },
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    ...(options.denyAdmin ? { authorizeAdmin: () => false } : {}),
  });
  return handlers;
}

describe("HF Hub routes", () => {
  it("expone una versión de superficie", () => {
    expect(HF_HUB_ROUTES_VERSION).toBe("1.0.0");
  });

  it("GET references devuelve referencias verificadas y niega ejecución", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("GET /api/v1/hf/references")!({ query: {} } as unknown as Request, res);
    const body = captured.body as {
      success: boolean; executionPerformed: boolean; downloaded: boolean; count: number; references: unknown[];
    };
    expect(body.success).toBe(true);
    expect(body.executionPerformed).toBe(false);
    expect(body.downloaded).toBe(false);
    expect(body.count).toBeGreaterThan(0);
    expect(body.references.length).toBe(body.count);
  });

  it("GET references filtra por dominio y respeta el bucket de rate limit", async () => {
    const handlers = harness({ denyRate: true });
    const { res, captured } = makeRes();
    await handlers.get("GET /api/v1/hf/references")!({ query: { domain: "moe" } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();

    const ok = harness();
    const okRes = makeRes();
    await ok.get("GET /api/v1/hf/references")!({ query: { domain: "moe" } } as unknown as Request, okRes.res);
    const body = okRes.captured.body as { references: { domain: string }[] };
    expect(body.references.length).toBeGreaterThan(0);
    expect(body.references.every((r) => r.domain === "moe")).toBe(true);
  });

  it("GET catalog responde el catálogo (viewer)", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("GET /api/v1/hf/catalog")!({ query: { task: "text-generation" } } as unknown as Request, res);
    const body = captured.body as { success: boolean; methodId: string; models: unknown[] };
    expect(body.success).toBe(true);
    expect(body.methodId).toContain("HFHUB");
    expect(Array.isArray(body.models)).toBe(true);
  });

  it("GET catalog falla cerrado con 502 si el Hub falla", async () => {
    const handlers = harness({ catalogThrows: true });
    const { res, captured } = makeRes();
    await handlers.get("GET /api/v1/hf/catalog")!({ query: {} } as unknown as Request, res);
    expect(captured.status).toBe(502);
    expect((captured.body as { success: boolean }).success).toBe(false);
  });

  it("POST ingest exige datasetId", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/hf/ingest")!({ body: {} } as unknown as Request, res);
    expect(captured.status).toBe(400);
    expect(String((captured.body as { error: string }).error)).toMatch(/DATASET_ID_REQUIRED/);
  });

  it("POST ingest propone conocimiento sin admitirlo", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/hf/ingest")!({ body: { datasetId: "org/data" } } as unknown as Request, res);
    const body = captured.body as { success: boolean; knowledgeAdmitted: boolean; authorizationPerformed: boolean };
    expect(body.success).toBe(true);
    expect(body.knowledgeAdmitted).toBe(false);
    expect(body.authorizationPerformed).toBe(false);
  });

  it("POST ingest bloquea si el gate admin deniega", async () => {
    const handlers = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/hf/ingest")!({ body: { datasetId: "org/data" } } as unknown as Request, res);
    expect(captured.body).toBeUndefined();
  });

  it("POST ingest mapea repo inseguro a 400", async () => {
    const handlers = harness({ ingestThrows: "HF_HUB_UNSAFE_REPO_ID" });
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/hf/ingest")!({ body: { datasetId: "../x" } } as unknown as Request, res);
    expect(captured.status).toBe(400);
  });
});
