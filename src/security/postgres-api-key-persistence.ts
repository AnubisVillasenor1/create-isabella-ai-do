/**
 * Postgres backend for the API-key registry.
 *
 * The verification hot path stays synchronous and in-process: rows are read once
 * through hydrate() and every mutation writes only the affected row. Only the
 * peppered digest reaches the database, never the secret itself.
 */
import {
  MAX_KEYS,
  validScope,
  type ApiKeyPersistence,
  type ApiKeyScope,
  type StoredKey,
} from './isabella-api-keys';
import {
  createPostgresQueryClient,
  isoTimestamp,
  resolvePostgresUrl,
  type PostgresQueryClient,
} from '../database/postgres-client';

const TABLE = 'public.isabella_api_keys';
const DIGEST_BYTES = 32;
const DEFAULT_LAST_USED_FLUSH_ROWS = 32;

const SELECT_COLUMNS = `id, prefix, tenant_id, name, scopes, digest, created_at, expires_at,
  revoked_at, last_used_at`;

const SELECT_KEYS_SQL = `SELECT ${SELECT_COLUMNS} FROM ${TABLE} ORDER BY created_at DESC LIMIT $1`;

const UPSERT_SQL = `INSERT INTO ${TABLE}
  (id, prefix, tenant_id, name, scopes, digest, created_at, expires_at, revoked_at, last_used_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  ON CONFLICT (id) DO UPDATE SET
    prefix = EXCLUDED.prefix,
    tenant_id = EXCLUDED.tenant_id,
    name = EXCLUDED.name,
    scopes = EXCLUDED.scopes,
    digest = EXCLUDED.digest,
    expires_at = EXCLUDED.expires_at,
    revoked_at = EXCLUDED.revoked_at,
    last_used_at = EXCLUDED.last_used_at`;

const FLUSH_LAST_USED_SQL = `UPDATE ${TABLE} AS key
  SET last_used_at = seen.last_used_at
  FROM (SELECT UNNEST($1::text[]) AS id, UNNEST($2::timestamptz[]) AS last_used_at) AS seen
  WHERE key.id = seen.id`;

function nullableIso(value: unknown): { ok: boolean; value: string | null } {
  if (value === null || value === undefined) return { ok: true, value: null };
  const parsed = isoTimestamp(value);
  return parsed === null ? { ok: false, value: null } : { ok: true, value: parsed };
}

/**
 * Maps a row to the in-memory record, refusing anything the store would not
 * have produced itself. A row with a malformed digest is dropped rather than
 * trusted, so a corrupted table can never widen the accepted key space.
 */
function toStoredKey(row: Record<string, unknown>): StoredKey | null {
  if (typeof row.id !== 'string' || !row.id) return null;
  if (typeof row.prefix !== 'string' || !row.prefix) return null;
  if (typeof row.tenant_id !== 'string' || !row.tenant_id) return null;
  if (typeof row.name !== 'string' || !row.name) return null;
  if (!Array.isArray(row.scopes)) return null;
  if (!row.scopes.every((scope) => typeof scope === 'string' && validScope(scope))) return null;
  const createdAt = isoTimestamp(row.created_at);
  if (createdAt === null) return null;
  const expiresAt = nullableIso(row.expires_at);
  const revokedAt = nullableIso(row.revoked_at);
  const lastUsedAt = nullableIso(row.last_used_at);
  if (!expiresAt.ok || !revokedAt.ok || !lastUsedAt.ok) return null;
  if (!(row.digest instanceof Uint8Array) || row.digest.length !== DIGEST_BYTES) return null;
  return {
    id: row.id,
    prefix: row.prefix,
    tenantId: row.tenant_id,
    name: row.name,
    scopes: row.scopes as ApiKeyScope[],
    createdAt,
    expiresAt: expiresAt.value,
    revokedAt: revokedAt.value,
    lastUsedAt: lastUsedAt.value,
    digest: Buffer.isBuffer(row.digest) ? row.digest : Buffer.from(row.digest),
  };
}

export interface PostgresApiKeyPersistenceOptions {
  readonly client: PostgresQueryClient;
  /** Rows buffered before a batched lastUsedAt write. Zero disables the write. */
  readonly lastUsedFlushRows?: number;
}

export class PostgresApiKeyPersistence implements ApiKeyPersistence {
  private readonly client: PostgresQueryClient;
  private readonly flushRows: number;
  private readonly pendingLastUsed = new Map<string, string>();

  constructor(options: PostgresApiKeyPersistenceOptions) {
    this.client = options.client;
    const configured = options.lastUsedFlushRows;
    this.flushRows =
      typeof configured === 'number' && Number.isFinite(configured)
        ? Math.max(0, Math.floor(configured))
        : DEFAULT_LAST_USED_FLUSH_ROWS;
  }

  /** Row-level backend: the synchronous snapshot is empty, hydrate() is the read path. */
  load(): StoredKey[] {
    return [];
  }

  async hydrate(): Promise<StoredKey[]> {
    await this.flushLastUsed();
    const result = await this.client.query(SELECT_KEYS_SQL, [MAX_KEYS]);
    return result.rows.map(toStoredKey).filter((row): row is StoredKey => row !== null);
  }

  /** Kept for contract compatibility; the registry writes one row with saveRecord(). */
  async save(records: readonly StoredKey[]): Promise<void> {
    for (const record of records) {
      await this.saveRecord(record);
    }
  }

  async saveRecord(record: StoredKey): Promise<void> {
    this.pendingLastUsed.delete(record.id);
    await this.client.query(UPSERT_SQL, [
      record.id,
      record.prefix,
      record.tenantId,
      record.name,
      [...record.scopes],
      record.digest,
      record.createdAt,
      record.expiresAt,
      record.revokedAt,
      record.lastUsedAt,
    ]);
  }

  /**
   * lastUsedAt is telemetry: it never gates authentication. It is buffered in
   * memory so verify() stays synchronous, then flushed in batch.
   */
  markUsed(record: StoredKey): void {
    if (this.flushRows === 0 || record.lastUsedAt === null) return;
    this.pendingLastUsed.set(record.id, record.lastUsedAt);
    if (this.pendingLastUsed.size >= this.flushRows) void this.flushLastUsed();
  }

  async flushLastUsed(): Promise<void> {
    if (this.pendingLastUsed.size === 0) return;
    const entries = [...this.pendingLastUsed.entries()];
    this.pendingLastUsed.clear();
    try {
      await this.client.query(FLUSH_LAST_USED_SQL, [
        entries.map((entry) => entry[0]),
        entries.map((entry) => entry[1]),
      ]);
    } catch (error) {
      console.warn('[Isabella] API key lastUsedAt flush failed', {
        message: error instanceof Error ? error.message.slice(0, 180) : 'ERROR',
      });
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

/** Returns null when no usable Postgres URL exists; the caller degrades explicitly. */
export function createPostgresApiKeyPersistence(
  env: Readonly<Record<string, string | undefined>>
): PostgresApiKeyPersistence | null {
  const url = resolvePostgresUrl(env);
  if (!url) return null;
  const raw = (env.ISABELLA_API_KEY_LAST_USED_FLUSH_ROWS ?? '').trim();
  const parsed = raw === '' ? Number.NaN : Number.parseInt(raw, 10);
  return new PostgresApiKeyPersistence({
    client: createPostgresQueryClient(url, 'isabella-terminus-api-keys'),
    lastUsedFlushRows: Number.isNaN(parsed) ? undefined : parsed,
  });
}
