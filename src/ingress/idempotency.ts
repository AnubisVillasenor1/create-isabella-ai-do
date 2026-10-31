/**
 * Idempotency-Key para mutaciones HTTP/protocolo: misma clave + mismo cuerpo ⇒ se
 * reproduce la respuesta; misma clave + cuerpo distinto ⇒ CONFLICT (422/409); misma
 * clave en vuelo ⇒ se comparte la promesa (sin doble ejecución concurrente).
 *
 * state: draft | engine-generated. Almacén en memoria con TTL y tope: NO es
 * compartido entre instancias (en despliegues multi-réplica requiere un store
 * externo con la misma interfaz). Distinto de `commerce/webhook` (dedupe por
 * proveedor): este está ligado a la huella de la solicitud.
 */
import { createHash } from 'node:crypto';

const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;

export type IdempotencyOutcome<T> =
  | { readonly kind: 'EXECUTED'; readonly value: T }
  | { readonly kind: 'REPLAYED'; readonly value: T }
  | { readonly kind: 'CONFLICT' }
  | { readonly kind: 'INVALID_KEY' };

interface Entry<T> {
  fingerprint: string;
  expiresAt: number;
  settled: boolean;
  value?: T;
  inflight?: Promise<T>;
}

export function requestFingerprint(method: string, path: string, body: unknown): string {
  const canon = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(',')}}`;
  };
  return createHash('sha256')
    .update(`${method.toUpperCase()}\n${path}\n${canon(body)}`)
    .digest('hex');
}

export class IdempotencyStore<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number = 24 * 60 * 60 * 1000,
    private readonly maxEntries: number = 10_000
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0)
      throw new RangeError('IDEMPOTENCY: ttlMs must be positive');
    if (!Number.isInteger(maxEntries) || maxEntries < 1)
      throw new RangeError('IDEMPOTENCY: maxEntries must be >= 1');
  }

  private sweep(now: number): void {
    for (const [k, e] of this.entries) {
      if (e.settled && e.expiresAt <= now) this.entries.delete(k);
    }
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) break;
      const e = this.entries.get(oldest.value);
      if (e !== undefined && !e.settled) break; // nunca expulsar ejecuciones en vuelo
      this.entries.delete(oldest.value);
    }
  }

  async run(
    key: string,
    fingerprint: string,
    fn: () => Promise<T>,
    now: number = Date.now()
  ): Promise<IdempotencyOutcome<T>> {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) return { kind: 'INVALID_KEY' };
    this.sweep(now);
    const existing = this.entries.get(key);
    if (existing !== undefined && (!existing.settled || existing.expiresAt > now)) {
      if (existing.fingerprint !== fingerprint) return { kind: 'CONFLICT' };
      if (existing.settled) return { kind: 'REPLAYED', value: existing.value as T };
      return { kind: 'REPLAYED', value: await (existing.inflight as Promise<T>) };
    }
    const entry: Entry<T> = { fingerprint, expiresAt: now + this.ttlMs, settled: false };
    const promise = fn();
    entry.inflight = promise;
    this.entries.set(key, entry);
    try {
      const value = await promise;
      entry.value = value;
      entry.settled = true;
      entry.inflight = undefined;
      return { kind: 'EXECUTED', value };
    } catch (error) {
      // un fallo NO se cachea: el cliente puede reintentar con la misma clave
      this.entries.delete(key);
      throw error;
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
