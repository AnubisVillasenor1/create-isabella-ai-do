// ISABELLA Ω v3.1 · IHEC emergency surface (state: draft | engine-generated) expone
// los 12 subsistemas de continuidad: estado, snapshot, recuperación, reparación,
// gobernanza, failover, caché, RAG++, telemetría, crisis, mutación y topología.
//
// Invariante: IHEC clasifica, evidencia y se recupera; NO autoriza ni ejecuta.
// Los POST están admin-gated; los GET son de solo lectura (viewer). Toda respuesta
// declara `authorizationPerformed:false`.
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type { Ihec, IhecRagCandidate, IhecRuntimeState } from '../ihec';
import { ihecSummary } from '../ihec';

export const IHEC_ROUTES_VERSION = '1.0.0' as const;

export interface IhecRouteDeps {
  readonly app: Application;
  /** Instancia viva del Hyper Emergency Core (estado en proceso del runtime). */
  readonly ihec: Ihec;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate. When omitted, no token is required (development). */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function admin(deps: IhecRouteDeps, req: Request, res: Response): boolean {
  if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return false;
  return true;
}

export function registerIhecRoutes(deps: IhecRouteDeps): void {
  const { app, ihec } = deps;

  app.get('/api/v1/emergency/status', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-status')) return;
    res.json({
      success: true,
      authorizationPerformed: false,
      ...ihecSummary(),
      omegaActive: ihec.omegaMode.active(),
      cache: ihec.cache.stats(),
      crises: ihec.crisisMemory.all().length,
      guards: ihec.immuneMutation.all().length,
      governanceDecisions: ihec.governance.trail().length,
    });
  });

  app.post('/api/v1/emergency/snapshot', (req, res) => {
    if (!admin(deps, req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-snapshot')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: IhecRuntimeState = {
      ...(isRecord(body.state) ? { state: body.state } : {}),
      ...(Array.isArray(body.memory) ? { memory: body.memory } : {}),
      ...(Array.isArray(body.embeddings) ? { embeddings: body.embeddings } : {}),
      ...(isRecord(body.graph) ? { graph: body.graph } : {}),
      ...(isRecord(body.credentials)
        ? { credentials: body.credentials as Record<string, string> }
        : {}),
    };
    const snapshot = ihec.snapshot.capture(input);
    res.json({
      success: true,
      authorizationPerformed: false,
      hash: snapshot.hash,
      capturedAt: snapshot.capturedAt,
      sizes: {
        memory: snapshot.memory.length,
        embeddings: snapshot.embeddings.length,
        credentials: Object.keys(snapshot.credentials).length,
      },
    });
  });

  app.post('/api/v1/emergency/recover', (req, res) => {
    if (!admin(deps, req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-recover')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isRecord(body.snapshot)) {
      res.status(400).json({ success: false, error: 'IHEC_SNAPSHOT_REQUIRED' });
      return;
    }
    try {
      const recovery = ihec.recovery.restore(body.snapshot as never);
      res.json({
        success: true,
        authorizationPerformed: false,
        restoredFrom: recovery.restoredFrom,
        integrityVerified: recovery.integrityVerified,
        sizes: {
          memory: recovery.memory.length,
          embeddings: recovery.embeddings.length,
          credentials: Object.keys(recovery.credentials).length,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'IHEC_RECOVER_FAILED',
      });
    }
  });

  app.post('/api/v1/emergency/repair', (req, res) => {
    if (!admin(deps, req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-repair')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const federation =
      typeof body.federation === 'string' && body.federation.trim()
        ? body.federation.trim()
        : 'federation:real-del-monte';
    const plan = ihec.topology.reconfigure(federation);
    res.json({ success: true, authorizationPerformed: false, executionPerformed: false, plan });
  });

  app.get('/api/v1/emergency/governance', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-governance')) return;
    res.json({ success: true, authorizationPerformed: false, decisions: ihec.governance.trail() });
  });

  app.post('/api/v1/emergency/failover', (req, res) => {
    if (!admin(deps, req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-failover')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const federation =
      typeof body.federation === 'string' && body.federation.trim()
        ? body.federation.trim()
        : 'federation:real-del-monte';
    const reason =
      typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim()
        : 'manual-failover';
    const plan = ihec.activateFailover(federation);
    const decision = ihec.governance.record('FAILOVER', reason, null);
    res.json({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
      plan,
      decision,
      governance: ihec.governance.trail(),
    });
  });

  app.get('/api/v1/emergency/cache', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-cache')) return;
    res.json({ success: true, authorizationPerformed: false, stats: ihec.cache.stats() });
  });

  app.post('/api/v1/emergency/rag', (req, res) => {
    if (!admin(deps, req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-rag')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const query = typeof body.query === 'string' ? body.query : '';
    const candidates: readonly IhecRagCandidate[] = Array.isArray(body.candidates)
      ? (body.candidates.filter(isRecord) as unknown as readonly IhecRagCandidate[])
      : [];
    const limit = typeof body.limit === 'number' ? body.limit : 5;
    const result = ihec.rag.search(query, candidates, limit);
    res.json({ success: true, authorizationPerformed: false, result });
  });

  app.get('/api/v1/emergency/telemetry', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-telemetry')) return;
    res.json({
      success: true,
      authorizationPerformed: false,
      crisisCount: ihec.crisisMemory.all().length,
      guardCount: ihec.immuneMutation.all().length,
      governanceCount: ihec.governance.trail().length,
      omegaActive: ihec.omegaMode.active(),
      cache: ihec.cache.stats(),
    });
  });

  app.get('/api/v1/emergency/crisis', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-crisis')) return;
    res.json({ success: true, authorizationPerformed: false, records: ihec.crisisMemory.all() });
  });

  app.get('/api/v1/emergency/mutation', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-mutation')) return;
    res.json({ success: true, authorizationPerformed: false, guards: ihec.immuneMutation.all() });
  });

  app.get('/api/v1/emergency/topology', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'ihec-topology')) return;
    const query = (req.query ?? {}) as Record<string, unknown>;
    const federation =
      typeof query.federation === 'string' && query.federation.trim()
        ? query.federation.trim()
        : 'federation:real-del-monte';
    const plan = ihec.topology.reconfigure(federation);
    res.json({ success: true, authorizationPerformed: false, plan });
  });
}
