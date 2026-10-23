import pg from 'pg';
import { createPostgresStorage } from '../dist/bookpi/storage-postgres.js';

const { Pool } = pg;
const connectionString = process.env.POSTGRES_URL ?? 'postgres://isabella:isabella@127.0.0.1:5432/isabella';
const actorId = process.env.BOOKPI_ACTOR_ID ?? 'e2e-operator';
const pool = new Pool({ connectionString });

try {
  await pool.query('SELECT 1');
  const storage = createPostgresStorage(pool, 'bookpi_events', { actorId });
  const seed = {
    id: `e2e-${Date.now()}`,
    type: 'E2E.POSTGRES.RLS',
    actorId,
    payload: { source: 'postgres-e2e', verified: true },
    schemaVersion: '1.0.0',
    meta: {},
    header: { source: 'integration-test' },
  };
  const record = await storage.appendEvent(seed);
  const verification = await storage.verifyChain();
  if (!verification.valid || verification.count < 1) throw new Error(`BookPI verification failed: ${JSON.stringify(verification)}`);
  const hidden = await pool.query("SELECT count(*)::int AS count FROM bookpi_events WHERE actor_id <> $1", [actorId]);
  if (hidden.rows[0].count !== 0) throw new Error('RLS actor isolation failed');
  console.log(JSON.stringify({ ok: true, record: { id: record.id, sequence: record.sequence }, verification }, null, 2));
} finally {
  await pool.end();
}
