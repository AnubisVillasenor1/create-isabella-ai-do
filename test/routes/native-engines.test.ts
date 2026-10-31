import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerNativeEnginesRoutes } from "../../src/routes/native-engines";

type Handler = (req: Request, res: Response) => void | Promise<void>;

function harness(opts: { denyGate?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const reg = (m: string) => (p: string, h: Handler) => handlers.set(`${m} ${p}`, h);
  const app = { get: reg("GET"), post: reg("POST") } as unknown as Application;
  registerNativeEnginesRoutes({
    app,
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: (_req, res) => {
      if (opts.denyGate) {
        res.status(401).json({ success: false, error: "UNAUTHORIZED" });
        return false;
      }
      return true;
    },
  });
  return handlers;
}

async function call(handlers: Map<string, Handler>, key: string, body?: unknown) {
  const out = { status: 200, body: undefined as unknown };
  const res = {
    status(c: number) { out.status = c; return this; },
    json(b: unknown) { out.body = b; return this; },
  } as unknown as Response;
  const req = { body, ip: "1.2.3.4", get: () => undefined } as unknown as Request;
  await handlers.get(key)!(req, res);
  return out;
}

describe("Native Engines Ω HTTP surface", () => {
  it("GET /api/v1/native/engines is public and declares no authority or execution", async () => {
    const r = await call(harness(), "GET /api/v1/native/engines");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
    });
    const body = r.body as { engines: Record<string, { state: string }> };
    expect(body.engines.llm?.state).toBe("wired");
    expect(body.engines.moe?.state).toBe("wired");
    expect(body.engines.turbo?.state).toBe("wired");
  });

  it("POST /api/v1/native/llm/generate returns text with a trace id", async () => {
    const r = await call(harness(), "POST /api/v1/native/llm/generate", { prompt: "hola" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, authorizationPerformed: false, executionPerformed: false });
    const body = r.body as { text: string; traceId: string };
    expect(body.text.length).toBeGreaterThan(0);
    expect(body.traceId).toMatch(/^native-llm-/);
  });

  it("POST /api/v1/native/llm/generate validates the prompt", async () => {
    const h = harness();
    expect((await call(h, "POST /api/v1/native/llm/generate", { prompt: "   " })).status).toBe(400);
    expect((await call(h, "POST /api/v1/native/llm/generate", { prompt: "a".repeat(8_001) })).status).toBe(413);
  });

  it("POST /api/v1/native/moe/diagnostics returns computed router balance", async () => {
    const r = await call(harness(), "POST /api/v1/native/moe/diagnostics", {
      inputDim: 3,
      expertCount: 4,
      topK: 2,
      mode: "regression",
      seed: 5,
      inputs: [[0.1, 0.2, 0.3], [0.9, 0.1, 0.0], [0.4, 0.4, 0.4]],
    });
    expect(r.status).toBe(200);
    const body = r.body as { diagnostics: { gini: number; entropyNormalized: number; hardLoads: number[] }; approvalStatus: string };
    expect(body.approvalStatus).toBe("PENDING_REVIEW");
    expect(body.diagnostics.gini).toBeGreaterThanOrEqual(0);
    expect(body.diagnostics.entropyNormalized).toBeLessThanOrEqual(1);
    expect(body.diagnostics.hardLoads).toHaveLength(4);
  });

  it("POST /api/v1/native/moe/diagnostics rejects malformed inputs", async () => {
    const h = harness();
    expect((await call(h, "POST /api/v1/native/moe/diagnostics", { inputDim: 3, expertCount: 4, topK: 2, seed: 1 })).status).toBe(400);
    expect(
      (await call(h, "POST /api/v1/native/moe/diagnostics", {
        inputDim: 3, expertCount: 4, topK: 2, seed: 1, inputs: [[1, 2]],
      })).status,
    ).toBe(400);
    expect(
      (await call(h, "POST /api/v1/native/moe/diagnostics", {
        inputDim: 3, expertCount: 4, topK: 9, seed: 1, inputs: [[1, 2, 3]],
      })).status,
    ).toBe(400);
  });

  it("denies POST routes when the admin gate rejects", async () => {
    const r = await call(harness({ denyGate: true }), "POST /api/v1/native/llm/generate", { prompt: "hola" });
    expect(r.status).toBe(401);
  });
});
