// Isabella native speech HTTP surface (Génesis TTS MX-Prime runtime).
// Planning/status/memory are pure compute and viewer-level; synthesis goes through the provider gate because it
// may call a paid/external backend. Invariant: speech NEVER authorizes or executes anything — it only voices text.
//
// state: engine-generated.
import type { Application, Request, Response } from 'express';
import type { GenesisTtsEngine } from '../tts/engine';
import { BargeInRegistry } from '../tts/streaming';
import {
  MX_REGIONS,
  VOICE_MODES,
  type MxRegion,
  type SpeechRequest,
  type VoiceMode,
} from '../tts/types';
import type { FixedWindowRateLimiter } from '../security/rate-limit';

export const TTS_ROUTES_VERSION = '1.0.0';
const MAX_PLAN_CHARS = 4_000;
const MAX_PUBLIC_SPEECH_CHARS = 1_200;

export interface TtsRouteDeps {
  readonly app: Application;
  readonly engine: GenesisTtsEngine;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Dedicated quota for the credential-free public voice surface. */
  readonly publicVoiceLimiter?: FixedWindowRateLimiter;
  /** Gate for backend-calling synthesis (provider gate). */
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  /** Evidence sink (BookPI). Must never throw into the request path. */
  readonly recordEvidence: (event: {
    traceId: string;
    backend: string;
    evidenceHash: string;
    actor: string;
  }) => void;
  /** Optional latch override for tests; a process-local registry is created otherwise. */
  readonly bargeIn?: BargeInRegistry;
}

function startEventStream(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

function writeEvent(
  res: Response,
  event: string,
  payload: Record<string, unknown>
): 'ended' | 'written' | 'backpressure' {
  if (res.writableEnded || res.destroyed) return 'ended';
  return res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
    ? 'written'
    : 'backpressure';
}

function waitForDrain(res: Response, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      res.off('drain', finish);
      res.off('close', finish);
      resolve();
    };
    timer = setTimeout(finish, timeoutMs);
    res.once('drain', finish);
    res.once('close', finish);
  });
}

function actorOf(req: Request): string {
  const h = req.get('x-session-id');
  return h && /^[\w-]{8,128}$/.test(h) ? `session:${h}` : `ip:${req.ip ?? 'unknown'}`;
}

function parse(
  body: unknown,
  actorId: string,
  maxChars = MAX_PLAN_CHARS
): { ok: true; value: SpeechRequest } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = typeof b.text === 'string' ? b.text : '';
  if (!text.trim()) return { ok: false, error: 'text es requerido' };
  if (text.length > maxChars) return { ok: false, error: 'TTS_TEXT_SIZE_LIMIT_EXCEEDED' };
  const mode =
    typeof b.mode === 'string' && (VOICE_MODES as readonly string[]).includes(b.mode)
      ? (b.mode as VoiceMode)
      : undefined;
  const region =
    typeof b.region === 'string' && (MX_REGIONS as readonly string[]).includes(b.region)
      ? (b.region as MxRegion)
      : undefined;
  const emotionVector: Record<string, number> = {};
  if (b.emotionVector && typeof b.emotionVector === 'object')
    for (const [k, v] of Object.entries(b.emotionVector as Record<string, unknown>).slice(0, 32))
      if (typeof v === 'number' && Number.isFinite(v)) emotionVector[k] = v;
  const nonce = typeof b.nonce === 'string' ? b.nonce : undefined;
  return {
    ok: true,
    value: {
      text,
      actorId,
      ...(nonce ? { nonce } : {}),
      ...(mode ? { mode } : {}),
      ...(region ? { region } : {}),
      ...(Object.keys(emotionVector).length ? { emotionVector } : {}),
    },
  };
}

export function registerTtsRoutes(deps: TtsRouteDeps): void {
  const { app, engine } = deps;
  const bargeIn = deps.bargeIn ?? new BargeInRegistry();

  app.get('/api/v1/tts/status', async (_req, res) => {
    res.json({ success: true, ...(await engine.status()) });
  });

  app.post('/api/v1/tts/plan', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tts-plan')) return;
    const parsed = parse(req.body, actorOf(req));
    if (!parsed.ok) {
      res
        .status(parsed.error === 'TTS_TEXT_SIZE_LIMIT_EXCEEDED' ? 413 : 400)
        .json({ success: false, error: parsed.error });
      return;
    }
    const { traceId, normalizedText, plan, route } = engine.plan(parsed.value);
    res.json({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
      traceId,
      normalizedText,
      plan,
      route,
    });
  });

  // Progressive delivery of the prosody plan, one complete sentence at a time. This is
  // NOT provider audio streaming: the payload carries text + plan and the browser speaks it.
  app.post('/api/v1/tts/stream', async (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tts-stream')) return;
    const actor = actorOf(req);
    const parsed = parse(req.body, actor);
    if (!parsed.ok) {
      res
        .status(parsed.error === 'TTS_TEXT_SIZE_LIMIT_EXCEEDED' ? 413 : 400)
        .json({ success: false, error: parsed.error });
      return;
    }
    const planned = engine.planStream(parsed.value);
    startEventStream(res);
    if (
      writeEvent(res, 'meta', {
        traceId: planned.traceId,
        totalChunks: planned.chunks.length,
        normalizedChars: planned.normalizedText.length,
        estimatedDurationMs: planned.estimatedDurationMs,
        planDigest: planned.planDigest,
        route: planned.route,
        streamMode: 'sentence-plan-progressive',
        authorizationPerformed: false,
        executionPerformed: false,
        note: 'Entrega incremental de planes de prosodia; no es audio ni streaming PCM del proveedor.',
      }) === 'ended'
    )
      return;
    for (const chunk of planned.chunks) {
      if (res.writableEnded || res.destroyed) return;
      if (bargeIn.consume(actor)) {
        writeEvent(res, 'interrupted', {
          success: true,
          traceId: planned.traceId,
          atChunk: chunk.index,
        });
        res.end();
        return;
      }
      const delivery = writeEvent(res, 'chunk', {
        traceId: planned.traceId,
        index: chunk.index,
        total: chunk.total,
        text: chunk.text,
        pauseAfterMs: chunk.pauseAfterMs,
        estimatedDurationMs: chunk.estimatedDurationMs,
        plan: chunk.plan,
      });
      if (delivery === 'ended') return;
      if (delivery === 'backpressure') await waitForDrain(res);
      // Yield once per chunk so an interrupt request can be observed between chunks.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    writeEvent(res, 'done', {
      success: true,
      traceId: planned.traceId,
      chunks: planned.chunks.length,
      estimatedDurationMs: planned.estimatedDurationMs,
      authorizationPerformed: false,
      executionPerformed: false,
    });
    // A mark that arrived after the final chunk has nothing left to stop.
    bargeIn.clear(actor);
    res.end();
  });

  app.post('/api/v1/tts/interrupt', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tts-interrupt')) return;
    const actor = actorOf(req);
    res.json({
      success: true,
      marked: bargeIn.mark(actor),
      ttlMs: bargeIn.ttlMs,
      scope: 'actor',
      authorizationPerformed: false,
      executionPerformed: false,
    });
  });

  app.post('/api/v1/tts/synthesize', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tts-synthesize')) return;
    const actor = actorOf(req);
    const parsed = parse(req.body, actor);
    if (!parsed.ok) {
      res
        .status(parsed.error === 'TTS_TEXT_SIZE_LIMIT_EXCEEDED' ? 413 : 400)
        .json({ success: false, error: parsed.error });
      return;
    }
    const result = await engine.synthesize(parsed.value);
    if (result.status === 'denied') {
      res
        .status(
          result.reason === 'NONCE_REPLAY_DETECTED'
            ? 409
            : result.reason === 'TEXT_TOO_LONG'
              ? 413
              : 400
        )
        .json({ success: false, error: result.reason, traceId: result.traceId });
      return;
    }
    try {
      deps.recordEvidence({
        traceId: result.traceId,
        backend: result.backend,
        evidenceHash: result.evidenceHash,
        actor,
      });
    } catch {
      /* evidence sink must not break speech */
    }
    res.json({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
      ...result,
    });
  });

  /**
   * Credential-free voice surface for the browser. It NEVER reaches a paid
   * provider: keylessOnly forces the operator-gated neural fallback and returns
   * a client plan when that fallback is unavailable. Quota is per-IP and the
   * text ceiling is lower than the authenticated route.
   */
  app.post('/api/v1/voice/speak', async (req, res) => {
    if (
      !deps.enforceRateLimit(req, res, deps.publicVoiceLimiter ?? deps.rateLimiter, 'public-voice')
    )
      return;
    const actor = actorOf(req);
    const parsed = parse(req.body, actor, MAX_PUBLIC_SPEECH_CHARS);
    if (!parsed.ok) {
      res
        .status(parsed.error === 'TTS_TEXT_SIZE_LIMIT_EXCEEDED' ? 413 : 400)
        .json({ success: false, error: parsed.error });
      return;
    }
    const result = await engine.synthesize(parsed.value, 20_000, { keylessOnly: true });
    if (result.status === 'denied') {
      res
        .status(
          result.reason === 'NONCE_REPLAY_DETECTED'
            ? 409
            : result.reason === 'TEXT_TOO_LONG'
              ? 413
              : 400
        )
        .json({ success: false, error: result.reason, traceId: result.traceId });
      return;
    }
    try {
      deps.recordEvidence({
        traceId: result.traceId,
        backend: result.backend,
        evidenceHash: result.evidenceHash,
        actor,
      });
    } catch {
      /* evidence sink must not break speech */
    }
    res.json({
      success: true,
      publicCapability: true,
      authorizationPerformed: false,
      executionPerformed: false,
      ...result,
    });
  });

  app.post('/api/v1/tts/memory', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tts-memory')) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    try {
      engine.memory.learn(actorOf(req), String(b.written ?? ''), String(b.spoken ?? ''));
      res.json({ success: true, entries: engine.memory.count(actorOf(req)) });
    } catch (err) {
      res
        .status(400)
        .json({ success: false, error: err instanceof Error ? err.message : 'TTS_MEMORY_ERROR' });
    }
  });

  app.delete('/api/v1/tts/memory', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'tts-memory')) return;
    res.json({ success: true, erased: engine.memory.forget(actorOf(req)) });
  });
}
