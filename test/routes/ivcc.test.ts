import { describe, expect, it } from 'vitest';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../../src/security/rate-limit';
import { registerIvccRoutes } from '../../src/routes/ivcc';
import { encodeWavPcm16 } from '../../src/ivcc/audio';
import { IvccEngine } from '../../src/ivcc/engine';
import { MemoryIvccStore } from '../../src/ivcc/store';
import { GenesisTtsEngine } from '../../src/tts/engine';

type Handler = (req: Request, res: Response) => void | Promise<void>;

const SUBJECT_SALT = Buffer.alloc(32, 11);
const WATERMARK_KEY = Buffer.alloc(32, 12);
const SCOPES = ['voice_profile:create', 'voice:synthesize', 'emotion:infer', 'prosody:memory'];
const PERSON = 'person:ana-001';

interface HarnessOptions {
  readonly denyAdmin?: boolean;
  readonly denySynthesis?: boolean;
  readonly requireDurable?: boolean;
  readonly adminBypass?: boolean;
}

interface Captured {
  status: number;
  body: unknown;
}

function wavDataUrl(): { url: string; bytes: number } {
  const sampleRate = 24_000;
  const frames = sampleRate;
  const samples = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    samples[index] = 0.15 * Math.sin((2 * Math.PI * 220 * index) / sampleRate);
  }
  const bytes = encodeWavPcm16(samples, sampleRate, 1);
  return {
    url: `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`,
    bytes: bytes.length,
  };
}

function makeTts(): GenesisTtsEngine {
  return new GenesisTtsEngine({
    env: { GROQ_API_KEY: 'test-key', GROQ_TTS_MODEL: 'test-model' },
    native: null,
    serverTts: async () => {
      const wav = wavDataUrl();
      return { provider: 'groq', mimeType: 'audio/wav', dataUrl: wav.url, bytes: wav.bytes, voice: 'Celeste-PlayAI' };
    },
  });
}

function harness(options: HarnessOptions = {}) {
  const handlers = new Map<string, Handler>();
  const register = (method: string) => (path: string, handler: Handler) => {
    handlers.set(`${method} ${path}`, handler);
  };
  const app = {
    get: register('GET'),
    post: register('POST'),
    delete: register('DELETE'),
  } as unknown as Application;
  const evidence: unknown[] = [];
  const engine = new IvccEngine({
    store: new MemoryIvccStore(),
    subjectSalt: SUBJECT_SALT,
    watermarkKey: WATERMARK_KEY,
    tts: makeTts(),
  });
  registerIvccRoutes({
    app,
    engine,
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: (_req, res) => {
      if (!options.denyAdmin) return true;
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return false;
    },
    authorizeSynthesis: (_req, res) => {
      if (!options.denySynthesis) return true;
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return false;
    },
    isAdminAuthorized: () => options.adminBypass === true,
    requireDurable: options.requireDurable === true,
    recordEvidence: (event) => {
      evidence.push(event);
    },
  });

  const call = async (
    key: string,
    body?: unknown,
    headers: Record<string, string> = {},
    query: Record<string, string> = {}
  ): Promise<Captured> => {
    const captured: Captured = { status: 200, body: undefined };
    const res = {
      status(code: number) {
        captured.status = code;
        return this;
      },
      json(payload: unknown) {
        captured.body = payload;
        return this;
      },
    } as unknown as Response;
    const allHeaders: Record<string, string> = {
      'x-session-id': 'session-test-1234',
      ...headers,
    };
    const req = {
      body,
      ip: '1.2.3.4',
      query,
      get: (name: string) => allHeaders[name.toLowerCase()],
    } as unknown as Request;
    await handlers.get(key)!(req, res);
    return captured;
  };

  return { handlers, evidence, call };
}

describe('IVCC HTTP surface', () => {
  it('status is public and honest about scope', async () => {
    const h = harness();
    const result = await h.call('GET /api/v1/ivcc/status');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      engine: 'ivcc-cognitive-voice-core',
      designTargetsNotMeasured: true,
      authorizationPerformed: false,
      executionPerformed: false,
    });
  });

  it('validates plan input and plans for the synthetic baseline', async () => {
    const h = harness();
    expect((await h.call('POST /api/v1/ivcc/plan', { text: '  ' })).status).toBe(400);
    expect((await h.call('POST /api/v1/ivcc/plan', { text: 'a'.repeat(4_001) })).status).toBe(413);
    expect((await h.call('POST /api/v1/ivcc/plan', { text: 'Hola.', tier: 'Z' })).status).toBe(400);

    const planned = await h.call('POST /api/v1/ivcc/plan', { text: 'Hola. Gracias.' });
    expect(planned.status).toBe(200);
    expect(planned.body).toMatchObject({
      success: true,
      status: 'planned',
      authorizationPerformed: false,
      executionPerformed: false,
    });
    const body = planned.body as { normalizedText: string; plan: { units: unknown[] } };
    expect(body.normalizedText.length).toBeGreaterThan(0);
    expect(body.plan.units.length).toBeGreaterThan(0);
  });

  it('synthesizes audio and records evidence without claiming authority', async () => {
    const h = harness();
    const result = await h.call('POST /api/v1/synthesize', {
      text: 'Primera oración completa. Segunda oración completa.',
      mode: 'PODCAST',
    });
    expect(result.status).toBe(200);
    const body = result.body as {
      success: boolean;
      audioStatus: string;
      audio: { mimeType: string; sha256: string; mastered: boolean; watermarked: boolean };
      authorizationPerformed: boolean;
      executionPerformed: boolean;
    };
    expect(body.success).toBe(true);
    expect(body.audioStatus).toBe('audio');
    expect(body.audio.mimeType).toBe('audio/wav');
    expect(body.audio.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(body.audio.mastered).toBe(true);
    expect(body.audio.watermarked).toBe(true);
    expect(body.authorizationPerformed).toBe(false);
    expect(body.executionPerformed).toBe(false);
    expect(h.evidence).toHaveLength(1);
  });

  it('fails closed on synthesis gate and admin gate denials', async () => {
    const noSynthesis = harness({ denySynthesis: true });
    expect((await noSynthesis.call('POST /api/v1/synthesize', { text: 'Hola.' })).status).toBe(401);

    const noAdmin = harness({ denyAdmin: true });
    expect(
      (
        await noAdmin.call('POST /api/v1/voice/create', {
          subjectRef: PERSON,
          label: 'Ana',
        })
      ).status
    ).toBe(401);
    expect((await noAdmin.call('GET /api/v1/audit')).status).toBe(401);
    expect((await noAdmin.call('POST /api/v1/consent/register', {})).status).toBe(401);
  });

  it('returns 503 for durable-only mutations when persistence is not available', async () => {
    const h = harness({ requireDurable: true });
    const result = await h.call('POST /api/v1/consent/register', {
      subjectRef: PERSON,
      scopes: SCOPES,
      method: 'written-record',
      evidenceRef: 'vault://consent/001',
      attestation: true,
    });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ error: 'IVCC_PERSISTENCE_UNAVAILABLE' });
  });

  it('rejects biometric upload fields on voice profiles', async () => {
    const h = harness();
    const result = await h.call('POST /api/v1/voice/create', {
      subjectRef: PERSON,
      label: 'Ana',
      audio: 'data:audio/wav;base64,AAAA',
    });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: 'IVCC_BIOMETRIC_UPLOAD_UNSUPPORTED' });
  });

  it('enforces consent, usage token and revocation across the full HTTP lifecycle', async () => {
    const h = harness();
    const registered = await h.call('POST /api/v1/consent/register', {
      subjectRef: PERSON,
      scopes: SCOPES,
      method: 'digital-signature',
      evidenceRef: 'vault://consent/2026/001',
      attestation: true,
    });
    expect(registered.status).toBe(201);
    const consentBody = registered.body as { usageToken: string; subjectHash: string };
    expect(consentBody.usageToken).toMatch(/^ivt_/);
    expect(consentBody.subjectHash).toMatch(/^[a-f0-9]{64}$/);

    const validated = await h.call('POST /api/v1/consent/validate', {
      subjectRef: PERSON,
      scopes: ['voice:synthesize'],
    });
    expect(validated.status).toBe(200);
    expect(validated.body).toMatchObject({ success: true });
    expect((validated.body as { validation: { valid: boolean } }).validation.valid).toBe(true);

    const created = await h.call('POST /api/v1/voice/create', {
      subjectRef: PERSON,
      label: 'Ana',
      tier: 'M',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ success: true, created: true, cloning: false });

    const blocked = await h.call('POST /api/v1/ivcc/plan', {
      text: 'Hola.',
      subjectRef: PERSON,
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ reason: 'IVCC_USAGE_TOKEN_REQUIRED' });

    const planned = await h.call(
      'POST /api/v1/ivcc/plan',
      { text: 'Hola.', subjectRef: PERSON },
      { 'x-ivcc-consent-token': consentBody.usageToken }
    );
    expect(planned.status).toBe(200);
    expect(planned.body).toMatchObject({ success: true, status: 'planned' });

    const revoked = await h.call('DELETE /api/v1/consent/revoke', { subjectRef: PERSON });
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({
      success: true,
      permanent: true,
      revokedConsents: 1,
      erasedProfiles: 1,
    });

    const afterRevocation = await h.call(
      'POST /api/v1/ivcc/plan',
      { text: 'Hola.', subjectRef: PERSON },
      { 'x-ivcc-consent-token': consentBody.usageToken }
    );
    expect(afterRevocation.status).toBe(404);
    expect(afterRevocation.body).toMatchObject({ reason: 'IVCC_PROFILE_NOT_FOUND' });

    const audit = await h.call('GET /api/v1/audit', undefined, {}, {});
    expect(audit.status).toBe(200);
    const auditBody = audit.body as {
      success: boolean;
      chainValid: boolean;
      events: Array<{ event: string }>;
    };
    expect(auditBody.success).toBe(true);
    expect(auditBody.chainValid).toBe(true);
    expect(auditBody.events.map((event) => event.event)).toContain('consent.revoked');
    expect(JSON.stringify(auditBody)).not.toContain(PERSON);
    expect(JSON.stringify(auditBody)).not.toContain('Hola.');
  });

  it('learns and erases per-subject pronunciation memory', async () => {
    const h = harness();
    const registered = await h.call('POST /api/v1/consent/register', {
      subjectRef: PERSON,
      scopes: SCOPES,
      method: 'written-record',
      evidenceRef: 'vault://consent/2026/002',
      attestation: true,
    });
    const token = (registered.body as { usageToken: string }).usageToken;
    await h.call('POST /api/v1/voice/create', { subjectRef: PERSON, label: 'Ana' });

    const learned = await h.call('POST /api/v1/ivcc/memory', {
      subjectRef: PERSON,
      written: 'Kubernetes',
      spoken: 'Kúbernetes',
    });
    expect(learned.status).toBe(200);
    expect(learned.body).toMatchObject({ success: true, entries: 1 });

    const withMemory = await h.call(
      'POST /api/v1/ivcc/plan',
      { text: 'Uso Kubernetes.', subjectRef: PERSON },
      { 'x-ivcc-consent-token': token }
    );
    expect((withMemory.body as { normalizedText: string }).normalizedText).toContain('Kúbernetes');

    const erased = await h.call('DELETE /api/v1/ivcc/memory', { subjectRef: PERSON });
    expect(erased.status).toBe(200);
    expect(erased.body).toMatchObject({ success: true, erasedEntries: 1 });

    const withoutMemory = await h.call(
      'POST /api/v1/ivcc/plan',
      { text: 'Uso Kubernetes.', subjectRef: PERSON },
      { 'x-ivcc-consent-token': token }
    );
    const normalized = (withoutMemory.body as { normalizedText: string }).normalizedText;
    expect(normalized).toContain('Kubernetes');
    expect(normalized).not.toContain('Kúbernetes');
  });
});
