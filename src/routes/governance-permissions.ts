// Permission Map Ω HTTP surface — maps an order to its leveled permission catalog and
// seals an explicit human authorization envelope. Invariant: mapping prepares the human
// decision and authorization records consent; neither endpoint EXECUTES the order.
//
// state: draft | engine-generated.
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import {
  createAuthorizationEnvelope,
  type AuthorizationEnvelope,
  type AuthorizationVerification,
  type OrderIntent,
  type PermissionCatalog,
  type PermissionDecision,
} from '../governance/permission-map';

export const ORDER_PERMISSION_ROUTES_VERSION = '1.0.0';

export interface OrderPermissionRouteDeps {
  readonly app: Application;
  readonly mapOrderPermissions: (order: OrderIntent) => PermissionCatalog;
  readonly verifyOrderAuthorization: (
    envelope: AuthorizationEnvelope,
    catalog: PermissionCatalog
  ) => AuthorizationVerification;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate for the sealing endpoint. When omitted, no token is required. */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

export function registerOrderPermissionRoutes(deps: OrderPermissionRouteDeps): void {
  const { app } = deps;

  app.post('/api/v1/governance/order-permissions', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'governance-permission-map')) return;
    try {
      const order = (req.body ?? {}).order as OrderIntent | undefined;
      if (!order) {
        res.status(400).json({ success: false, error: 'order es requerido' });
        return;
      }
      const catalog = deps.mapOrderPermissions(order);
      res.json({
        success: true,
        authorizationPerformed: false,
        executionPerformed: false,
        catalog,
      });
    } catch (err) {
      res
        .status(400)
        .json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/v1/governance/order-authorize', (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'governance-order-authorize')) return;
    try {
      const body = req.body ?? {};
      const order = body.order as OrderIntent | undefined;
      const principalId = typeof body.principalId === 'string' ? body.principalId : undefined;
      const decisions = Array.isArray(body.decisions)
        ? (body.decisions as PermissionDecision[])
        : undefined;
      if (!order || !principalId || !decisions) {
        res
          .status(400)
          .json({ success: false, error: 'order, principalId y decisions son requeridos' });
        return;
      }
      const catalog = deps.mapOrderPermissions(order);
      const envelope = createAuthorizationEnvelope(catalog, { principalId, decisions });
      const verification = deps.verifyOrderAuthorization(envelope, catalog);
      res.json({ success: true, executionPerformed: false, catalog, envelope, verification });
    } catch (err) {
      res
        .status(400)
        .json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}
