/**
 * Native program registration and API-key issuance.
 *
 * Security model:
 * - Issuance/rotation/revocation require the operator admin bearer token.
 * - Only the digest is persisted; the secret is returned exactly once.
 * - Keys carry explicit scopes and an optional expiry.
 * - The raw secret is never logged, listed or written to the audit sink.
 * - Writes await the persistence backend because a durable store commits one row
 *   per action; verification stays synchronous so the auth hot path never awaits.
 * - Backend faults answer 503 with a fixed code: driver error text (host, port,
 *   SQL) is never echoed to the client.
 */
import type { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import {
  API_KEY_SCOPES,
  type ApiKeyScope,
  type IsabellaApiKeyStore,
} from '../security/isabella-api-keys';

export const API_KEY_ROUTES_VERSION = '1.0.0';

export interface ApiKeyRouteDeps {
  readonly app: Application;
  readonly store: IsabellaApiKeyStore;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  readonly recordEvidence?: (event: {
    action: 'issue' | 'rotate' | 'revoke';
    tenantId: string;
    keyId: string;
  }) => void;
}

const SCOPE_SET: ReadonlySet<string> = new Set(API_KEY_SCOPES);
const PROGRAM_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/;
const MAX_NAME = 80;

/** Validation faults raised by the store: they are the caller's mistake, not an outage. */
const INPUT_FAULT_CODES: ReadonlySet<string> = new Set([
  'API_KEY_INPUT_INVALID',
  'API_KEY_EXPIRY_INVALID',
  'API_KEY_STORE_FULL',
]);

function storeFault(res: Response, error: unknown, outageCode: string): void {
  const message = error instanceof Error ? error.message : '';
  if (INPUT_FAULT_CODES.has(message)) {
    res.status(400).json({ success: false, error: message });
    return;
  }
  res.status(503).json({ success: false, error: outageCode });
}

function scopesFrom(value: unknown): ApiKeyScope[] | null {
  if (!Array.isArray(value)) return ['cognition:read', 'cognition:write'];
  const scopes = [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))];
  if (scopes.length === 0 || scopes.some((scope) => !SCOPE_SET.has(scope))) return null;
  return scopes as ApiKeyScope[];
}

function slug(value: string): string {
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'program';
}

function keyHeader(req: Request): string {
  const direct = req.get('x-isabella-api-key')?.trim();
  if (direct) return direct;
  const authorization = req.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(isa_live_[A-Za-z0-9_-]+)$/i.exec(authorization);
  return match?.[1] ?? '';
}

/** Strict authenticator for programmatic surfaces. Verification is synchronous by design. */
export function createApiKeyAuthenticator(
  store: IsabellaApiKeyStore,
  requiredScope?: ApiKeyScope
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const secret = keyHeader(req);
    if (!secret) {
      res.status(401).json({ success: false, error: 'API_KEY_REQUIRED' });
      return;
    }
    const verdict = store.verify(secret, requiredScope);
    if (!verdict.ok) {
      res.status(verdict.reason === 'scope' ? 403 : 401).json({
        success: false,
        error: `API_KEY_${verdict.reason.toUpperCase()}`,
      });
      return;
    }
    res.locals.isabellaApiKey = verdict.record;
    next();
  };
}

/**
 * Optional authenticator: requests without a key continue to the public route;
 * a present-but-invalid key fails closed instead of silently downgrading.
 */
export function createOptionalApiKeyAuthenticator(store: IsabellaApiKeyStore): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const secret = keyHeader(req);
    if (!secret) {
      next();
      return;
    }
    const verdict = store.verify(secret);
    if (!verdict.ok) {
      res.status(401).json({ success: false, error: `API_KEY_${verdict.reason.toUpperCase()}` });
      return;
    }
    res.locals.isabellaApiKey = verdict.record;
    next();
  };
}

export function registerApiKeyRoutes(deps: ApiKeyRouteDeps): void {
  const { app, store } = deps;

  app.get('/api/v1/developer/me', createApiKeyAuthenticator(store), (_req, res) => {
    const record = res.locals.isabellaApiKey;
    if (!record) {
      res.status(401).json({ success: false, error: 'API_KEY_REQUIRED' });
      return;
    }
    res.json({
      success: true,
      key: record,
      scopes: record.scopes,
      authorizationPerformed: true,
      executionPerformed: false,
    });
  });

  app.post('/api/v1/admin/programs', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'api-key-issue')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
    const requestedId = typeof body.programId === 'string' ? body.programId.trim() : '';
    const tenantId = requestedId || `${slug(name)}-${Math.random().toString(16).slice(2, 6)}`;
    if (!name || !PROGRAM_ID.test(tenantId)) {
      res.status(400).json({ success: false, error: 'PROGRAM_INPUT_INVALID' });
      return;
    }
    const scopes = scopesFrom(body.scopes);
    if (!scopes) {
      res.status(400).json({ success: false, error: 'API_KEY_SCOPES_INVALID' });
      return;
    }
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : null;
    let issued;
    try {
      issued = await store.issue({ tenantId, name, scopes, expiresAt });
    } catch (error) {
      storeFault(res, error, 'API_KEY_ISSUE_UNAVAILABLE');
      return;
    }
    try {
      deps.recordEvidence?.({ action: 'issue', tenantId, keyId: issued.record.id });
    } catch {
      /* audit sinks must not break issuance */
    }
    res.status(201).json({
      success: true,
      program: { id: tenantId, name },
      key: { ...issued.record, secret: issued.secret },
      warning: 'Save this secret now. It is stored only as a digest and cannot be recovered.',
      authorizationPerformed: true,
      executionPerformed: false,
    });
  });

  app.get('/api/v1/admin/api-keys', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    res.json({ success: true, keys: store.list(tenantId), count: store.list(tenantId).length });
  });

  app.post('/api/v1/admin/api-keys/:id/rotate', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'api-key-rotate')) return;
    let rotated;
    try {
      rotated = await store.rotate(req.params.id);
    } catch (error) {
      storeFault(res, error, 'API_KEY_ROTATE_UNAVAILABLE');
      return;
    }
    if (!rotated) {
      res.status(404).json({ success: false, error: 'API_KEY_NOT_FOUND_OR_INACTIVE' });
      return;
    }
    try {
      deps.recordEvidence?.({
        action: 'rotate',
        tenantId: rotated.record.tenantId,
        keyId: rotated.record.id,
      });
    } catch {
      /* noop */
    }
    res.json({
      success: true,
      key: { ...rotated.record, secret: rotated.secret },
      warning: 'Save this secret now. The previous secret is no longer valid.',
    });
  });

  app.delete('/api/v1/admin/api-keys/:id', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'api-key-revoke')) return;
    const record = store.get(req.params.id);
    if (!record) {
      res.status(404).json({ success: false, error: 'API_KEY_NOT_FOUND_OR_REVOKED' });
      return;
    }
    let revoked: boolean;
    try {
      revoked = await store.revoke(record.id);
    } catch (error) {
      storeFault(res, error, 'API_KEY_REVOKE_UNAVAILABLE');
      return;
    }
    if (!revoked) {
      res.status(404).json({ success: false, error: 'API_KEY_NOT_FOUND_OR_REVOKED' });
      return;
    }
    try {
      deps.recordEvidence?.({ action: 'revoke', tenantId: record.tenantId, keyId: record.id });
    } catch {
      /* noop */
    }
    res.json({ success: true, revoked: true, id: record.id });
  });
}
