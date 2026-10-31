// Isabella Local Agent HTTP surface (state: wired | tested (unit)).
// The agent runs allowlisted local tools only: no shell, filesystem, network or
// model. Administrative approval is decided HERE from a verified bearer token;
// a request body can never grant it. Reads do not create authority.
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type { LocalAgentRuntime } from '../agents/runtime';

export const AGENT_ROUTES_VERSION = '1.0.0' as const;

export interface AgentRouteDeps {
  readonly app: Application;
  readonly agent: LocalAgentRuntime;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Server-side check of the administrative bearer token. Never reads the body. */
  readonly isAdminAuthorized: (req: Request) => boolean;
}

export function registerAgentRoutes(deps: AgentRouteDeps): void {
  const { app } = deps;

  app.get('/api/v1/agents', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'agent-catalog')) return;
    res.json({
      success: true,
      version: AGENT_ROUTES_VERSION,
      agents: [deps.agent.describe()],
      executionPolicy: {
        engine: 'local-deterministic',
        modelRequired: false,
        networkRequired: false,
        free: true,
        allowedSideEffects: ['read'],
        approvalRequiredFor: ['write'],
        canonicalMemoryMutation: false,
      },
      disclaimers: [
        'El agente local no usa un modelo de lenguaje ni red externa; sus respuestas dependen de herramientas acotadas.',
        'Listar herramientas o ejecutar lecturas no concede autoridad ni modifica la memoria canónica.',
      ],
    });
  });

  app.post('/api/v1/agents/run', async (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'agent-run')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input = typeof body.input === 'string' ? body.input : '';
    const approvalGranted = deps.isAdminAuthorized(req);
    const result = await deps.agent.run({
      input,
      approvalGranted,
      actorId: approvalGranted ? 'service:genesis-admin-token' : 'human:public-session',
      ...(typeof body.agentId === 'string' ? { agentId: body.agentId } : {}),
      ...(typeof body.requestId === 'string' ? { requestId: body.requestId } : {}),
    });
    const status = result.success ? 200 : result.error === 'AGENT_NOT_FOUND' ? 404 : 400;
    res.status(status).json({
      ...result,
      approvalSource: approvalGranted ? 'verified-admin-token' : 'none',
    });
  });
}
