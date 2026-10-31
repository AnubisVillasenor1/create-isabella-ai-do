import { describe, expect, it } from 'vitest';
import {
  FederationRegistry,
  federationSecret,
  normalizeInboundPayload,
  signPayload,
  verifyPayloadSignature,
  type ConnectorRecord,
  type FederationPersistence,
  type InboxEntry,
} from '../../src/federation/connectors';

type FederationFile = Parameters<FederationPersistence['save']>[0];

function memoryPersistence(): FederationPersistence {
  let saved: FederationFile = { connectors: [], inbox: [] };
  return {
    load: () => saved,
    save: (file) => {
      saved = file;
    },
  };
}

interface RowBackend extends FederationPersistence {
  connectors: Map<string, ConnectorRecord>;
  inbox: InboxEntry[];
  rowWrites: number;
  snapshots: number;
  failNextWrite: boolean;
}

/** Row-level fake: snapshot writes are counted so a regression is visible. */
function rowPersistence(): RowBackend {
  const backend: RowBackend = {
    connectors: new Map<string, ConnectorRecord>(),
    inbox: [],
    rowWrites: 0,
    snapshots: 0,
    failNextWrite: false,
    load: () => ({ connectors: [], inbox: [] }),
    save: () => {
      backend.snapshots += 1;
    },
    insertConnector: async (connector) => {
      if (backend.failNextWrite) {
        backend.failNextWrite = false;
        throw new Error('durable write rejected');
      }
      backend.rowWrites += 1;
      backend.connectors.set(connector.id, connector);
    },
    removeConnectorRow: async (id) => {
      if (backend.failNextWrite) {
        backend.failNextWrite = false;
        throw new Error('durable write rejected');
      }
      backend.connectors.delete(id);
    },
    insertInbox: async (entry) => {
      if (backend.failNextWrite) {
        backend.failNextWrite = false;
        throw new Error('durable write rejected');
      }
      backend.rowWrites += 1;
      backend.inbox.unshift(entry);
    },
  };
  return backend;
}

const SECRET = 'federation-secret-with-at-least-32-characters';

describe('native federation connectors', () => {
  it('registers, lists and removes connectors with validated targets', async () => {
    const registry = new FederationRegistry(memoryPersistence());
    const connector = await registry.createConnector({
      name: 'WhatsApp principal',
      kind: 'whatsapp',
      targetUrl: 'https://example.com/hooks/whatsapp',
    });
    expect(registry.listConnectors()).toHaveLength(1);
    expect(registry.getConnector(connector.id)?.kind).toBe('whatsapp');
    await expect(
      registry.createConnector({ name: 'bad', kind: 'webhook', targetUrl: 'http://example.com' })
    ).rejects.toThrow('CONNECTOR_URL_INVALID');
    expect(await registry.removeConnector(connector.id)).toBe(true);
    expect(registry.listConnectors()).toHaveLength(0);
  });

  it('normalizes Evolution/WhatsApp and Cloud API payload shapes', () => {
    expect(
      normalizeInboundPayload({
        data: {
          messages: [
            {
              key: { remoteJid: '5215550000000@s.whatsapp.net', id: 'ABC123' },
              message: { conversation: 'Hola Isabella' },
            },
          ],
        },
      })
    ).toEqual({
      from: '5215550000000@s.whatsapp.net',
      text: 'Hola Isabella',
      remoteMessageId: 'ABC123',
    });

    expect(
      normalizeInboundPayload({
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'phone-1' },
                  messages: [{ from: '5215550000001', id: 'wamid.1', text: { body: 'Hola' } }],
                },
              },
            ],
          },
        ],
      })
    ).toEqual({ from: '5215550000001', text: 'Hola', remoteMessageId: 'wamid.1' });
  });

  it('deduplicates remote messages per connector', async () => {
    const registry = new FederationRegistry(memoryPersistence());
    const connector = await registry.createConnector({ name: 'openwa', kind: 'openwa' });
    const payload = { key: { id: 'msg-1' }, conversation: 'uno' };
    await registry.ingest(connector, payload);
    expect(registry.hasRemoteMessage(connector.id, 'msg-1')).toBe(true);
    expect(registry.hasRemoteMessage(connector.id, 'msg-2')).toBe(false);
    expect(registry.listInbox(10)).toHaveLength(1);
  });

  it('writes one row per mutation instead of a snapshot', async () => {
    const backend = rowPersistence();
    const registry = new FederationRegistry(backend);
    const connector = await registry.createConnector({ name: 'principal', kind: 'whatsapp' });
    await registry.ingest(connector, { key: { id: 'msg-1' }, conversation: 'hola' });
    expect(backend.snapshots).toBe(0);
    expect(backend.rowWrites).toBe(2);
    expect(backend.connectors.get(connector.id)?.name).toBe('principal');
    expect(backend.inbox).toHaveLength(1);
    expect(await registry.removeConnector(connector.id)).toBe(true);
    expect(registry.listConnectors()).toHaveLength(0);
    expect(backend.snapshots).toBe(0);
  });

  it('rolls back registry state when the durable write fails', async () => {
    const backend = rowPersistence();
    const registry = new FederationRegistry(backend);
    backend.failNextWrite = true;
    await expect(registry.createConnector({ name: 'roto', kind: 'webhook' })).rejects.toThrow(
      'durable write rejected'
    );
    expect(registry.listConnectors()).toHaveLength(0);

    const connector = await registry.createConnector({ name: 'ok', kind: 'webhook' });
    backend.failNextWrite = true;
    await expect(registry.ingest(connector, { key: { id: 'x' }, conversation: 'dos' })).rejects.toThrow(
      'durable write rejected'
    );
    expect(registry.listInbox(10)).toHaveLength(0);

    backend.failNextWrite = true;
    await expect(registry.removeConnector(connector.id)).rejects.toThrow('durable write rejected');
    expect(registry.getConnector(connector.id)?.name).toBe('ok');
  });

  it('hydrates rows once and keeps reads synchronous', async () => {
    const receivedAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const registry = new FederationRegistry({
      load: () => ({ connectors: [], inbox: [] }),
      save: () => undefined,
      hydrate: async () => ({
        connectors: [
          {
            id: 'c1',
            name: 'legido',
            kind: 'whatsapp',
            targetUrl: null,
            createdAt: receivedAt,
            status: 'registered',
          },
        ],
        inbox: [
          {
            id: 'i1',
            connectorId: 'c1',
            receivedAt,
            kind: 'whatsapp',
            from: '5215550000000@s.whatsapp.net',
            text: 'hola',
            remoteMessageId: 'm1',
          },
        ],
      }),
    });
    expect(registry.listConnectors()).toHaveLength(0);
    expect(registry.hasRemoteMessage('c1', 'm1')).toBe(false);
    await registry.hydrate();
    expect(registry.listConnectors()).toHaveLength(1);
    expect(registry.hasRemoteMessage('c1', 'm1')).toBe(true);
    expect(registry.listInbox(10)).toHaveLength(1);
  });

  it('degrades to process-local state when hydration fails', async () => {
    const registry = new FederationRegistry({
      load: () => ({ connectors: [], inbox: [] }),
      save: () => undefined,
      hydrate: async () => {
        throw new Error('connection refused');
      },
    });
    const connector = await registry.createConnector({ name: 'degraded', kind: 'webhook' });
    expect(registry.degradationReason).toContain('connection refused');
    expect(registry.getConnector(connector.id)?.name).toBe('degraded');
    await registry.ingest(connector, { key: { id: 'msg-9' }, conversation: 'sigue vivo' });
    expect(registry.listInbox(10)).toHaveLength(1);
  });
});

describe('signed webhook verification', () => {
  it('accepts a fresh signature and rejects tampering, staleness and malformed input', () => {
    const body = JSON.stringify({ hello: 'mundo' });
    const fresh = String(Math.floor(Date.now() / 1000));
    const signature = signPayload(SECRET, fresh, body);

    expect(verifyPayloadSignature(SECRET, fresh, body, signature)).toBe(true);
    expect(verifyPayloadSignature(SECRET, fresh, body, `sha256=${signature}`)).toBe(true);
    expect(verifyPayloadSignature(SECRET, fresh, `${body} `, signature)).toBe(false);
    expect(verifyPayloadSignature(SECRET, fresh, body, '0'.repeat(64))).toBe(false);

    const stale = String(Math.floor(Date.now() / 1000) - 600);
    expect(verifyPayloadSignature(SECRET, stale, body, signPayload(SECRET, stale, body))).toBe(
      false
    );
    expect(verifyPayloadSignature(SECRET, 'not-a-timestamp', body, signature)).toBe(false);
  });

  it('requires a secret of at least 32 characters', () => {
    expect(federationSecret({ ISABELLA_FEDERATION_SECRET: 'short' })).toBeNull();
    expect(federationSecret({ ISABELLA_FEDERATION_SECRET: SECRET })).toBe(SECRET);
  });
});
