/**
 * MAGPIE-X — bus de eventos gobernado en proceso.
 *
 * state: draft | engine-generated.
 *
 * MAGPIE-X transporta eventos entre módulos de Isabella con orden determinista
 * dentro de un proceso. Invariante: **el bus transporta intención, no autoriza
 * ejecución.** Entregar un evento no concede autoridad; CROWN sigue autorizando,
 * AEGIS sigue filtrando y BookPI sigue evidenciando. Un handler que falla queda
 * aislado y se registra: un suscriptor defectuoso no rompe al publicador.
 *
 * Alcance honesto: es un bus **en proceso**. No ofrece durabilidad, reparto
 * distribuido, ni garantías de entrega exactamente-una-vez entre procesos.
 */
import { sha256 } from "../skills/canonical-json";

export const MAGPIE_SCHEMA_VERSION = "MAGPIE-X-v1";
export const MAGPIE_WILDCARD = "*";

export interface MagpieEvent<T = unknown> {
  readonly id: string;
  readonly topic: string;
  readonly type: string;
  readonly payload: T;
  readonly occurredAt: string;
  readonly schemaVersion: string;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export type MagpieHandler<T = unknown> = (event: MagpieEvent<T>) => void;

export interface MagpiePublishInput<T = unknown> {
  readonly topic: string;
  readonly type: string;
  readonly payload: T;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export interface MagpieDeliveryReport {
  readonly eventId: string;
  readonly topic: string;
  readonly delivered: number;
  readonly failed: number;
}

export class MagpieBus {
  private seq = 0;
  private readonly handlers = new Map<string, Set<MagpieHandler>>();
  private readonly log: MagpieEvent[] = [];

  constructor(private readonly historyLimit = 1_000) {
    if (!Number.isSafeInteger(historyLimit) || historyLimit < 1) throw new Error("MAGPIE_HISTORY_LIMIT_INVALID");
  }

  subscribe<T>(topic: string, handler: MagpieHandler<T>): () => void {
    const normalized = this.normalizeTopic(topic);
    let bucket = this.handlers.get(normalized);
    if (!bucket) {
      bucket = new Set();
      this.handlers.set(normalized, bucket);
    }
    bucket.add(handler as MagpieHandler);
    return () => {
      bucket?.delete(handler as MagpieHandler);
    };
  }

  publish<T>(input: MagpiePublishInput<T>): MagpieDeliveryReport {
    const topic = this.normalizeTopic(input.topic);
    if (!input.type.trim()) throw new Error("MAGPIE_TYPE_REQUIRED");
    this.seq += 1;
    const event: MagpieEvent<T> = Object.freeze({
      id: `mpe-${sha256({ topic, type: input.type, seq: this.seq }).slice(0, 24)}`,
      topic,
      type: input.type,
      payload: input.payload,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      schemaVersion: MAGPIE_SCHEMA_VERSION,
      correlationId: input.correlationId,
      causationId: input.causationId,
    });

    this.log.push(event);
    if (this.log.length > this.historyLimit) this.log.splice(0, this.log.length - this.historyLimit);

    const targets = new Set<MagpieHandler>([
      ...(this.handlers.get(topic) ?? []),
      ...(this.handlers.get(MAGPIE_WILDCARD) ?? []),
    ]);

    let delivered = 0;
    let failed = 0;
    for (const handler of targets) {
      try {
        handler(event);
        delivered += 1;
      } catch {
        failed += 1;
      }
    }

    return { eventId: event.id, topic, delivered, failed };
  }

  history(topic?: string): readonly MagpieEvent[] {
    if (topic === undefined) return [...this.log];
    const normalized = this.normalizeTopic(topic);
    return this.log.filter((event) => event.topic === normalized);
  }

  subscriberCount(topic?: string): number {
    if (topic === undefined) {
      let total = 0;
      for (const bucket of this.handlers.values()) total += bucket.size;
      return total;
    }
    return this.handlers.get(this.normalizeTopic(topic))?.size ?? 0;
  }

  private normalizeTopic(topic: string): string {
    const normalized = topic.trim();
    if (!normalized) throw new Error("MAGPIE_TOPIC_REQUIRED");
    return normalized;
  }
}
