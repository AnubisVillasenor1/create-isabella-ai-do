/**
 * state: engine-generated
 * IVCC HTTP surface. Planning is viewer-level; personal profiles require a
 * per-consent usage token or an authenticated administrator. Synthesis also
 * passes the provider gate because it can call a paid backend. Every response
 * states that voice authority/execution did not occur.
 */
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import { IvccConsentError, SUBJECT_REF_RE } from '../ivcc/consent';
import type { IvccEngine, IvccPlanRequest } from '../ivcc';
import { IvccMemoryError } from '../ivcc/memory';
import { IVCC_TIERS, type MxRegion, type VoiceMode } from '../ivcc/types';
import { MX_REGIONS, VOICE_MODES } from '../tts/types';

export const IVCC_ROUTES_VERSION = '1.0.0';
const MAX_TEXT_CHARS = 4_000;
const MAX_EMOTION_AXES = 32;

export interface IvccRouteDeps {
  readonly app: Application;
  readonly engine: IvccEngine;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  readonly authorizeSynthesis: (req: Request, res: Response) => boolean;
  readonly isAdminAuthorized: (req: Request) => boolean;
  /** True in production when no durable IVCC store is configured. */
  readonly requireDurable: boolean;
  readonly recordEvidence?: (event: {
    traceId: string;
    profileId: string;
    backend: string;
    audioSha256: string;
    bytes: number;
    mastered: boolean;
    watermarked: boolean;
  }) => void;
}

type Body = Record<string, unknown>;

function asRecord(value: unknown): Body {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Body) : {};
}

function actorOf(req: Request): string {
  const header = req.get('x-session-id');
  return header && /^[\w-]{8,128}$/.test(header)
    ? `session:${header}`
    : `ip:${req.ip ?? 'unknown'}`;
}

function consentTokenOf(req: Request): string | undefined {
  const header = req.get('x-ivcc-consent-token');
  if (!header) return undefined;
  const token = header.trim();
  return token.length >= 10 && token.length <= 200 ? token : undefined;
}

function httpStatus(reason: string): number {
  if (reason.includes('TEXT_SIZE_LIMIT') || reason.includes('PLAN_TOO_MANY_UNITS')) return 413;
  if (reason.includes('PROFILE_NOT_FOUND') || reason.includes('CONSENT_NOT_FOUND')) return 404;
  if (reason.includes('NONCE_REPLAY')) return 409;
  if (reason.includes('REVOKED')) return 410;
  if (reason.includes('USAGE_TOKEN') || reason.includes('CONSENT_')) return 403;
  return 400;
}

function fail(res: Response, status: number, error: string, extra?: Body): void {
  res.status(status).json({
    success: false,
    error,
    authorizationPerformed: false,
    executionPerformed: false,
    ...(extra ?? {}),
  });
}

function ensureDurable(deps: IvccRouteDeps, res: Response): boolean {
  if (!deps.requireDurable) return true;
  fail(res, 503, 'IVCC_PERSISTENCE_UNAVAILABLE', {
    detail:
      'IVCC_DATA_DIR es obligatorio en producción para consentimiento, perfiles y auditoría durables.',
  });
  return false;
}

interface ParsedPlanRequest {
  readonly ok: true;
  readonly value: IvccPlanRequest;
}
interface ParsedError {
  readonly ok: false;
  readonly status: number;
  readonly error: string;
}

function parseEmotion(value: unknown): Record<string, number> | undefined {
  const record = asRecord(value);
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record).slice(0, MAX_EMOTION_AXES)) {
    if (typeof entry === 'number' && Number.isFinite(entry)) out[key] = entry;
  }
  return Object.keys(out).length ? out : undefined;
}

function parsePlanRequest(req: Request): ParsedPlanRequest | ParsedError {
  const body = asRecord(req.body);
  const text = typeof body.text === 'string' ? body.text : '';
  if (!text.trim()) return { ok: false, status: 400, error: 'IVCC_TEXT_REQUIRED' };
  if (text.length > MAX_TEXT_CHARS)
    return { ok: false, status: 413, error: 'IVCC_TEXT_SIZE_LIMIT_EXCEEDED' };
  const profileId = typeof body.profileId === 'string' ? body.profileId : undefined;
  if (profileId !== undefined && !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(profileId)) {
    return { ok: false, status: 400, error: 'IVCC_PROFILE_ID_INVALID' };
  }
  const subjectRef = typeof body.subjectRef === 'string' ? body.subjectRef : undefined;
  if (subjectRef !== undefined && !SUBJECT_REF_RE.test(subjectRef)) {
    return { ok: false, status: 400, error: 'IVCC_SUBJECT_REF_INVALID' };
  }
  const tier = typeof body.tier === 'string' ? body.tier : undefined;
  if (tier !== undefined && !(IVCC_TIERS as readonly string[]).includes(tier)) {
    return { ok: false, status: 400, error: 'IVCC_TIER_INVALID' };
  }
  const nonce = typeof body.nonce === 'string' ? body.nonce : undefined;
  if (nonce !== undefined && !/^[\w-]{8,120}$/.test(nonce)) {
    return { ok: false, status: 400, error: 'IVCC_NONCE_INVALID' };
  }
  const mode: VoiceMode | undefined =
    typeof body.mode === 'string' && (VOICE_MODES as readonly string[]).includes(body.mode)
      ? (body.mode as VoiceMode)
      : undefined;
  const region: MxRegion | undefined =
    typeof body.region === 'string' && (MX_REGIONS as readonly string[]).includes(body.region)
      ? (body.region as MxRegion)
      : undefined;
  const emotion = parseEmotion(body.emotion);
  const consentToken = consentTokenOf(req);
  if (req.get('x-ivcc-consent-token') && !consentToken) {
    return { ok: false, status: 400, error: 'IVCC_CONSENT_TOKEN_INVALID' };
  }
  return {
    ok: true,
    value: {
      text,
      ...(profileId ? { profileId } : {}),
      ...(subjectRef ? { subjectRef } : {}),
      ...(tier ? { tier: tier as IvccPlanRequest['tier'] } : {}),
      ...(mode ? { mode } : {}),
      ...(region ? { region } : {}),
      ...(emotion ? { emotion } : {}),
      ...(nonce ? { nonce } : {}),
      ...(typeof body.memory === 'boolean' ? { memory: body.memory } : {}),
      ...(consentToken ? { consentToken } : {}),
    },
  };
}

const FORBIDDEN_BIOMETRIC_FIELDS = [
  'audio',
  'audioSample',
  'sample',
  'voiceSample',
  'wav',
  'pcm',
  'biometric',
  'embedding',
  'voiceprint',
] as const;

function rejectsBiometricUpload(body: Body): boolean {
  return FORBIDDEN_BIOMETRIC_FIELDS.some(
    (field) => body[field] !== undefined && body[field] !== null
  );
}

export function registerIvccRoutes(deps: IvccRouteDeps): void {
  const { app, engine } = deps;

  app.get('/api/v1/ivcc/status', async (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-status')) return;
    try {
      res.json({ success: true, ...(await engine.status()) });
    } catch {
      fail(res, 503, 'IVCC_RUNTIME_UNAVAILABLE');
    }
  });

  app.post('/api/v1/ivcc/plan', async (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-plan')) return;
    const parsed = parsePlanRequest(req);
    if (!parsed.ok) {
      fail(res, parsed.status, parsed.error);
      return;
    }
    try {
      const result = await engine.plan(parsed.value, actorOf(req), {
        allowWithoutUsageToken: deps.isAdminAuthorized(req),
      });
      res
        .status(result.status === 'planned' ? 200 : httpStatus(result.reason))
        .json({ success: result.status === 'planned', ...result });
    } catch {
      fail(res, 500, 'IVCC_PLAN_FAILED');
    }
  });

  app.post('/api/v1/voice/create', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!ensureDurable(deps, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-voice-create')) return;
    const body = asRecord(req.body);
    if (rejectsBiometricUpload(body)) {
      fail(res, 400, 'IVCC_BIOMETRIC_UPLOAD_UNSUPPORTED', {
        detail:
          'IVCC no acepta muestras de voz ni embeddings: los perfiles describen estilo prosódico, no clonan biometría.',
      });
      return;
    }
    const subjectRef = typeof body.subjectRef === 'string' ? body.subjectRef : '';
    if (!SUBJECT_REF_RE.test(subjectRef)) {
      fail(res, 400, 'IVCC_SUBJECT_REF_INVALID');
      return;
    }
    const label = typeof body.label === 'string' ? body.label : '';
    if (!label.trim()) {
      fail(res, 400, 'IVCC_PROFILE_LABEL_REQUIRED');
      return;
    }
    const tier = typeof body.tier === 'string' ? body.tier : undefined;
    if (tier !== undefined && !(IVCC_TIERS as readonly string[]).includes(tier)) {
      fail(res, 400, 'IVCC_TIER_INVALID');
      return;
    }
    const rawTraits = asRecord(body.traits);
    const traits: Record<string, number | string> = {};
    for (const key of ['rate', 'pitch', 'warmth', 'energy', 'formality'] as const) {
      const value = rawTraits[key];
      if (value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        fail(res, 400, 'IVCC_TRAIT_INVALID', { trait: key });
        return;
      }
      traits[key] = value;
    }
    if (rawTraits.pauseStyle !== undefined) {
      if (
        rawTraits.pauseStyle !== 'compact' &&
        rawTraits.pauseStyle !== 'measured' &&
        rawTraits.pauseStyle !== 'dramatic'
      ) {
        fail(res, 400, 'IVCC_TRAIT_INVALID', { trait: 'pauseStyle' });
        return;
      }
      traits.pauseStyle = rawTraits.pauseStyle;
    }
    const region = typeof body.region === 'string' ? body.region : undefined;
    if (region !== undefined && !(MX_REGIONS as readonly string[]).includes(region)) {
      fail(res, 400, 'IVCC_REGION_INVALID');
      return;
    }
    try {
      const result = await engine.createProfile(
        {
          subjectRef,
          label,
          ...(tier ? { tier: tier as IvccPlanRequest['tier'] } : {}),
          ...(Object.keys(traits).length ? { traits: traits as never } : {}),
          ...(region ? { region: region as MxRegion } : {}),
        },
        actorOf(req)
      );
      if ('reason' in result) {
        res.status(httpStatus(result.reason)).json({ success: false, ...result });
        return;
      }
      res.status(result.created ? 201 : 200).json({
        success: true,
        ...result,
        cloning: false,
        note: 'Perfil de estilo prosódico determinista; no se clona ni se almacena biometría vocal.',
        authorizationPerformed: false,
        executionPerformed: false,
      });
    } catch {
      fail(res, 500, 'IVCC_PROFILE_CREATE_FAILED');
    }
  });

  app.post('/api/v1/consent/register', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!ensureDurable(deps, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-consent-register')) return;
    const body = asRecord(req.body);
    const subjectRef = typeof body.subjectRef === 'string' ? body.subjectRef : '';
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((scope): scope is string => typeof scope === 'string')
      : [];
    const method = typeof body.method === 'string' ? body.method : '';
    const evidenceRef = typeof body.evidenceRef === 'string' ? body.evidenceRef : '';
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : undefined;
    try {
      const result = await engine.registerConsent(
        {
          subjectRef,
          scopes,
          method,
          evidenceRef,
          attestation: body.attestation === true,
          ...(expiresAt ? { expiresAt } : {}),
        },
        actorOf(req)
      );
      res.status(201).json({
        success: true,
        ...result,
        notice:
          'El token de uso se muestra una sola vez y se guarda únicamente como hash. La revocación es permanente.',
        authorizationPerformed: false,
        executionPerformed: false,
      });
    } catch (error) {
      if (error instanceof IvccConsentError) {
        fail(res, error.code === 'IVCC_CONSENT_NOT_FOUND' ? 404 : 400, error.code, {
          detail: error.message,
        });
        return;
      }
      fail(res, 500, 'IVCC_CONSENT_REGISTER_FAILED');
    }
  });

  app.post('/api/v1/consent/validate', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-consent-validate')) return;
    const body = asRecord(req.body);
    const subjectRef = typeof body.subjectRef === 'string' ? body.subjectRef : '';
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((scope): scope is string => typeof scope === 'string')
      : [];
    try {
      const result = await engine.checkConsent({ subjectRef, scopes, actor: actorOf(req) });
      res.json({
        success: true,
        ...result,
        subjectRefStored: false,
        authorizationPerformed: false,
        executionPerformed: false,
      });
    } catch (error) {
      if (error instanceof IvccConsentError) {
        fail(res, 400, error.code, { detail: error.message });
        return;
      }
      fail(res, 500, 'IVCC_CONSENT_CHECK_FAILED');
    }
  });

  app.delete('/api/v1/consent/revoke', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!ensureDurable(deps, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-consent-revoke')) return;
    const body = asRecord(req.body);
    const subjectRef = typeof body.subjectRef === 'string' ? body.subjectRef : undefined;
    const consentId = typeof body.consentId === 'string' ? body.consentId : undefined;
    if (!subjectRef && !consentId) {
      fail(res, 400, 'IVCC_REVOKE_TARGET_REQUIRED');
      return;
    }
    try {
      const result = await engine.revoke(
        { ...(subjectRef ? { subjectRef } : {}), ...(consentId ? { consentId } : {}) },
        actorOf(req)
      );
      res.json({
        success: true,
        ...result,
        notice:
          'Revocación permanente: se eliminaron perfiles y memoria prosódica del sujeto; el tombstone hash permanece en la auditoría.',
        authorizationPerformed: false,
        executionPerformed: false,
      });
    } catch (error) {
      if (error instanceof IvccConsentError) {
        fail(res, error.code === 'IVCC_CONSENT_NOT_FOUND' ? 404 : 400, error.code, {
          detail: error.message,
        });
        return;
      }
      fail(res, 500, 'IVCC_CONSENT_REVOKE_FAILED');
    }
  });

  app.get('/api/v1/audit', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-audit')) return;
    const subjectRef = typeof req.query.subjectRef === 'string' ? req.query.subjectRef : undefined;
    const event = typeof req.query.event === 'string' ? req.query.event : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? limitRaw : undefined;
    try {
      const result = await engine.readAudit(
        {
          ...(subjectRef ? { subjectRef } : {}),
          ...(event ? { event } : {}),
          ...(limit ? { limit } : {}),
        },
        actorOf(req)
      );
      res.json({
        success: true,
        ...result,
        authorizationPerformed: false,
        executionPerformed: false,
      });
    } catch (error) {
      if (error instanceof IvccConsentError) {
        fail(res, 400, error.code, { detail: error.message });
        return;
      }
      fail(res, 500, 'IVCC_AUDIT_READ_FAILED');
    }
  });

  app.post('/api/v1/ivcc/memory', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!ensureDurable(deps, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-memory')) return;
    const body = asRecord(req.body);
    const subjectRef = typeof body.subjectRef === 'string' ? body.subjectRef : '';
    const written = typeof body.written === 'string' ? body.written : undefined;
    const spoken = typeof body.spoken === 'string' ? body.spoken : undefined;
    const adjustment =
      body.adjustment && typeof body.adjustment === 'object' && !Array.isArray(body.adjustment)
        ? (body.adjustment as Body)
        : undefined;
    try {
      const result = await engine.learnMemory(
        {
          subjectRef,
          ...(written !== undefined ? { written } : {}),
          ...(spoken !== undefined ? { spoken } : {}),
          ...(adjustment ? { adjustment } : {}),
        },
        actorOf(req)
      );
      if ('reason' in result) {
        res.status(httpStatus(result.reason)).json({ success: false, ...result });
        return;
      }
      res.json({
        success: true,
        ...result,
        note: 'Memoria de pronunciación/estilo por sujeto; no almacena audio ni texto original.',
        authorizationPerformed: false,
        executionPerformed: false,
      });
    } catch (error) {
      if (error instanceof IvccMemoryError) {
        fail(res, 400, error.code, { detail: error.message });
        return;
      }
      if (error instanceof IvccConsentError) {
        fail(res, 400, error.code, { detail: error.message });
        return;
      }
      fail(res, 500, 'IVCC_MEMORY_WRITE_FAILED');
    }
  });

  app.delete('/api/v1/ivcc/memory', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!ensureDurable(deps, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-memory-erase')) return;
    const body = asRecord(req.body);
    const subjectRef =
      typeof body.subjectRef === 'string'
        ? body.subjectRef
        : typeof req.query.subjectRef === 'string'
          ? req.query.subjectRef
          : '';
    try {
      const result = await engine.eraseMemory(subjectRef, actorOf(req));
      res.json({
        success: true,
        ...result,
        authorizationPerformed: false,
        executionPerformed: false,
      });
    } catch (error) {
      if (error instanceof IvccConsentError) {
        fail(res, 400, error.code, { detail: error.message });
        return;
      }
      fail(res, 500, 'IVCC_MEMORY_ERASE_FAILED');
    }
  });

  app.post('/api/v1/synthesize', async (req, res) => {
    if (!deps.authorizeSynthesis(req, res)) return;
    if (!ensureDurable(deps, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ivcc-synthesize')) return;
    const parsed = parsePlanRequest(req);
    if (!parsed.ok) {
      fail(res, parsed.status, parsed.error);
      return;
    }
    try {
      const result = await engine.synthesize(parsed.value, actorOf(req), {
        allowWithoutUsageToken: deps.isAdminAuthorized(req),
      });
      if (result.status === 'denied') {
        res.status(httpStatus(result.reason)).json({ success: false, ...result });
        return;
      }
      if (result.audioStatus === 'audio' && result.audio && deps.recordEvidence) {
        try {
          deps.recordEvidence({
            traceId: result.traceId,
            profileId: result.identity.profileId,
            backend: result.backend,
            audioSha256: result.audio.sha256,
            bytes: result.audio.bytes,
            mastered: result.audio.mastered,
            watermarked: result.audio.watermarked,
          });
        } catch {
          // Evidence sinks must never break speech delivery.
        }
      }
      res.json({ success: true, ...result });
    } catch {
      fail(res, 500, 'IVCC_SYNTHESIS_FAILED');
    }
  });
}
