import { describe, expect, it, vi } from 'vitest';
import type { PostgresQueryClient, PostgresQueryResult } from '../../src/database/postgres-client';
import {
  PostgresFederationPersistence,
  createPostgresFederationPersistence,
} from '../../src/federation/postgres-federation-persistence';
import { FederationRegistry, type ConnectorRecord } from '../../src/federation/connectors';

interface Recorded {
  sql: string;
  params: unknown[];
}

interface FakeClient {
  client: PostgresQueryClient;
  calls: Recorded[];
  closed: boolean;
}

/** In-memory stand-in for pg: no socket, no live database, no network. */
function fakeClient(
  handler?: (sql: string, params: unknown[]) => PostgresQueryResult
): FakeClient {
  const fake: FakeClient = {
    client: null as unknown as PostgresQueryClient,
    calls: [],
    closed: false,
  };
  fake.client = {
    async query(sql: string, params?: readonly unknown[]): Promise<PostgresQueryResult> {
      const resolved = params ? [...params] : [];
      fake.calls.push({ sql, params: resolved });
      return handler?.(sql, resolved) ?? { rows: [] };
    },
    async close(): Promise<void> {
      fake.closed = true;
    },
  };
  return fake;
}

function connectorRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'c1',
    name: 'principal',
    kind: 'whatsapp',
    target_url: 'https://example.com/hooks',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    status: 'registered',
    ...overrides,
  };
}

function inboxRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'i1',
    connector_id: 'c1',
    received_at: new Date('2026-01-02T00:00:00.000Z'),
    kind: 'whatsapp',
    from_address: '5215550000000@s.whatsapp.net',
    text: 'Hola Isabella',
    remote_message_id: 'msg-1',
    ...overrides,
  };
}

function hydrateClient(
  overrides: { connectors?: Record<string, unknown>[]; inbox?: Record<string, unknown>[] } = {}
) {
  return fakeClient((sql) =>
    sql.includes('federation_connectors')
      ? { rows: overrides.connectors ?? [connectorRow()] }
      : { rows: overrides.inbox ?? [inboxRow()] }
  );
}

describe('createPostgresFederationPersistence', () => {
  it('declines to build a backend without a usable URL', () => {
    expect(createPostgresFederationPersistence({ ISABELLA_FEDERATION_STORE: 'postgres' })).toBeNull();
  });
});

describe('PostgresFederationPersistence', () => {
  it('serves an empty synchronous snapshot because reads go through hydrate', () => {
    const persistence = new PostgresFederationPersistence({ client: fakeClient().client });
    expect(persistence.load()).toEqual({ connectors: [], inbox: [] });
  });

  it('hydrates rows and drops records the registry would never have produced', async () => {
    const fake = hydrateClient({
      connectors: [connectorRow(), connectorRow({ id: 'c2', status: 'revoked' })],
      inbox: [
        inboxRow(),
        inboxRow({ id: 'i2', kind: 'sms' }),
        inboxRow({ id: 'i3', received_at: 'no-es-una-fecha' }),
      ],
    });
    const persistence = new PostgresFederationPersistence({ client: fake.client });
    const file = await persistence.hydrate();
    expect(file.connectors.map((item) => item.id)).toEqual(['c1']);
    expect(file.inbox.map((item) => item.id)).toEqual(['i1']);
    expect(file.connectors[0].targetUrl).toBe('https://example.com/hooks');
    expect(fake.calls.map((call) => call.sql)).toEqual([
      expect.stringContaining('FROM public.federation_connectors'),
      expect.stringContaining('FROM public.federation_inbox'),
    ]);
    expect(fake.calls[1].params).toEqual([200]);
  });

  it('writes one row per registry mutation', async () => {
    const fake = fakeClient();
    const registry = new FederationRegistry(
      new PostgresFederationPersistence({ client: fake.client })
    );
    const connector = await registry.createConnector({
      name: 'principal',
      kind: 'whatsapp',
      targetUrl: 'https://example.com/hooks',
    });
    await registry.ingest(connector, { key: { id: 'msg-1' }, conversation: 'Hola Isabella' });
    expect(await registry.removeConnector(connector.id)).toBe(true);

    const inserts = fake.calls.filter((call) =>
      call.sql.startsWith('INSERT INTO public.federation_connectors')
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(inserts[0].params[0]).toBe(connector.id);
    expect(inserts[0].params[1]).toBe('principal');
    expect(inserts[0].params[3]).toBe('https://example.com/hooks');

    const inboxInserts = fake.calls.filter((call) =>
      call.sql.startsWith('INSERT INTO public.federation_inbox')
    );
    expect(inboxInserts).toHaveLength(1);
    expect(inboxInserts[0].params[6]).toBe('msg-1');

    const deletes = fake.calls.filter((call) =>
      call.sql.startsWith('DELETE FROM public.federation_connectors')
    );
    expect(deletes).toHaveLength(1);
    expect(deletes[0].params).toEqual([connector.id]);
  });

  it('bounds the stored inbox text and trims the table after each insert', async () => {
    const fake = fakeClient();
    const persistence = new PostgresFederationPersistence({ client: fake.client });
    const registry = new FederationRegistry(persistence);
    const connector = await registry.createConnector({ name: 'webhook', kind: 'webhook' });
    await registry.ingest(connector, { key: { id: 'msg-2' }, conversation: 'x'.repeat(5_000) });
    const insert = fake.calls.find((call) => call.sql.startsWith('INSERT INTO public.federation_inbox'));
    expect(String(insert?.params[5])).toHaveLength(4_000);
    const trim = fake.calls.find((call) => call.sql.startsWith('DELETE FROM public.federation_inbox'));
    expect(trim?.params).toEqual([200]);
  });

  it('maps a duplicate key from the database to a replay rejection', async () => {
    let inboxInserts = 0;
    const fake = fakeClient((sql) => {
      if (sql.startsWith('INSERT INTO public.federation_inbox')) {
        inboxInserts += 1;
        if (inboxInserts > 1) {
          throw Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505',
          });
        }
      }
      return { rows: [] };
    });
    const registry = new FederationRegistry(
      new PostgresFederationPersistence({ client: fake.client })
    );
    const connector = await registry.createConnector({ name: 'principal', kind: 'whatsapp' });
    await registry.ingest(connector, { key: { id: 'msg-1' }, conversation: 'primero' });
    await expect(
      registry.ingest(connector, { key: { id: 'msg-1' }, conversation: 'replay' })
    ).rejects.toThrow('FEDERATION_REPLAY_DETECTED');
    expect(inboxInserts).toBe(2);
    expect(registry.listInbox(10)).toHaveLength(1);
    expect(registry.hasRemoteMessage(connector.id, 'msg-1')).toBe(true);
  });

  it('keeps driver failures distinguishable from replay and out of the inbox', async () => {
    const fake = fakeClient((sql) => {
      if (sql.startsWith('INSERT INTO public.federation_inbox')) {
        throw new Error('connection to db:5432 failed');
      }
      return { rows: [] };
    });
    const registry = new FederationRegistry(
      new PostgresFederationPersistence({ client: fake.client })
    );
    const connector = await registry.createConnector({ name: 'principal', kind: 'whatsapp' });
    await expect(
      registry.ingest(connector, { key: { id: 'msg-9' }, conversation: 'dos' })
    ).rejects.toThrow('connection to db:5432 failed');
    expect(registry.listInbox(10)).toHaveLength(0);
  });

  it('degrades the registry to process-local state when hydration fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let closed = false;
    const registry = new FederationRegistry({
      load: () => ({ connectors: [], inbox: [] }),
      save: () => undefined,
      hydrate: async () => {
        throw new Error('database is unreachable');
      },
      close: async () => {
        closed = true;
      },
    });
    await registry.hydrate();
    expect(registry.degradationReason).toContain('database is unreachable');
    expect(closed).toBe(true);
    const connector: ConnectorRecord = await registry.createConnector({
      name: 'local',
      kind: 'webhook',
    });
    expect(registry.getConnector(connector.id)?.name).toBe('local');
    warn.mockRestore();
  });

  it('never throws from the snapshot compatibility path when the backend rejects writes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing: PostgresQueryClient = {
      async query(): Promise<PostgresQueryResult> {
        throw new Error('write rejected');
      },
      async close(): Promise<void> {},
    };
    const persistence = new PostgresFederationPersistence({ client: failing });
    expect(() =>
      persistence.save({
        connectors: [
          {
            id: 'c1',
            name: 'snapshot',
            kind: 'webhook',
            targetUrl: null,
            createdAt: new Date().toISOString(),
            status: 'registered',
          },
        ],
        inbox: [],
      })
    ).not.toThrow();
    await new Promise((resolveSnapshot) => setTimeout(resolveSnapshot, 0));
    expect(warn.mock.calls.length).toBeGreaterThan(0);
    warn.mockRestore();
  });

  it('closes the injected client', async () => {
    const fake = fakeClient();
    const persistence = new PostgresFederationPersistence({ client: fake.client });
    await persistence.close();
    expect(fake.closed).toBe(true);
  });
});
