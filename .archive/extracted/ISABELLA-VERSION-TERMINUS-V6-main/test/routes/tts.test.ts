import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { registerTtsRoutes } from "../../src/routes/tts";
import { GenesisTtsEngine } from "../../src/tts/engine";

type Handler = (req: Request, res: Response) => void | Promise<void>;

function harness(opts: { denyGate?: boolean; evidence?: unknown[] } = {}) {
  const handlers = new Map<string, Handler>();
  const reg = (m: string) => (p: string, h: Handler) => handlers.set(`${m} ${p}`, h);
  const app = { get: reg("GET"), post: reg("POST"), delete: reg("DELETE") } as unknown as Application;
  const engine = new GenesisTtsEngine({ env: { GROQ_API_KEY: "k", GROQ_TTS_MODEL: "m" }, native: null, serverTts: async () => ({ provider: "groq", mimeType: "audio/wav", dataUrl: "data:audio/wav;base64,AAAA", bytes: 3 }) });
  registerTtsRoutes({
    app, engine,
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: (_req, res) => { if (opts.denyGate) { res.status(401).json({ success: false, error: "UNAUTHORIZED" }); return false; } return true; },
    recordEvidence: (e) => { opts.evidence?.push(e); },
  });
  return handlers;
}

async function call(handlers: Map<string, Handler>, key: string, body?: unknown, headers: Record<string, string> = { "x-session-id": "session-abc12345" }) {
  const out = { status: 200, body: undefined as unknown };
  const res = { status(c: number) { out.status = c; return this; }, json(b: unknown) { out.body = b; return this; } } as unknown as Response;
  const req = { body, ip: "1.2.3.4", get: (h: string) => headers[h.toLowerCase()] } as unknown as Request;
  await handlers.get(key)!(req, res);
  return out;
}

describe("TTS HTTP surface", () => {
  it("status is public and truthful", async () => {
    const r = await call(harness(), "GET /api/v1/tts/status");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, engine: "genesis-tts-mx-prime", designTargetsNotMeasured: true });
  });

  it("plan returns normalized text, prosody and route without authorizing or executing", async () => {
    const r = await call(harness(), "POST /api/v1/tts/plan", { text: "Cuesta $19 USD. ¡Listo!" });
    expect(r.body).toMatchObject({ success: true, authorizationPerformed: false, executionPerformed: false });
    const b = r.body as { normalizedText: string; plan: { phrases: unknown[] } };
    expect(b.normalizedText).toContain("diecinueve dólares");
    expect(b.plan.phrases.length).toBeGreaterThan(0);
  });

  it("validates input: empty 400, oversize 413, unknown mode ignored", async () => {
    const h = harness();
    expect((await call(h, "POST /api/v1/tts/plan", { text: "  " })).status).toBe(400);
    expect((await call(h, "POST /api/v1/tts/plan", { text: "a".repeat(4001) })).status).toBe(413);
    expect((await call(h, "POST /api/v1/tts/plan", { text: "hola", mode: "NOPE", region: "mars" })).status).toBe(200);
  });

  it("synthesize is gated, returns audio, records evidence, and rejects replayed nonces with 409", async () => {
    const evidence: unknown[] = [];
    const h = harness({ evidence });
    const body = { text: "Texto para sintetizar con el servidor de voz.", mode: "PODCAST", nonce: "nonce-aaaa-1111" };
    const ok = await call(h, "POST /api/v1/tts/synthesize", body);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, status: "audio", backend: "server-tts" });
    expect(evidence).toHaveLength(1);
    expect((await call(h, "POST /api/v1/tts/synthesize", body)).status).toBe(409);
    expect((await call(harness({ denyGate: true }), "POST /api/v1/tts/synthesize", body)).status).toBe(401);
  });

  it("memory learn/erase is scoped to the session header", async () => {
    const h = harness();
    expect((await call(h, "POST /api/v1/tts/memory", { written: "Kubernetes", spoken: "Kúbernetes" })).body).toMatchObject({ success: true, entries: 1 });
    const planned = await call(h, "POST /api/v1/tts/plan", { text: "Uso Kubernetes" });
    expect((planned.body as { normalizedText: string }).normalizedText).toContain("Kúbernetes");
    const other = await call(h, "POST /api/v1/tts/plan", { text: "Uso Kubernetes" }, { "x-session-id": "other-session-99" });
    expect((other.body as { normalizedText: string }).normalizedText).toContain("Kubernetes");
    expect((await call(h, "DELETE /api/v1/tts/memory")).body).toMatchObject({ erased: true });
    expect((await call(h, "POST /api/v1/tts/memory", { written: "x", spoken: "y" })).status).toBe(400);
  });
});
