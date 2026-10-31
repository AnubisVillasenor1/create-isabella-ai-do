// ISABELLA Ω · Hugging Face Hub surface (state: draft | engine-generated) expone el
// catálogo de modelos/datasets del Hub (información) y la ingesta PROPUESTA de una
// model card de dataset (datos). El GET es de solo lectura; el POST es admin-gated.
//
// Invariante: leer/catalogar NO autoriza ni ejecuta; ingerir NO admite conocimiento
// verificado (los documentos salen PENDING_REVIEW). No se usa el router de inferencia
// (de pago): esta superficie no genera texto.
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import type {
  HfCatalogInput,
  HfCatalogResult,
  HfIngestInput,
  HfKnowledgeDocument,
} from '../hf-hub';
import { HF_HUB_METHOD_ID, HF_VERIFIED_REFERENCES, hfReferencesForDomain } from '../hf-hub';

export const HF_HUB_ROUTES_VERSION = '1.0.0' as const;

export interface HfHubRouteDeps {
  readonly app: Application;
  readonly queryCatalog: (input: HfCatalogInput) => Promise<HfCatalogResult>;
  readonly ingestDataset: (input: HfIngestInput) => Promise<HfKnowledgeDocument>;
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

export function registerHfHubRoutes(deps: HfHubRouteDeps): void {
  const { app } = deps;

  app.get('/api/v1/hf/catalog', async (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'hf-catalog')) return;
    const query = (req.query ?? {}) as Record<string, unknown>;
    const task = typeof query.task === 'string' ? query.task : undefined;
    const search = typeof query.search === 'string' ? query.search : undefined;
    const parsedLimit = typeof query.limit === 'string' ? Number(query.limit) : Number.NaN;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    try {
      const catalog = await deps.queryCatalog({
        ...(task ? { task } : {}),
        ...(search ? { search } : {}),
        ...(limit !== undefined ? { limit } : {}),
      });
      res.json({ success: true, methodId: HF_HUB_METHOD_ID, ...catalog });
    } catch (error) {
      res
        .status(502)
        .json({ success: false, error: error instanceof Error ? error.message : 'HF_HUB_FAILED' });
    }
  });

  app.post('/api/v1/hf/ingest', async (req, res) => {
    if (deps.authorizeAdmin && !deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'hf-ingest')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const datasetId = typeof body.datasetId === 'string' ? body.datasetId.trim() : '';
    if (!datasetId) {
      res.status(400).json({ success: false, error: 'HF_HUB_DATASET_ID_REQUIRED' });
      return;
    }
    try {
      const input: HfIngestInput = {
        datasetId,
        ...(typeof body.revision === 'string' && body.revision.trim()
          ? { revision: body.revision.trim() }
          : {}),
      };
      const document = await deps.ingestDataset(input);
      res.json({
        success: true,
        authorizationPerformed: false,
        knowledgeAdmitted: false,
        document,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'HF_HUB_INGEST_FAILED';
      const status = message.includes('UNSAFE') || message.includes('REQUIRED') ? 400 : 502;
      res.status(status).json({ success: false, error: message });
    }
  });

  // Referencias verificadas del Hub por dominio nativo (descubrimiento, NO ejecución).
  // Cada entrada se comprobó que existe en huggingface.co; la licencia se transcribe
  // de la tarjeta del Hub y debe revalidarse antes de uso comercial.
  app.get('/api/v1/hf/references', (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'hf-references')) return;
    const query = (req.query ?? {}) as Record<string, unknown>;
    const domain = typeof query.domain === 'string' ? query.domain.trim() : '';
    const allowed = ['llm', 'moe', 'tts', 'asr'] as const;
    const references =
      domain && (allowed as readonly string[]).includes(domain)
        ? hfReferencesForDomain(domain as (typeof allowed)[number])
        : HF_VERIFIED_REFERENCES;
    res.json({
      success: true,
      authorizationPerformed: false,
      executionPerformed: false,
      downloaded: false,
      methodId: HF_HUB_METHOD_ID,
      disclaimer:
        'Referencias verificadas (existencia comprobada en el Hub). Isabella NO carga ni ejecuta estos pesos; la licencia debe revalidarse antes de cualquier uso comercial.',
      count: references.length,
      references,
    });
  });
}
