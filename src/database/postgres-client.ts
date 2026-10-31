/**
 * Minimal Postgres client shared by the durable runtime stores.
 *
 * Follows the BookPI runtime adapter: pooled `pg` Pool, a small ceiling and a
 * short connection timeout so a cold start never blocks on an unreachable DB.
 * Callers may inject their own client (tests use an in-memory fake).
 */
import { Pool } from 'pg';

export interface PostgresQueryResult {
  readonly rows: Record<string, unknown>[];
}

export interface PostgresQueryClient {
  query(sql: string, params?: readonly unknown[]): Promise<PostgresQueryResult>;
  close(): Promise<void>;
}

type PostgresUrlEnv = Readonly<Record<string, string | undefined>>;

/** Same variable precedence as deploy-readiness and the BookPI runtime adapter. */
export function resolvePostgresUrl(env: PostgresUrlEnv): string | null {
  const url =
    env.DATABASE_URL?.trim() ||
    env.POSTGRES_URL?.trim() ||
    env.POSTGRES_PRISMA_URL?.trim() ||
    env.POSTGRES_URL_NON_POOLING?.trim();
  if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) return null;
  return url;
}

export function createPostgresQueryClient(
  connectionString: string,
  applicationName: string
): PostgresQueryClient {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 10_000,
    application_name: applicationName,
  });
  pool.on('error', (error) => {
    console.error(`[Isabella] Postgres pool ${applicationName} error`, {
      message: error instanceof Error ? error.message.slice(0, 180) : 'ERROR',
    });
  });
  return {
    async query(sql: string, params?: readonly unknown[]): Promise<PostgresQueryResult> {
      const result = await pool.query(sql, params ? [...params] : []);
      return { rows: result.rows as Record<string, unknown>[] };
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

/** TIMESTAMPTZ arrives as a Date from pg; the stores expose ISO strings. */
export function isoTimestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  return null;
}
