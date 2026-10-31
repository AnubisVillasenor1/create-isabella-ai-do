// ISABELLA Ω · Marketplace de capacidades (state: draft | engine-generated) expone el
// catálogo nativo de customización (reglas, skills, plugins, hooks, MCP) y el marketplace
// de packs de solo lectura. Los GET son viewer; el POST de plan es admin-gated.
//
// Invariante: catalogar, resolver y planificar NO autoriza, NO instala y NO ejecuta. Los
// packs salen `enabled: false` y toda respuesta de plan declara `authorizationPerformed:false`.
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type {
  CustomizationEntry,
  MarketplaceCatalog,
  MarketplacePack,
  MarketplacePlan,
  MarketplaceSnapshot,
} from '../customization';
import { MARKETPLACE_METHOD_ID } from '../customization';

export const MARKETPLACE_ROUTES_VERSION = '1.0.0' as const;

export interface MarketplaceRouteDeps {
  readonly app: Application;
  readonly catalog: () => MarketplaceCatalog;
  readonly detail: (id: string) => CustomizationEntry | undefined;
  readonly snapshot: () => MarketplaceSnapshot;
  readonly pack: (id: string) => MarketplacePack | undefined;
  readonly plan: (id: string) => MarketplacePlan | undefined;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate. Required for planning mutations; absence fails closed. */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

export function registerMarketplaceRoutes(deps: MarketplaceRouteDeps): void {
  const { app } = deps;

  app.get('/api/v1/customization/catalog', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'customization-catalog')) return;
    const catalog = deps.catalog();
    res.json({
      success: true,
      methodId: MARKETPLACE_METHOD_ID,
      authorizationPerformed: false,
      kindCounts: catalog.kindCounts,
      count: catalog.entries.length,
      entries: catalog.entries,
    });
  });

  app.get('/api/v1/customization/catalog/:id', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'customization-detail')) return;
    const id = String(req.params.id ?? '');
    const entry = deps.detail(id);
    if (!entry) {
      res.status(404).json({ success: false, error: 'CUSTOMIZATION_NOT_FOUND', id });
      return;
    }
    res.json({
      success: true,
      methodId: MARKETPLACE_METHOD_ID,
      authorizationPerformed: false,
      entry,
    });
  });

  app.get('/api/v1/marketplace', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'marketplace-snapshot')) return;
    res.json({ success: true, ...deps.snapshot() });
  });

  app.get('/api/v1/marketplace/:packId', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'marketplace-pack')) return;
    const id = String(req.params.packId ?? '');
    const pack = deps.pack(id);
    if (!pack) {
      res.status(404).json({ success: false, error: 'MARKETPLACE_PACK_NOT_FOUND', id });
      return;
    }
    res.json({ success: true, authorizationPerformed: false, pack });
  });

  app.post('/api/v1/marketplace/plan', (req, res) => {
    if (!deps.authorizeAdmin) {
      res.status(503).json({ success: false, error: 'MARKETPLACE_ADMIN_GATE_UNAVAILABLE' });
      return;
    }
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'marketplace-plan')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const packId = typeof body.packId === 'string' ? body.packId.trim() : '';
    if (!packId) {
      res.status(400).json({ success: false, error: 'MARKETPLACE_PACK_ID_REQUIRED' });
      return;
    }
    const plan = deps.plan(packId);
    if (!plan) {
      res.status(404).json({ success: false, error: 'MARKETPLACE_PACK_NOT_FOUND', id: packId });
      return;
    }
    res.json({ success: true, ...plan });
  });
}
