import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { createInMemoryBookPiStorage, registerPipelineRoutes } from "../../src/routes/pipeline";
import { createCapabilityGate } from "../../src/crown/capability";
import { generateControls } from "../../src/evolution/catalog";
import type { BookPiStorage } from "../../src/bookpi/types";

type Handler = (req: Request, res: Response) => void | Promise<void>;

interface Captured {
  status: number;
  body: unknown;
  jsonCalled: boolean;
}

const MEMORIA = "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS";

function harness(options: { denyAdmin?: boolean; denyRate?: boolean; bookpi?: BookPiStorage } = {}) {
  const handlers = new Map<string, Handler>();
  const app = {
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
  } as unknown as Application;
  registerPipelineRoutes({
    app,
    bookpi: options.bookpi ?? createInMemoryBookPiStorage(),
    gate: createCapabilityGate([
      {
        methodId: MEMORIA,
        owner: "isabella",
        allowedRoles: ["admin", "operator"],
        riskTier: "LOW",
        governanceTier: "AUTONOMOUS",
        humanApprovalRequired: false,
      },
    ]),
    controlsSnapshot: generateControls(),
    enforceRateLimit: () => !options.denyRate,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: () => !options.denyAdmin,
  });
  return handlers;
}

function makeRes(): { res: Response; captured: Captured } {
  const captured: Captured = { status: 200, body: undefined, jsonCalled: false };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      captured.jsonCalled = true;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
}

describe("Pipeline Conductor route", () => {
  it("recorre las etapas y sella evidencia sin ejecutar efectos externos", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/pipeline/execute")!(
      { body: { input: "recupera el resumen de la fase", methodId: MEMORIA } } as unknown as Request,
      res,
    );
    const body = captured.body as {
      success: boolean;
      authorizationPerformed: boolean;
      executionPerformed: boolean;
      result: { passed: boolean; ledger?: unknown; verdicts: unknown[] };
    };
    expect(captured.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.authorizationPerformed).toBe(true);
    expect(body.executionPerformed).toBe(false);
    expect(body.result.passed).toBe(true);
    expect(body.result.ledger).toBeDefined();
    expect(body.result.verdicts).toHaveLength(6);
  });

  it("reports a durable evidence-store outage as 503, not an authorization denial", async () => {
    const volatile = createInMemoryBookPiStorage();
    const failingStorage: BookPiStorage = {
      ...volatile,
      async appendEvent() { throw new Error("BOOKPI: integrity secret is required"); },
    };
    const handlers = harness({ bookpi: failingStorage });
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/pipeline/execute")!(
      { body: { input: "recupera el resumen de la fase", methodId: MEMORIA } } as unknown as Request,
      res,
    );
    const body = captured.body as {
      success: boolean;
      error: string;
      result: { verdicts: Array<{ stage: string; passed: boolean; reason: string }> };
    };
    expect(captured.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe("PIPELINE_EVIDENCE_STORAGE_UNAVAILABLE");
    expect(body.result.verdicts.at(-1)?.reason).toContain("secreto de integridad no configurado");
    expect(body.result.verdicts.at(-1)?.reason).not.toContain("required");
  });

  it("bloquea con método no registrado en la gate (fail-closed)", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/pipeline/execute")!(
      { body: { input: "algo", methodId: "NO.VÁLIDO" } } as unknown as Request,
      res,
    );
    const body = captured.body as { success: boolean; result: { passed: boolean; ledger?: unknown } };
    expect(captured.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.result.passed).toBe(false);
    expect(body.result.ledger).toBeUndefined();
  });

  it("rechaza input vacío antes de gastar una etapa", async () => {
    const handlers = harness();
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/pipeline/execute")!(
      { body: { input: "   ", methodId: MEMORIA } } as unknown as Request,
      res,
    );
    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({ success: false, error: "PIPELINE_INPUT_REQUIRED" });
  });

  it("no responde cuando la autorización admin deniega", async () => {
    const handlers = harness({ denyAdmin: true });
    const { res, captured } = makeRes();
    await handlers.get("POST /api/v1/pipeline/execute")!(
      { body: { input: "hola", methodId: MEMORIA } } as unknown as Request,
      res,
    );
    expect(captured.jsonCalled).toBe(false);
  });
});
