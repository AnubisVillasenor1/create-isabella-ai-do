/**
 * Inbox de webhooks: deduplicación de eventos entrantes por id (state: draft | engine-generated).
 *
 * Los proveedores (Stripe, GitHub…) reintentan entregas: sin dedupe, un evento puede procesarse dos veces.
 * Estados: NEW → (complete) DONE | (fail) liberado para que el reintento del proveedor lo reprocese.
 * Límite honesto: memoria de proceso; con varias instancias necesita un almacén compartido.
 */
export type InboxBegin = "NEW" | "IN_FLIGHT" | "DUPLICATE";

interface Entry {
  state: "IN_FLIGHT" | "DONE";
  expiresAt: number;
}

export class WebhookInbox {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly ttlMs = 72 * 3_600_000, private readonly maxEntries = 50_000, private readonly inFlightTtlMs = 5 * 60_000) {
    if (!(ttlMs > 0) || !(inFlightTtlMs > 0)) throw new RangeError("INBOX: ttl must be positive");
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError("INBOX: maxEntries must be >= 1");
  }

  get size(): number {
    return this.entries.size;
  }

  begin(eventId: string, now = Date.now()): InboxBegin {
    if (typeof eventId !== "string" || eventId.length === 0 || eventId.length > 256) throw new RangeError("INBOX: invalid event id");
    const existing = this.entries.get(eventId);
    if (existing !== undefined && existing.expiresAt > now) return existing.state === "DONE" ? "DUPLICATE" : "IN_FLIGHT";
    this.entries.set(eventId, { state: "IN_FLIGHT", expiresAt: now + this.inFlightTtlMs });
    if (this.entries.size > this.maxEntries) this.evict(now);
    return "NEW";
  }

  complete(eventId: string, now = Date.now()): void {
    this.entries.set(eventId, { state: "DONE", expiresAt: now + this.ttlMs });
  }

  /** El procesamiento falló: se libera para que el reintento del proveedor vuelva a intentarlo. */
  fail(eventId: string): void {
    const e = this.entries.get(eventId);
    if (e !== undefined && e.state === "IN_FLIGHT") this.entries.delete(eventId);
  }

  private evict(now: number): void {
    for (const [k, v] of this.entries) {
      if (v.expiresAt <= now) this.entries.delete(k);
      if (this.entries.size <= this.maxEntries) return;
    }
    for (const k of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) return;
      this.entries.delete(k);
    }
  }
}

/**
 * Guarda de orden por clave (p. ej. workspace): descarta eventos más antiguos que el último aplicado,
 * para que un "updated" tardío no resucite lo que un "deleted" ya cerró. Acotada en memoria.
 */
export class EventOrderGuard {
  private readonly last = new Map<string, number>();

  constructor(private readonly maxKeys = 50_000) {
    if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new RangeError("ORDER_GUARD: maxKeys must be >= 1");
  }

  /** true si el evento es el más reciente conocido para la clave (y lo registra); false si es obsoleto. */
  accept(key: string, createdAt: number): boolean {
    const prior = this.last.get(key);
    if (prior !== undefined && createdAt < prior) return false;
    this.last.delete(key);
    this.last.set(key, createdAt);
    if (this.last.size > this.maxKeys) {
      const oldest = this.last.keys().next().value as string | undefined;
      if (oldest !== undefined) this.last.delete(oldest);
    }
    return true;
  }
}
