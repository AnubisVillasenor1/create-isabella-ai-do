import { verifyChainLink, ZERO_HASH } from "./crypto";
import { buildBookPiEvent } from "./emitter";
import type { BookPiEventRecord, BookPiEventSeed, BookPiStorage } from "./types";

export interface PostgresQueryResult { rows: unknown[]; rowCount?: number | null; }
export interface PostgresLike {
  query(text: string, params?: unknown[]): Promise<PostgresQueryResult>;
  connect?(): Promise<PostgresClientLike>;
}
export interface PostgresClientLike extends PostgresLike {
  release?(): void;
}

/** Run each operation in a single connection/transaction so actor RLS context is local and reliable. */
async function withActorTransaction<T>(
  pool: PostgresLike,
  actorId: string | undefined,
  work: (client: PostgresLike) => Promise<T>,
): Promise<T> {
  if (!pool.connect) {
    if (actorId) await pool.query("SELECT set_config('app.actor_id', $1, false)", [actorId]);
    return work(pool);
  }
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("BEGIN");
    began = true;
    if (actorId) await client.query("SELECT set_config('app.actor_id', $1, true)", [actorId]);
    const result = await work(client);
    await client.query("COMMIT");
    began = false;
    return result;
  } catch (error) {
    if (began) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
    }
    throw error;
  } finally {
    client.release?.();
  }
}

export interface PostgresBookPiRow {
  id: string; type: string; sequence: number | string; prev_hash: string; timestamp: string | Date;
  actor_id: string | null; payload: unknown; schema_version: string; meta: unknown;
  header: unknown; hash: string; integrity: string; canonical: string;
}

export const BOOKPI_TABLE = "bookpi_events";

const rowToRecord = (row: PostgresBookPiRow): BookPiEventRecord => {
  // node-postgres returns int8/BIGINT as a string by default. Normalize before
  // arithmetic or chain order checks; never allow "1" + 1 to become "11".
  const sequence = typeof row.sequence === "string" ? Number(row.sequence) : row.sequence;
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("BOOKPI_POSTGRES_SEQUENCE_INVALID");
  // node-postgres parses TIMESTAMPTZ into Date by default. Canonical BookPI hashing
  // requires the same ISO-8601 string that was originally sealed, not Date's object keys.
  const timestamp = row.timestamp instanceof Date
    ? (Number.isFinite(row.timestamp.getTime()) ? row.timestamp.toISOString() : "")
    : row.timestamp;
  if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error("BOOKPI_POSTGRES_TIMESTAMP_INVALID");
  }
  return {
    id: row.id, type: row.type, sequence, prevHash: row.prev_hash, timestamp,
    actorId: row.actor_id ?? undefined, header: row.header as BookPiEventRecord["header"],
    payload: row.payload as BookPiEventRecord["payload"], schemaVersion: row.schema_version,
    meta: (row.meta ?? {}) as BookPiEventRecord["meta"], hash: row.hash, integrity: row.integrity, canonical: row.canonical,
  };
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}

/**
 * Postgres adapter. Concurrency is handled by retrying sequence allocation after
 * a unique collision; the migration additionally installs a sequence and trigger.
 * Production deployments should use a dedicated append-only DB role.
 */
export interface PostgresStorageOptions {
  actorId?: string;
}

export function createPostgresStorage(pool: PostgresLike, table = BOOKPI_TABLE, options: PostgresStorageOptions = {}): BookPiStorage {
  const quote = (ident: string): string => `"${ident.replaceAll('"', '""')}"`;
  const withActor = <T>(
    work: (client: PostgresLike) => Promise<T>,
    actorId = options.actorId,
  ): Promise<T> => withActorTransaction(pool, actorId, work);

  const eventColumns = "id, type, sequence, prev_hash, timestamp, actor_id, payload, schema_version, meta, header, hash, integrity, canonical";

  async function getLastEvent(): Promise<BookPiEventRecord | null> {
    return withActor(async (client) => {
      const { rows } = await client.query(`SELECT ${eventColumns} FROM ${quote(table)} ORDER BY sequence DESC LIMIT 1`);
      const row = rows[0] as PostgresBookPiRow | undefined;
      return row ? rowToRecord(row) : null;
    });
  }

  async function appendEvent(seed: BookPiEventSeed, ctx: { secret?: string; actorId?: string } = {}): Promise<BookPiEventRecord> {
    const actorId = ctx.actorId ?? options.actorId;
    if (options.actorId && actorId !== options.actorId) {
      throw new Error("BOOKPI_ACTOR_SCOPE_MISMATCH: this storage instance is scoped to one actor");
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await withActor(async (client) => {
          // Serialize chain-head allocation across concurrent requests; the insert and
          // predecessor lookup commit atomically on the same connection.
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bookpi:${table}`]);
          const { rows } = await client.query(`SELECT ${eventColumns} FROM ${quote(table)} ORDER BY sequence DESC LIMIT 1`);
          const lastRow = rows[0] as PostgresBookPiRow | undefined;
          const last = lastRow ? rowToRecord(lastRow) : null;
          const record = buildBookPiEvent(seed, {
            sequence: last ? last.sequence + 1 : 1,
            prevHash: last ? last.hash : ZERO_HASH,
            timestamp: new Date().toISOString(),
            actorId: ctx.actorId ?? options.actorId,
            secret: ctx.secret,
          });
          await client.query(
            `INSERT INTO ${quote(table)}
             (id, type, sequence, prev_hash, timestamp, actor_id, payload, schema_version, meta, header, hash, integrity, canonical)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [record.id, record.type, record.sequence, record.prevHash, record.timestamp, record.actorId ?? null,
             record.payload, record.schemaVersion, record.meta, record.header, record.hash, record.integrity, record.canonical],
          );
          return record;
        }, actorId);
      } catch (error) {
        lastError = error;
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new Error("BOOKPI: concurrent append failed after 4 retries", { cause: lastError });
  }

  async function listEvents(): Promise<BookPiEventRecord[]> {
    return withActor(async (client) => {
      const { rows } = await client.query(`SELECT * FROM ${quote(table)} ORDER BY sequence ASC`);
      return (rows as PostgresBookPiRow[]).map(rowToRecord);
    });
  }

  async function verifyChain(opts: { secret?: string } = {}): Promise<{ valid: boolean; count: number; failures: string[] }> {
    const events = await listEvents();
    const failures: string[] = [];
    let prevHash = ZERO_HASH;
    for (const event of events) {
      if (event.prevHash !== prevHash) failures.push(`evento ${event.sequence} (${event.id}): prevHash no encadena`);
      if (!verifyChainLink(event, opts.secret)) failures.push(`evento ${event.sequence} (${event.id}): hash/integridad inválidos`);
      prevHash = event.hash;
    }
    return { valid: failures.length === 0, count: events.length, failures };
  }

  return { getLastEvent, appendEvent, listEvents, verifyChain };
}
