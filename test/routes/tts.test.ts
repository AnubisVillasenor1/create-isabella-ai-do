import { describe, expect, it } from 'vitest';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../../src/security/rate-limit';
import { registerTtsRoutes } from '../../src/routes/tts';
import { GenesisTtsEngine } from '../../src/tts/engine';
import { BargeInRegistry } from '../../src/tts/streaming';

type Handler = (req: Request, res: Response) => void | Promise<void>;

const TTS_STREAM_PATH = '/api/v1/tts/stream';
const TTS_INTERRUPT_PATH = '/api/v1/tts/interrupt';

function harness(
  opts: { denyGate?: boolean; evidence?: unknown[]; bargeIn?: BargeInRegistry } = {}
) {
  const handlers = new Map<string, Handler>();
  const reg = (m: string) => (p: string, h: Handler) => handlers.set(`${m} ${p}`, h);
  const app = {
    get: reg('GET'),
    post: reg('POST'),
    delete: reg('DELETE'),
  } as unknown as Application;
  const engine = new GenesisTtsEngine({
    env: { GROQ_API_KEY: 'k', GROQ_TTS_MODEL: 'm' },
    native: null,
    serverTts: async () => ({
      provider: 'groq',
      mimeType: 'audio/wav',
      dataUrl: 'data:audio/wav;base64,AAAA',
      bytes: 3,
      voice: 'Celeste-PlayAI',
    }),
  });
  registerTtsRoutes({
    app,
    engine,
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: (_req, res) => {
      if (opts.denyGate) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        return false;
      }
      return true;
    },
    recordEvidence: (e) => {
      opts.evidence?.push(e);
    },
    ...(opts.bargeIn ? { bargeIn: opts.bargeIn } : {}),
  });
  return handlers;
}

async function call(
  handlers: Map<string, Handler>,
  key: string,
  body?: unknown,
  headers: Record<string, string> = { 'x-session-id': 'session-abc12345' }
) {
  const out = { status: 200, body: undefined as unknown };
  const res = {
    status(c: number) {
      out.status = c;
      return this;
    },
    json(b: unknown) {
      out.body = b;
      return this;
    },
  } as unknown as Response;
  const req = {
    body,
    ip: '1.2.3.4',
    get: (h: string) => headers[h.toLowerCase()],
  } as unknown as Request;
  await handlers.get(key)!(req, res);
  return out;
}

interface SseEvent {
  readonly event: string;
  readonly data: Record<string, unknown>;
}

async function callSse(
  handlers: Map<string, Handler>,
  key: string,
  body?: unknown,
  headers: Record<string, string> = { 'x-session-id': 'session-abc12345' }
) {
  const out = { status: 200, raw: '', ended: false, headers: {} as Record<string, string> };
  const res = {
    writableEnded: false,
    destroyed: false,
    status(c: number) {
      out.status = c;
      return this;
    },
    setHeader(name: string, value: string) {
      out.headers[name.toLowerCase()] = value;
      return this;
    },
    flushHeaders() {},
    write(chunk: string) {
      out.raw += chunk;
      return true;
    },
    end() {
      out.ended = true;
    },
    once() {
      return this;
    },
    off() {
      return this;
    },
  } as unknown as Response & { writableEnded: boolean; destroyed: boolean };
  const req = {
    body,
    ip: '1.2.3.4',
    get: (h: string) => headers[h.toLowerCase()],
  } as unknown as Request;
  await handlers.get(key)!(req, res);
  const events: SseEvent[] = out.raw
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      let event = 'message';
      let data: Record<string, unknown> = {};
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: '))
          data = JSON.parse(line.slice(6)) as Record<string, unknown>;
      }
      return { event, data };
    });
  return { ...out, events };
}

describe('TTS HTTP surface', () => {
  it('status is public and truthful', async () => {
    const r = await call(harness(), 'GET /api/v1/tts/status');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      success: true,
      engine: 'genesis-tts-mx-prime',
      designTargetsNotMeasured: true,
    });
  });

  it('plan returns normalized text, prosody and route without authorizing or executing', async () => {
    const r = await call(harness(), 'POST /api/v1/tts/plan', { text: 'Cuesta $19 USD. ¡Listo!' });
    expect(r.body).toMatchObject({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
    });
    const b = r.body as { normalizedText: string; plan: { phrases: unknown[] } };
    expect(b.normalizedText).toContain('diecinueve dólares');
    expect(b.plan.phrases.length).toBeGreaterThan(0);
  });

  it('validates input: empty 400, oversize 413, unknown mode ignored', async () => {
    const h = harness();
    expect((await call(h, 'POST /api/v1/tts/plan', { text: '  ' })).status).toBe(400);
    expect((await call(h, 'POST /api/v1/tts/plan', { text: 'a'.repeat(4001) })).status).toBe(413);
    expect(
      (await call(h, 'POST /api/v1/tts/plan', { text: 'hola', mode: 'NOPE', region: 'mars' }))
        .status
    ).toBe(200);
  });

  it('synthesize is gated, returns audio, records evidence, and rejects replayed nonces with 409', async () => {
    const evidence: unknown[] = [];
    const h = harness({ evidence });
    const body = {
      text: 'Texto para sintetizar con el servidor de voz.',
      mode: 'PODCAST',
      nonce: 'nonce-aaaa-1111',
    };
    const ok = await call(h, 'POST /api/v1/tts/synthesize', body);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, status: 'audio', backend: 'server-tts' });
    expect(evidence).toHaveLength(1);
    expect((await call(h, 'POST /api/v1/tts/synthesize', body)).status).toBe(409);
    expect(
      (await call(harness({ denyGate: true }), 'POST /api/v1/tts/synthesize', body)).status
    ).toBe(401);
  });

  it('uses the configured server backend even when the router ranks browser speech first', async () => {
    // CONVERSACION ranks browser-speech above server-tts; a configured backend must still speak.
    const r = await call(harness(), 'POST /api/v1/tts/synthesize', {
      text: 'Hola, esta es la voz canónica del nodo.',
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      status: 'audio',
      backend: 'server-tts',
      audio: { mimeType: 'audio/wav' },
    });
  });

  it('streams sentence plans over SSE without claiming audio or authority', async () => {
    const result = await callSse(harness(), 'POST ' + TTS_STREAM_PATH, {
      text: 'Primera oración completa. Segunda oración completa. Tercera oración completa.',
    });
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toContain('text/event-stream');
    expect(result.ended).toBe(true);
    expect(result.events[0]?.event).toBe('meta');
    expect(result.events[0]?.data).toMatchObject({
      streamMode: 'sentence-plan-progressive',
      authorizationPerformed: false,
      executionPerformed: false,
    });
    const chunks = result.events.filter((event) => event.event === 'chunk');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.data).toMatchObject({ index: 0 });
    expect(chunks[0]?.data.plan).toBeTruthy();
    const done = result.events.at(-1);
    expect(done?.event).toBe('done');
    expect(done?.data).toMatchObject({
      success: true,
      chunks: chunks.length,
      authorizationPerformed: false,
      executionPerformed: false,
    });
    expect(Number(done?.data.estimatedDurationMs)).toBeGreaterThan(0);
  });

  it('validates stream input before opening the event stream', async () => {
    const h = harness();
    expect((await call(h, 'POST ' + TTS_STREAM_PATH, { text: '  ' })).status).toBe(400);
    expect((await call(h, 'POST ' + TTS_STREAM_PATH, { text: 'a'.repeat(4001) })).status).toBe(413);
  });

  it('interrupt is actor-scoped, one-shot and never grants authority', async () => {
    const h = harness();
    const mark = await call(h, 'POST ' + TTS_INTERRUPT_PATH);
    expect(mark.body).toMatchObject({
      success: true,
      marked: true,
      scope: 'actor',
      authorizationPerformed: false,
      executionPerformed: false,
    });

    const other = await callSse(
      h,
      'POST ' + TTS_STREAM_PATH,
      { text: 'Otra sesión no se interrumpe. Segunda oración.' },
      { 'x-session-id': 'other-session-1234' }
    );
    expect(other.events.some((event) => event.event === 'chunk')).toBe(true);
    expect(other.events.some((event) => event.event === 'interrupted')).toBe(false);

    const interrupted = await callSse(h, 'POST ' + TTS_STREAM_PATH, {
      text: 'Esta sesión sí se interrumpe. Segunda oración.',
    });
    expect(interrupted.events.some((event) => event.event === 'interrupted')).toBe(true);
    expect(interrupted.events.some((event) => event.event === 'chunk')).toBe(false);
    expect(interrupted.ended).toBe(true);
  });

  it('honors an interrupt that arrives while chunks are being delivered', async () => {
    const bargeIn = new BargeInRegistry();
    const h = harness({ bargeIn });
    // The microtask runs only when the stream yields between chunks.
    queueMicrotask(() => bargeIn.mark('session:session-abc12345'));
    const result = await callSse(h, 'POST ' + TTS_STREAM_PATH, {
      text: 'Primera oración completa. Segunda oración completa. Tercera oración completa.',
    });
    const chunks = result.events.filter((event) => event.event === 'chunk');
    expect(chunks.length).toBe(1);
    expect(result.events.some((event) => event.event === 'interrupted')).toBe(true);
    expect(result.events.some((event) => event.event === 'done')).toBe(false);
  });

  it('memory learn/erase is scoped to the session header', async () => {
    const h = harness();
    expect(
      (await call(h, 'POST /api/v1/tts/memory', { written: 'Kubernetes', spoken: 'Kúbernetes' }))
        .body
    ).toMatchObject({ success: true, entries: 1 });
    const planned = await call(h, 'POST /api/v1/tts/plan', { text: 'Uso Kubernetes' });
    expect((planned.body as { normalizedText: string }).normalizedText).toContain('Kúbernetes');
    const other = await call(
      h,
      'POST /api/v1/tts/plan',
      { text: 'Uso Kubernetes' },
      { 'x-session-id': 'other-session-99' }
    );
    expect((other.body as { normalizedText: string }).normalizedText).toContain('Kubernetes');
    expect((await call(h, 'DELETE /api/v1/tts/memory')).body).toMatchObject({ erased: true });
    expect((await call(h, 'POST /api/v1/tts/memory', { written: 'x', spoken: 'y' })).status).toBe(
      400
    );
  });
});
