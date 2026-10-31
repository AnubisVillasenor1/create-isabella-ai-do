import { describe, expect, it } from 'vitest';
import type { Application, Request, Response } from 'express';
import type { FixedWindowRateLimiter } from '../../src/security/rate-limit';
import {
  FederationRegistry,
  signPayload,
  type FederationPersistence,
} from '../../src/federation/connectors';
import { registerFederationRoutes } from '../../src/routes/federation';

type FederationFile = Parameters<FederationPersistence['save']>[0];
type Handler = (req: Request, res: Response) => void | Promise<void>;

const SECRET = 'federation-secret-with-at-least-32-characters';

function memoryPersistence(): FederationPersistence {
  let saved: FederationFile = { connectors: [], inbox: [] };
  return {
    load: () => saved,
    save: (file) => {
      saved = file;
    },
  };
}

function harness(options: { admin?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const reg =
    (method: string) =>
    (path: string, handler: Handler): void => {
      handlers.set(`${method} ${path}`, handler);
    };
  const app = {
    get: reg('GET'),
    post: reg('POST'),
    delete: reg('DELETE'),
  } as unknown as Application;
  const registry = new FederationRegistry(memoryPersistence());
  const evidence: unknown[] = [];
  registerFederationRoutes({
    app,
    registry,
    env: { ISABELLA_FEDERATION_SECRET: SECRET, ISABELLA_KEYLESS_FREE_PROVIDER: 'pollinations' },
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
    authorizeAdmin: (_req, res) => {
      if (options.admin === false) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        return false;
      }
      return true;
    },
    readRawBody: (req) => (req as Request & { rawBody?: string }).rawBody,
    recordEvidence: (event) => {
      evidence.push(event);
    },
  });
  return { handlers, registry, evidence };
}

async function call(
  handlers: Map<string, Handler>,
  key: string,
  input: {
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    params?: Record<string, string>;
  } = {}
) {
  const out = {
    status: 200,
    body: undefined as unknown,
    text: undefined as string | undefined,
    headers: {} as Record<string, string>,
  };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(value: unknown) {
      out.body = value;
      return this;
    },
    type(_value: string) {
      return this;
    },
    send(value: string) {
      out.text = value;
      return this;
    },
    setHeader(name: string, value: string) {
      out.headers[name.toLowerCase()] = value;
      return this;
    },
  } as unknown as Response;
  const req = {
    body: input.body,
    rawBody: input.rawBody,
    query: input.query ?? {},
    params: input.params ?? {},
    protocol: 'https',
    ip: '1.2.3.4',
    get(name: string) {
      return input.headers?.[name.toLowerCase()];
    },
  } as unknown as Request;
  await handlers.get(key)!(req, res);
  return out;
}

describe('federation routes', () => {
  it('publishes status, catalog and runtime connectivity without secrets', async () => {
    const { handlers, registry } = harness();
    await registry.createConnector({ name: 'principal', kind: 'whatsapp' });

    const status = await call(handlers, 'GET /api/v1/federation/node');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      success: true,
      connectors: 1,
      signingConfigured: true,
    });
    expect(JSON.stringify(status.body)).not.toContain(SECRET);

    const models = await call(handlers, 'GET /api/v1/federation/models');
    expect(models.body).toMatchObject({ success: true, models: expect.any(Array) });
    expect(JSON.stringify(models.body)).toContain('keyless-pollinations');

    const catalog = await call(handlers, 'GET /api/v1/federation/catalog');
    expect(catalog.body).toMatchObject({ openapi: '3.1.0' });
  });

  it('accepts a signed webhook once and rejects tampering or replay', async () => {
    const { handlers, registry, evidence } = harness();
    const connector = await registry.createConnector({ name: 'evolution', kind: 'evolution' });
    const payload = {
      data: {
        messages: [
          {
            key: { remoteJid: '5215550000000@s.whatsapp.net', id: 'msg-1' },
            message: { conversation: 'Hola Isabella' },
          },
        ],
      },
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signPayload(SECRET, timestamp, rawBody);
    const key = 'POST /api/v1/federation/webhooks/:connectorId';

    const accepted = await call(handlers, key, {
      body: payload,
      rawBody,
      params: { connectorId: connector.id },
      headers: { 'x-isabella-timestamp': timestamp, 'x-isabella-signature': signature },
    });
    expect(accepted.status).toBe(202);
    expect(accepted.body).toMatchObject({
      accepted: true,
      connectorId: connector.id,
      authorizationPerformed: false,
      executionPerformed: false,
    });
    expect(evidence).toHaveLength(1);

    const replay = await call(handlers, key, {
      body: payload,
      rawBody,
      params: { connectorId: connector.id },
      headers: { 'x-isabella-timestamp': timestamp, 'x-isabella-signature': signature },
    });
    expect(replay.status).toBe(409);

    const tampered = await call(handlers, key, {
      body: payload,
      rawBody: `${rawBody} `,
      params: { connectorId: connector.id },
      headers: { 'x-isabella-timestamp': timestamp, 'x-isabella-signature': signature },
    });
    expect(tampered.status).toBe(401);
  });

  it('gates connector administration behind the operator token', async () => {
    const denied = harness({ admin: false });
    const result = await call(denied.handlers, 'POST /api/v1/federation/connectors', {
      body: { name: 'bloqueado', kind: 'webhook' },
    });
    expect(result.status).toBe(401);
    expect(denied.registry.listConnectors()).toHaveLength(0);

    const allowed = harness();
    const created = await call(allowed.handlers, 'POST /api/v1/federation/connectors', {
      body: { name: 'permitido', kind: 'webhook' },
    });
    expect(created.status).toBe(201);
    expect(allowed.registry.listConnectors()).toHaveLength(1);
  });

  it('answers 503 with a fixed code when the durable store rejects a write', async () => {
    const handlers = new Map<string, Handler>();
    const reg =
      (method: string) =>
      (path: string, handler: Handler): void => {
        handlers.set(`${method} ${path}`, handler);
      };
    const app = { get: reg('GET'), post: reg('POST'), delete: reg('DELETE') } as unknown as Application;
    const failing: FederationPersistence = {
      load: () => ({ connectors: [], inbox: [] }),
      save: () => undefined,
      insertConnector: async () => {
        throw new Error('connection to db:5432 failed: password=leaked');
      },
    };
    const registry = new FederationRegistry(failing);
    registerFederationRoutes({
      app,
      registry,
      env: { ISABELLA_FEDERATION_SECRET: SECRET },
      enforceRateLimit: () => true,
      rateLimiter: {} as FixedWindowRateLimiter,
      authorizeAdmin: () => true,
      readRawBody: () => undefined,
    });
    const created = await call(handlers, 'POST /api/v1/federation/connectors', {
      body: { name: 'duradero', kind: 'webhook' },
    });
    expect(created.status).toBe(503);
    expect(created.body).toEqual({ success: false, error: 'CONNECTOR_CREATE_UNAVAILABLE' });
    expect(JSON.stringify(created.body)).not.toContain('leaked');
    expect(registry.listConnectors()).toHaveLength(0);
  });
});
