// Isabella native speech HTTP surface (Génesis TTS MX-Prime runtime).
// Planning/status/memory are pure compute and viewer-level; synthesis goes through the provider gate because it
// may call a paid/external backend. Invariant: speech NEVER authorizes or executes anything — it only voices text.
//
// state: engine-generated.
import type { Application, Request, Response } from "express";
import type { GenesisTtsEngine } from "../tts/engine";
import { MX_REGIONS, VOICE_MODES, type MxRegion, type SpeechRequest, type VoiceMode } from "../tts/types";
import type { FixedWindowRateLimiter } from "../security/rate-limit";

export const TTS_ROUTES_VERSION = "1.0.0";
const MAX_PLAN_CHARS = 4_000;

export interface TtsRouteDeps {
  readonly app: Application;
  readonly engine: GenesisTtsEngine;
  readonly enforceRateLimit: (req: Request, res: Response, limiter: FixedWindowRateLimiter, bucket: string) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Gate for backend-calling synthesis (provider gate). */
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  /** Evidence sink (BookPI). Must never throw into the request path. */
  readonly recordEvidence: (event: { traceId: string; backend: string; evidenceHash: string; actor: string }) => void;
}

function actorOf(req: Request): string {
  const h = req.get("x-session-id");
  return h && /^[\w-]{8,128}$/.test(h) ? `session:${h}` : `ip:${req.ip ?? "unknown"}`;
}

function parse(body: unknown, actorId: string): { ok: true; value: SpeechRequest } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = typeof b.text === "string" ? b.text : "";
  if (!text.trim()) return { ok: false, error: "text es requerido" };
  if (text.length > MAX_PLAN_CHARS) return { ok: false, error: "TTS_TEXT_SIZE_LIMIT_EXCEEDED" };
  const mode = typeof b.mode === "string" && (VOICE_MODES as readonly string[]).includes(b.mode) ? (b.mode as VoiceMode) : undefined;
  const region = typeof b.region === "string" && (MX_REGIONS as readonly string[]).includes(b.region) ? (b.region as MxRegion) : undefined;
  const emotionVector: Record<string, number> = {};
  if (b.emotionVector && typeof b.emotionVector === "object") for (const [k, v] of Object.entries(b.emotionVector as Record<string, unknown>).slice(0, 32)) if (typeof v === "number" && Number.isFinite(v)) emotionVector[k] = v;
  const nonce = typeof b.nonce === "string" ? b.nonce : undefined;
  const voice = typeof b.voice === "string" && /^[\w-]{1,40}$/.test(b.voice) ? b.voice : undefined;
  return { ok: true, value: { text, actorId, ...(nonce ? { nonce } : {}), ...(mode ? { mode } : {}), ...(region ? { region } : {}), ...(Object.keys(emotionVector).length ? { emotionVector } : {}), ...(voice ? { voice } : {}) } };
}

export function registerTtsRoutes(deps: TtsRouteDeps): void {
  const { app, engine } = deps;

  app.get("/api/v1/tts/status", async (_req, res) => {
    res.json({ success: true, ...(await engine.status()) });
  });

  app.post("/api/v1/tts/plan", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "tts-plan")) return;
    const parsed = parse(req.body, actorOf(req));
    if (!parsed.ok) { res.status(parsed.error === "TTS_TEXT_SIZE_LIMIT_EXCEEDED" ? 413 : 400).json({ success: false, error: parsed.error }); return; }
    const { traceId, normalizedText, plan, route } = engine.plan(parsed.value);
    res.json({ success: true, authorizationPerformed: false, executionPerformed: false, traceId, normalizedText, plan, route });
  });

  app.post("/api/v1/tts/synthesize", async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "tts-synthesize")) return;
    const actor = actorOf(req);
    const parsed = parse(req.body, actor);
    if (!parsed.ok) { res.status(parsed.error === "TTS_TEXT_SIZE_LIMIT_EXCEEDED" ? 413 : 400).json({ success: false, error: parsed.error }); return; }
    const result = await engine.synthesize(parsed.value);
    if (result.status === "denied") { res.status(result.reason === "NONCE_REPLAY_DETECTED" ? 409 : result.reason === "TEXT_TOO_LONG" ? 413 : 400).json({ success: false, error: result.reason, traceId: result.traceId }); return; }
    try { deps.recordEvidence({ traceId: result.traceId, backend: result.backend, evidenceHash: result.evidenceHash, actor }); } catch { /* evidence sink must not break speech */ }
    res.json({ success: true, authorizationPerformed: false, executionPerformed: false, ...result });
  });

  app.post("/api/v1/tts/memory", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "tts-memory")) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    try {
      engine.memory.learn(actorOf(req), String(b.written ?? ""), String(b.spoken ?? ""));
      res.json({ success: true, entries: engine.memory.count(actorOf(req)) });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : "TTS_MEMORY_ERROR" });
    }
  });

  app.delete("/api/v1/tts/memory", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "tts-memory")) return;
    res.json({ success: true, erased: engine.memory.forget(actorOf(req)) });
  });
}
