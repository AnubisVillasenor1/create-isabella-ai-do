import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  resolvePostgresUrl,
  type PostgresQueryClient,
  type PostgresQueryResult,
} from '../../src/database/postgres-client';
import {
  PostgresApiKeyPersistence,
  createPostgresApiKeyPersistence,
} from '../../src/security/postgres-api-key-persistence';
import {
  IsabellaApiKeyStore,
  MAX_KEYS,
  type StoredKey,
} from '../../src/security/isabella-api-keys';

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

function keyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'k1',
    prefix: 'isa_live_AAAAAAAAAAAAAAAA',
    tenant_id: 'tenant-a',
    name: 'desde la base',
    scopes: ['cognition:read'],
    digest: new Uint8Array(32).fill(7),
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function recordFixture(id: string, lastUsedAt: string | null): StoredKey {
  return {
    id,
    prefix: 'isa_live_AAAAAAAAAAAAAAAA',
    tenantId: 'tenant-a',
    name: 'fixture',
    scopes: ['cognition:read'],
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
    lastUsedAt,
    digest: Buffer.alloc(32, 7),
  };
}

function sha256Digest(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

describe('resolvePostgresUrl', () => {
  it('uses the documented variable precedence and rejects other schemes', () => {
    expect(resolvePostgresUrl({ DATABASE_URL: ' postgresql://a/b ' })).toBe('postgresql://a/b');
    expect(resolvePostgresUrl({ POSTGRES_URL: 'postgres://a/b' })).toBe('postgres://a/b');
    expect(resolvePostgresUrl({ POSTGRES_PRISMA_URL: 'postgresql://c/d' })).toBe('postgresql://c/d');
    expect(resolvePostgresUrl({ POSTGRES_URL_NON_POOLING: 'postgres://e/f' })).toBe('postgres://e/f');
    expect(resolvePostgresUrl({ DATABASE_URL: 'mysql://a/b' })).toBeNull();
    expect(
      resolvePostgresUrl({ DATABASE_URL: 'postgresql://a/b', POSTGRES_URL: 'postgres://z' })
    ).toBe('postgresql://a/b');
    expect(resolvePostgresUrl({})).toBeNull();
  });

  it('declines to build a backend without a usable URL', () => {
    expect(createPostgresApiKeyPersistence({ ISABELLA_API_KEY_STORE: 'postgres' })).toBeNull();
  });
});

describe('PostgresApiKeyPersistence', () => {
  it('serves an empty synchronous snapshot because reads go through hydrate', () => {
    const persistence = new PostgresApiKeyPersistence({ client: fakeClient().client });
    expect(persistence.load()).toEqual([]);
  });

  it('hydrates valid rows and drops rows the store would never have produced', async () => {
    const fake = fakeClient(() => ({
      rows: [
        keyRow(),
        keyRow({ id: 'k2', digest: new Uint8Array(16) }),
        keyRow({ id: 'k3', scopes: ['admin:*'] }),
        keyRow({ id: 'k4', created_at: 'not-a-timestamp' }),
        keyRow({ id: 'k5', expires_at: 'no-es-una-fecha' }),
      ],
    }));
    const persistence = new PostgresApiKeyPersistence({ client: fake.client });
    const records = await persistence.hydrate();
    expect(records.map((record) => record.id)).toEqual(['k1']);
    expect(records[0].lastUsedAt).toBeNull();
    expect(Buffer.isBuffer(records[0].digest)).toBe(true);
    expect(records[0].scopes).toEqual(['cognition:read']);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].sql).toContain('FROM public.isabella_api_keys');
    expect(fake.calls[0].params).toEqual([MAX_KEYS]);
  });

  it('writes one parameterized row and never the secret', async () => {
    const fake = fakeClient();
    const persistence = new PostgresApiKeyPersistence({ client: fake.client });
    const store = new IsabellaApiKeyStore({ persistence });
    const issued = await store.issue({
      tenantId: 'tenant-a',
      name: 'fila',
      scopes: ['cognition:read'],
    });
    const inserts = fake.calls.filter((call) =>
      call.sql.startsWith('INSERT INTO public.isabella_api_keys')
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0].sql).toContain('ON CONFLICT (id) DO UPDATE');
    expect(inserts[0].sql).not.toMatch(/created_at = EXCLUDED/);
    expect(inserts[0].sql).not.toContain(issued.secret);
    expect(JSON.stringify(inserts[0].params)).not.toContain(issued.secret);
    expect(Buffer.isBuffer(inserts[0].params[5])).toBe(true);
    expect(inserts[0].params[0]).toBe(issued.record.id);
    expect(inserts[0].params[4]).toEqual(['cognition:read']);
  });

  it('authenticates the original secret from the stored digest alone', async () => {
    const writer = fakeClient();
    const writing = new IsabellaApiKeyStore({
      persistence: new PostgresApiKeyPersistence({ client: writer.client }),
    });
    const issued = await writing.issue({
      tenantId: 'tenant-a',
      name: 'digest',
      scopes: ['cognition:read'],
    });
    const params = writer.calls.filter((call) => call.sql.startsWith('INSERT'))[0].params;
    const reader = fakeClient(() => ({
      rows: [
        {
          id: params[0],
          prefix: params[1],
          tenant_id: params[2],
          name: params[3],
          scopes: params[4],
          digest: params[5],
          created_at: new Date(String(params[6])),
          expires_at: params[7] === null ? null : new Date(String(params[7])),
          revoked_at: params[8] === null ? null : new Date(String(params[8])),
          last_used_at: params[9] === null ? null : new Date(String(params[9])),
        },
      ],
    }));
    const reading = new IsabellaApiKeyStore({
      persistence: new PostgresApiKeyPersistence({ client: reader.client }),
    });
    await reading.hydrate();
    expect(reading.verify(issued.secret, 'cognition:read', 'tenant-a').ok).toBe(true);
    expect(reading.verify(issued.secret, 'admin:keys')).toEqual({ ok: false, reason: 'scope' });
    expect(JSON.stringify(reader.calls)).not.toContain(issued.secret);
  });

  it('stores only the digest, so the row alone cannot be turned back into a secret', async () => {
    const secret = `isa_live_${'C'.repeat(43)}`;
    const fake = fakeClient(() => ({ rows: [keyRow({ digest: sha256Digest(secret) })] }));
    const store = new IsabellaApiKeyStore({
      persistence: new PostgresApiKeyPersistence({ client: fake.client }),
    });
    await store.hydrate();
    expect(store.verify(secret).ok).toBe(true);
    expect(store.verify(`isa_live_${'D'.repeat(43)}`).ok).toBe(false);
    expect(JSON.stringify(fake.calls)).not.toContain(secret);
  });

  it('buffers lastUsedAt and flushes it in one batched UPDATE', async () => {
    const fake = fakeClient();
    const persistence = new PostgresApiKeyPersistence({
      client: fake.client,
      lastUsedFlushRows: 2,
    });
    const store = new IsabellaApiKeyStore({ persistence });
    const a = await store.issue({ tenantId: 'tenant-a', name: 'uno', scopes: ['cognition:read'] });
    const b = await store.issue({ tenantId: 'tenant-a', name: 'dos', scopes: ['cognition:read'] });
    const before = fake.calls.length;
    expect(store.verify(a.secret).ok).toBe(true);
    expect(store.verify(b.secret).ok).toBe(true);
    const flushes = fake.calls
      .slice(before)
      .filter((call) => call.sql.startsWith('UPDATE public.isabella_api_keys'));
    expect(flushes).toHaveLength(1);
    expect(flushes[0].sql).toContain('UNNEST');
    expect(flushes[0].params[0]).toHaveLength(2);
    expect(flushes[0].sql).not.toContain(a.secret);
  });

  it('never writes during verification when the flush budget is zero', async () => {
    const fake = fakeClient();
    const persistence = new PostgresApiKeyPersistence({ client: fake.client, lastUsedFlushRows: 0 });
    const store = new IsabellaApiKeyStore({ persistence });
    const issued = await store.issue({ tenantId: 'tenant-a', name: 'cero', scopes: ['cognition:read'] });
    for (let index = 0; index < 100; index += 1) expect(store.verify(issued.secret).ok).toBe(true);
    expect(fake.calls.filter((call) => call.sql.startsWith('UPDATE'))).toHaveLength(0);
  });

  it('flushes buffered telemetry before it reads rows again', async () => {
    const fake = fakeClient();
    const persistence = new PostgresApiKeyPersistence({
      client: fake.client,
      lastUsedFlushRows: 10,
    });
    persistence.markUsed(recordFixture('k1', new Date().toISOString()));
    await persistence.hydrate();
    expect(fake.calls[0].sql.startsWith('UPDATE')).toBe(true);
    expect(fake.calls[1].sql.startsWith('SELECT')).toBe(true);
  });

  it('drops buffered telemetry when the same row is rewritten', async () => {
    const fake = fakeClient();
    const persistence = new PostgresApiKeyPersistence({
      client: fake.client,
      lastUsedFlushRows: 10,
    });
    const record = recordFixture('k1', new Date().toISOString());
    persistence.markUsed(record);
    await persistence.saveRecord(record);
    await persistence.flushLastUsed();
    expect(fake.calls.filter((call) => call.sql.startsWith('UPDATE'))).toHaveLength(0);
    expect(fake.calls.filter((call) => call.sql.startsWith('INSERT'))).toHaveLength(1);
  });

  it('keeps flush failures visible without breaking authentication', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failingFlush = fakeClient((sql) => {
      if (sql.startsWith('UPDATE')) throw new Error('deadlock detected');
      return { rows: [] };
    });
    const persistence = new PostgresApiKeyPersistence({
      client: failingFlush.client,
      lastUsedFlushRows: 1,
    });
    const store = new IsabellaApiKeyStore({ persistence });
    const issued = await store.issue({
      tenantId: 'tenant-a',
      name: 'flush',
      scopes: ['cognition:read'],
    });
    expect(store.verify(issued.secret).ok).toBe(true);
    await persistence.flushLastUsed();
    expect(store.verify(issued.secret).ok).toBe(true);
    warn.mockRestore();
  });

  it('propagates a hydration failure so the store degrades and closes the client', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let closed = false;
    const failing: PostgresQueryClient = {
      async query(): Promise<PostgresQueryResult> {
        throw new Error('connection terminated');
      },
      async close(): Promise<void> {
        closed = true;
      },
    };
    const store = new IsabellaApiKeyStore({
      persistence: new PostgresApiKeyPersistence({ client: failing }),
    });
    await store.hydrate();
    expect(store.degradationReason).toContain('connection terminated');
    const issued = await store.issue({ tenantId: 'tenant-a', name: 'local', scopes: ['cognition:read'] });
    expect(store.verify(issued.secret).ok).toBe(true);
    expect(closed).toBe(true);
    warn.mockRestore();
  });
});
