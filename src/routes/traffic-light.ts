// Governed Flow Traffic Light Ω HTTP surface — classifies an incoming request into a
// traffic band (GREEN/YELLOW/ORANGE/RED) and returns the governed filter plan that
// corresponds. It is an auditable flow classifier, not an executor.
//
// Invariant: classifying a flow NEVER authorizes nor executes. GREEN runs only the
// minimal filters (AEGIS, CROWN, SANITIZATION); CROWN still authorizes and BookPI
// still records evidence for every band.
//
// state: draft | engine-generated.
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type { TrafficLightInput, TrafficLightVerdict } from '../governance/traffic-light';

export const TRAFFIC_LIGHT_ROUTES_VERSION = '1.0.0';

export interface TrafficLightRouteDeps {
  readonly app: Application;
  readonly classifyFlow: (input: TrafficLightInput) => TrafficLightVerdict;
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

export function registerTrafficLightRoutes(deps: TrafficLightRouteDeps): void {
  const { app } = deps;

  app.post('/api/v1/intelligence/triage', (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'intelligence-triage')) return;
    try {
      const body = (req.body ?? {}) as Partial<TrafficLightInput>;
      const input = typeof body.input === 'string' ? body.input : '';
      const triage = deps.classifyFlow({
        input,
        ...(typeof body.inputTokens === 'number' ? { inputTokens: body.inputTokens } : {}),
        ...(typeof body.expectedOutputTokens === 'number'
          ? { expectedOutputTokens: body.expectedOutputTokens }
          : {}),
        ...(typeof body.principalId === 'string' ? { principalId: body.principalId } : {}),
        ...(typeof body.federationId === 'number' ? { federationId: body.federationId } : {}),
        ...(typeof body.territory === 'string' ? { territory: body.territory } : {}),
        ...(typeof body.requiresTools === 'boolean' ? { requiresTools: body.requiresTools } : {}),
        ...(typeof body.requiresMemory === 'boolean'
          ? { requiresMemory: body.requiresMemory }
          : {}),
        ...(Array.isArray(body.highImpactTriggers)
          ? { highImpactTriggers: body.highImpactTriggers }
          : {}),
      });
      res.json({ success: true, authorizationPerformed: false, executionPerformed: false, triage });
    } catch (err) {
      res
        .status(400)
        .json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
