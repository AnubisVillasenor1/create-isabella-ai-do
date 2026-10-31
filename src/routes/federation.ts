/**
 * Native federation HTTP surface.
 *
 * Connectors receive signed inbound events, normalize them into a bounded inbox
 * and expose an OpenAPI/model catalog. Ingress NEVER grants authority, never
 * triggers a tool and never forwards the payload to a model automatically.
 * Connector and inbox writes await the persistence backend; reads stay
 * synchronous. Backend faults answer 503 with a fixed code so driver text never
 * reaches the client.
 */
import { timingSafeEqual } from 'node:crypto';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../security/rate-limit';
import {
  CONNECTOR_KINDS,
  federationSecret,
  normalizeInboundPayload,
  verifyPayloadSignature,
  type ConnectorKind,
  type FederationRegistry,
} from '../federation/connectors';
import { buildFederationOpenApi, describeModelRuntime } from '../federation/openapi';

export const FEDERATION_ROUTES_VERSION = '1.0.0';
const MAX_CHALLENGE = 512;

export interface FederationRouteDeps {
  readonly app: Application;
  readonly registry: FederationRegistry;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  readonly authorizeAdmin: (req: Request, res: Response) => boolean;
  readonly readRawBody: (req: Request) => string | undefined;
  /** Process-local provider outcomes (never secrets); omitted by default. */
  readonly describeProviderRuntime?: () => Record<string, unknown>;
  readonly recordEvidence?: (event: {
    action: 'connector.create' | 'connector.delete' | 'webhook.ingest';
    connectorId: string;
    inboxId?: string;
  }) => void;
}

/** Validation faults raised by the registry: caller mistakes keep the 400 contract. */
const INPUT_FAULT_CODES: ReadonlySet<string> = new Set([
  'CONNECTOR_NAME_REQUIRED',
  'CONNECTOR_KIND_INVALID',
  'CONNECTOR_URL_INVALID',
]);

function registryFault(res: Response, error: unknown, outageCode: string): void {
  const message = error instanceof Error ? error.message : '';
  if (INPUT_FAULT_CODES.has(message)) {
    res.status(400).json({ success: false, error: message });
    return;
  }
  res.status(503).json({ success: false, error: outageCode });
}

function envOf(deps: FederationRouteDeps): Readonly<Record<string, string | undefined>> {
  return deps.env ?? process.env;
}

/** Only absolute http(s) origins are echoed into the OpenAPI document. */
function resolveOrigin(req: Request, env: Readonly<Record<string, string | undefined>>): string {
  const configured = env.PUBLIC_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      /* fall through to request origin */
    }
  }
  const host = req.get('host')?.trim() ?? '';
  if (/^[A-Za-z0-9.-]{1,253}(?::\d{1,5})?$/.test(host)) {
    const protocol = req.protocol === 'https' ? 'https' : 'http';
    return `${protocol}://${host}`;
  }
  return 'http://localhost:3000';
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function connectorKind(value: unknown): ConnectorKind | null {
  return typeof value === 'string' && (CONNECTOR_KINDS as readonly string[]).includes(value)
    ? (value as ConnectorKind)
    : null;
}

function parsedPayload(rawBody: string, body: unknown): unknown {
  if (body && typeof body === 'object') return body;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return {};
  }
}

export function registerFederationRoutes(deps: FederationRouteDeps): void {
  const { app, registry } = deps;

  app.get('/api/v1/federation/node', (req, res) => {
    const env = envOf(deps);
    const catalog = describeModelRuntime(env);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      federationRoutesVersion: FEDERATION_ROUTES_VERSION,
      catalogVersion: catalog.catalogVersion,
      connectors: registry.listConnectors().length,
      inbox: registry.listInbox(200).length,
      signingConfigured: federationSecret(env) !== null,
      verifyTokenConfigured: (env.ISABELLA_FEDERATION_VERIFY_TOKEN ?? '').trim().length >= 16,
      models: catalog.counts,
      speech: catalog.speech,
      providerRuntime: deps.describeProviderRuntime?.() ?? null,
      authority: {
        ingressGrantsAuthority: false,
        ingressExecutesTools: false,
        publicBodiesCannotGrantAuthority: true,
      },
      contracts: [
        'CAPABILITY != AUTHORITY != EXECUTION != EVIDENCE',
        'A signed webhook is evidence of delivery, not permission to act.',
      ],
    });
  });

  app.get('/api/v1/federation/catalog', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(buildFederationOpenApi(resolveOrigin(req, envOf(deps)), envOf(deps)));
  });

  app.get('/api/v1/federation/models', (_req, res) => {
    const catalog = describeModelRuntime(envOf(deps));
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      ...catalog,
      providerRuntime: deps.describeProviderRuntime?.() ?? null,
      note: 'Readiness is derived from local configuration. Describing a model does not call it.',
    });
  });

  app.get('/api/v1/federation/connectors', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    const connectors = registry.listConnectors();
    res.json({
      success: true,
      connectors,
      count: connectors.length,
      signingConfigured: federationSecret(envOf(deps)) !== null,
    });
  });

  app.post('/api/v1/federation/connectors', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'federation-connector-create')) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name : '';
    const kind = connectorKind(body.kind);
    if (!kind) {
      res.status(400).json({ success: false, error: 'CONNECTOR_KIND_INVALID' });
      return;
    }
    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl : null;
    let connector;
    try {
      connector = await registry.createConnector({ name, kind, targetUrl });
    } catch (error) {
      registryFault(res, error, 'CONNECTOR_CREATE_UNAVAILABLE');
      return;
    }
    try {
      deps.recordEvidence?.({ action: 'connector.create', connectorId: connector.id });
    } catch {
      /* audit sinks must not break registration */
    }
    res.status(201).json({
      success: true,
      connector,
      webhookPath: `/api/v1/federation/webhooks/${connector.id}`,
      authorizationPerformed: true,
      executionPerformed: false,
    });
  });

  app.delete('/api/v1/federation/connectors/:id', async (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    let removed: boolean;
    try {
      removed = await registry.removeConnector(req.params.id);
    } catch (error) {
      registryFault(res, error, 'CONNECTOR_DELETE_UNAVAILABLE');
      return;
    }
    if (!removed) {
      res.status(404).json({ success: false, error: 'CONNECTOR_NOT_FOUND' });
      return;
    }
    try {
      deps.recordEvidence?.({ action: 'connector.delete', connectorId: req.params.id });
    } catch {
      /* noop */
    }
    res.json({ success: true, removed: true, id: req.params.id });
  });

  app.get('/api/v1/federation/inbox', (req, res) => {
    if (!deps.authorizeAdmin(req, res)) return;
    const requested = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Number.isFinite(requested) ? requested : 50;
    const entries = registry.listInbox(limit);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, entries, count: entries.length });
  });

  app.get('/api/v1/federation/webhooks/:connectorId', (req, res) => {
    const connector = registry.getConnector(req.params.connectorId);
    if (!connector) {
      res.status(404).json({ success: false, error: 'CONNECTOR_NOT_FOUND' });
      return;
    }
    const env = envOf(deps);
    const expected = (env.ISABELLA_FEDERATION_VERIFY_TOKEN ?? '').trim();
    if (expected.length < 16) {
      res.status(503).json({ success: false, error: 'FEDERATION_VERIFY_TOKEN_NOT_CONFIGURED' });
      return;
    }
    const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : '';
    const token =
      typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : '';
    const challenge =
      typeof req.query['hub.challenge'] === 'string'
        ? req.query['hub.challenge'].slice(0, MAX_CHALLENGE)
        : '';
    if (mode !== 'subscribe' || !token || !safeEqual(token, expected)) {
      res.status(401).json({ success: false, error: 'WEBHOOK_VERIFY_REJECTED' });
      return;
    }
    res.type('text/plain').status(200).send(challenge);
  });

  app.post('/api/v1/federation/webhooks/:connectorId', async (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, 'federation-webhook')) return;
    const env = envOf(deps);
    const secret = federationSecret(env);
    if (!secret) {
      res.status(503).json({ success: false, error: 'FEDERATION_SIGNING_NOT_CONFIGURED' });
      return;
    }
    const connector = registry.getConnector(req.params.connectorId);
    if (!connector) {
      res.status(404).json({ success: false, error: 'CONNECTOR_NOT_FOUND' });
      return;
    }
    const rawBody = deps.readRawBody(req);
    if (!rawBody) {
      res.status(400).json({ success: false, error: 'FEDERATION_RAW_BODY_REQUIRED' });
      return;
    }
    const timestamp =
      req.get('x-isabella-timestamp')?.trim() || req.get('x-federation-timestamp')?.trim() || '';
    const signature =
      req.get('x-isabella-signature')?.trim() || req.get('x-federation-signature')?.trim() || '';
    if (!timestamp || !signature) {
      res.status(401).json({ success: false, error: 'FEDERATION_SIGNATURE_REQUIRED' });
      return;
    }
    if (!verifyPayloadSignature(secret, timestamp, rawBody, signature)) {
      res.status(401).json({ success: false, error: 'FEDERATION_SIGNATURE_INVALID' });
      return;
    }
    const payload = parsedPayload(rawBody, req.body);
    const normalized = normalizeInboundPayload(payload);
    if (
      normalized.remoteMessageId &&
      registry.hasRemoteMessage(connector.id, normalized.remoteMessageId)
    ) {
      res.status(409).json({ success: false, error: 'FEDERATION_REPLAY_DETECTED' });
      return;
    }
    let entry;
    try {
      entry = await registry.ingest(connector, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'FEDERATION_REPLAY_DETECTED') {
        res.status(409).json({ success: false, error: 'FEDERATION_REPLAY_DETECTED' });
        return;
      }
      registryFault(res, error, 'FEDERATION_INGEST_UNAVAILABLE');
      return;
    }
    try {
      deps.recordEvidence?.({
        action: 'webhook.ingest',
        connectorId: connector.id,
        inboxId: entry.id,
      });
    } catch {
      /* noop */
    }
    res.status(202).json({
      success: true,
      accepted: true,
      inboxId: entry.id,
      connectorId: connector.id,
      authorizationPerformed: false,
      executionPerformed: false,
      note: 'Signed ingress stores evidence in the inbox. It does not authorize or execute actions.',
    });
  });
}
