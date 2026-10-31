// Turbo Route Planner Ω HTTP surface — returns an auditable low-latency routing
// plan (FAST/GROUNDED/AGENT/HUMAN_REVIEW) with required vs. skippable governed
// filters, a cache policy and the federated scope.
//
// Invariant: planning a route NEVER authorizes nor executes. The route is a flow
// recommendation; CROWN still authorizes and BookPI still records evidence.
//
// state: draft | engine-generated.
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type { TurboPlan, TurboRequest } from '../intelligence/turbo-planner';

export const TURBO_PLANNER_ROUTES_VERSION = '1.0.0';

export interface TurboPlannerRouteDeps {
  readonly app: Application;
  readonly planTurboRoute: (request: TurboRequest) => TurboPlan;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate. When omitted, no token is required. */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

export function registerTurboPlannerRoutes(deps: TurboPlannerRouteDeps): void {
  const { app } = deps;

  app.post('/api/v1/intelligence/turbo-plan', (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'intelligence-turbo-plan')) return;
    try {
      const request = (req.body ?? {}).request as TurboRequest | undefined;
      if (!request) {
        res.status(400).json({ success: false, error: 'request es requerido' });
        return;
      }
      const plan = deps.planTurboRoute(request);
      res.json({ success: true, authorizationPerformed: false, executionPerformed: false, plan });
    } catch (err) {
      res
        .status(400)
        .json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
