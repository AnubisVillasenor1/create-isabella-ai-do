/**
 * Almacén de idempotencia y cola de webhooks de conectores.
 *
 * ISA-200 / ISA-210: un evento solo se reconoce (`accepted`) después de ser
 * reclamado de forma durable; `claim()` devuelve "claimed" la primera vez y
 * "duplicate" para reentregas. Sin almacén disponible la ruta responde 503 y
 * no hace ACK (fail-closed), de modo que el proveedor reintenta sin pérdida.
 *
 * ISA-207: el reclamo se persiste con `status = pending`, es decir, el evento
 * verificado queda encolado antes del ACK y el trabajo aguas abajo corre
 * después con `processPendingWebhooks()`, nunca dentro del request.
 */
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { config } from "@/lib/config";

export type WebhookProviderId = "github" | "slack" | "linear";
export type WebhookQueueStatus = "pending" | "processing" | "processed" | "failed";

export interface WebhookClaim {
  provider: WebhookProviderId;
  eventId: string;
  payloadHash: string;
}

export interface WebhookQueuedEvent extends WebhookClaim {
  status: WebhookQueueStatus;
  attempts: number;
  receivedAt: string;
}

export type WebhookClaimOutcome = "claimed" | "duplicate";

export interface WebhookEventStore {
  /** true = persistencia real; false = memoria de proceso (solo dev/test). */
  readonly durable: boolean;
  claim(claim: WebhookClaim): Promise<WebhookClaimOutcome>;
  /** Retira eventos pendientes para procesamiento (ISA-207). */
  takePending(limit: number): Promise<WebhookQueuedEvent[]>;
  markStatus(
    provider: WebhookProviderId,
    eventId: string,
    status: WebhookQueueStatus,
    error?: string,
  ): Promise<void>;
}

export function hashWebhookPayload(rawBody: string): string {
  return createHash("sha3-512").update(rawBody, "utf8").digest("hex");
}

interface MemoryRow extends WebhookClaim {
  status: WebhookQueueStatus;
  attempts: number;
  receivedAt: number;
}

export class InMemoryWebhookEventStore implements WebhookEventStore {
  readonly durable = false;
  private readonly events = new Map<string, MemoryRow>();

  constructor(private readonly maxEntries = 5_000) {}

  private key(provider: WebhookProviderId, eventId: string): string {
    return `${provider}:${eventId}`;
  }

  async claim({ provider, eventId, payloadHash }: WebhookClaim): Promise<WebhookClaimOutcome> {
    const key = this.key(provider, eventId);
    if (this.events.has(key)) return "duplicate";
    if (this.events.size >= this.maxEntries) {
      const oldest = this.events.keys().next().value;
      if (oldest !== undefined) this.events.delete(oldest);
    }
    this.events.set(key, {
      provider,
      eventId,
      payloadHash,
      status: "pending",
      attempts: 0,
      receivedAt: Date.now(),
    });
    return "claimed";
  }

  async takePending(limit: number): Promise<WebhookQueuedEvent[]> {
    const out: WebhookQueuedEvent[] = [];
    for (const row of this.events.values()) {
      if (out.length >= limit) break;
      // Igual que la variante Postgres: reintenta 'failed' además de 'pending'.
      if (row.status !== "pending" && row.status !== "failed") continue;
      row.status = "processing";
      row.attempts += 1;
      out.push({
        provider: row.provider,
        eventId: row.eventId,
        payloadHash: row.payloadHash,
        status: row.status,
        attempts: row.attempts,
        receivedAt: new Date(row.receivedAt).toISOString(),
      });
    }
    return out;
  }

  async markStatus(
    provider: WebhookProviderId,
    eventId: string,
    status: WebhookQueueStatus,
    error?: string,
  ): Promise<void> {
    void error;
    const row = this.events.get(this.key(provider, eventId));
    if (row) row.status = status;
  }
}

let pool: Pool | null = null;
function getPool(url: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
    });
    pool.on("error", (error) => {
      console.error("connector_webhook_events pool error", error.message);
    });
  }
  return pool;
}

export class PostgresWebhookEventStore implements WebhookEventStore {
  readonly durable = true;

  constructor(private readonly url: string) {}

  async claim({ provider, eventId, payloadHash }: WebhookClaim): Promise<WebhookClaimOutcome> {
    const client = await getPool(this.url).connect();
    try {
      const result = await client.query(
        `INSERT INTO public.connector_webhook_events (provider, event_id, payload_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING event_id`,
        [provider, eventId, payloadHash],
      );
      return result.rowCount === 1 ? "claimed" : "duplicate";
    } finally {
      client.release();
    }
  }

  async takePending(limit: number): Promise<WebhookQueuedEvent[]> {
    const client = await getPool(this.url).connect();
    try {
      const result = await client.query(
        `UPDATE public.connector_webhook_events
            SET status = 'processing',
                attempts = attempts + 1,
                updated_at = NOW()
          WHERE event_id IN (
            SELECT event_id
              FROM public.connector_webhook_events
             WHERE status IN ('pending', 'failed')
             ORDER BY received_at
             LIMIT $1
             FOR UPDATE SKIP LOCKED
          )
          RETURNING provider, event_id, payload_hash, status, attempts, received_at`,
        [limit],
      );
      return result.rows.map((row) => ({
        provider: row.provider as WebhookProviderId,
        eventId: String(row.event_id),
        payloadHash: String(row.payload_hash),
        status: row.status as WebhookQueueStatus,
        attempts: Number(row.attempts),
        receivedAt: new Date(String(row.received_at)).toISOString(),
      }));
    } finally {
      client.release();
    }
  }

  async markStatus(
    provider: WebhookProviderId,
    eventId: string,
    status: WebhookQueueStatus,
    error?: string,
  ): Promise<void> {
    const client = await getPool(this.url).connect();
    try {
      await client.query(
        `UPDATE public.connector_webhook_events
            SET status = $3,
                last_error = $4,
                updated_at = NOW()
          WHERE provider = $1 AND event_id = $2`,
        [provider, eventId, status, error ?? null],
      );
    } finally {
      client.release();
    }
  }
}

/**
 * Devuelve el almacén autoritativo: Postgres cuando hay DATABASE_URL; en
 * desarrollo/test, memoria de proceso (no durable, declarado como tal); en
 * staging/production sin base de datos, `null` para que la ruta niegue.
 */
export function createWebhookEventStore(
  env: Record<string, string | undefined> = config() as unknown as Record<
    string,
    string | undefined
  >,
): WebhookEventStore | null {
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim()) return new PostgresWebhookEventStore(databaseUrl.trim());

  const mode = env.ISABELLA_RUNTIME_MODE ?? "development";
  const nodeEnv = env.NODE_ENV ?? "development";
  const isLocal = mode !== "production" && mode !== "staging" && nodeEnv !== "production";
  if (isLocal) return new InMemoryWebhookEventStore();
  return null;
}

/**
 * Procesa los eventos ya verificados y encolados (ISA-207). El handler corre
 * fuera del request; un fallo marca el evento `failed` y queda para reintento
 * sin perder la entrada del ledger.
 */
export async function processPendingWebhooks(
  store: WebhookEventStore,
  handler: (event: WebhookQueuedEvent) => Promise<void>,
  limit = 10,
): Promise<{ processed: number; failed: number }> {
  const events = await store.takePending(limit);
  let processed = 0;
  let failed = 0;
  for (const event of events) {
    try {
      await handler(event);
      await store.markStatus(event.provider, event.eventId, "processed");
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "unknown";
      await store.markStatus(event.provider, event.eventId, "failed", message);
      failed += 1;
    }
  }
  return { processed, failed };
}
