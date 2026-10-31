/**
 * CITEMESH — Sistema Nervioso Digital (state: draft | engine-generated).
 *
 * Event bus federado y auditable: pub/sub con routing, correlación, causalidad y replay. Soporta
 * filtrado por tipo/fuente, acotación de memoria y fail-safe (un handler que falla no detiene a los demás).
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export interface CitemeshEvent<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly payload: T;
  readonly source: string;
  readonly target?: string;
  readonly timestamp: string;
  readonly causationId?: string;
  readonly correlationId?: string;
}

export type EventHandler<T = unknown> = (event: CitemeshEvent<T>) => void | Promise<void>;

export interface CitemeshStats {
  readonly published: number;
  readonly delivered: number;
  readonly failed: number;
  readonly subscribers: number;
  readonly bufferSize: number;
}

export class CitemeshBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly buffer: CitemeshEvent[] = [];
  private published = 0;
  private delivered = 0;
  private failed = 0;
  private seq = 0;

  constructor(
    private readonly maxBuffer = 100_000,
    private readonly maxHandlersPerTopic = 1000
  ) {
    if (!Number.isInteger(maxBuffer) || maxBuffer < 1)
      throw new RangeError('CITEMESH: maxBuffer must be >= 1');
    if (!Number.isInteger(maxHandlersPerTopic) || maxHandlersPerTopic < 1)
      throw new RangeError('CITEMESH: maxHandlersPerTopic must be >= 1');
  }

  subscribe(topic: string, handler: EventHandler): () => void {
    if (typeof topic !== 'string' || topic.length === 0)
      throw new RangeError('CITEMESH: topic required');
    let set = this.handlers.get(topic);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    if (set.size >= this.maxHandlersPerTopic)
      throw new RangeError('CITEMESH: too many handlers for topic');
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.handlers.delete(topic);
    };
  }

  async publish<T = unknown>(
    event: Omit<CitemeshEvent<T>, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): Promise<CitemeshEvent<T>> {
    if (typeof event.type !== 'string' || event.type.length === 0)
      throw new RangeError('CITEMESH: type required');
    if (typeof event.source !== 'string' || event.source.length === 0)
      throw new RangeError('CITEMESH: source required');
    const full: CitemeshEvent<T> = {
      id: event.id ?? `evt-${(this.seq += 1)}`,
      type: event.type,
      payload: event.payload as T,
      source: event.source,
      target: event.target,
      timestamp: event.timestamp ?? new Date().toISOString(),
      causationId: event.causationId,
      correlationId: event.correlationId,
    };
    this.published += 1;
    this.buffer.push(full as CitemeshEvent);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    const topics = [full.type, '*', full.source];
    if (full.target !== undefined) topics.push(full.target);
    const seen = new Set<EventHandler>();
    for (const t of topics) {
      const set = this.handlers.get(t);
      if (set === undefined) continue;
      for (const h of set) {
        if (seen.has(h)) continue;
        seen.add(h);
        try {
          await h(full);
          this.delivered += 1;
        } catch {
          this.failed += 1;
        }
      }
    }
    return full;
  }

  replay(filter?: { type?: string; source?: string; since?: string }): readonly CitemeshEvent[] {
    let out = [...this.buffer];
    if (filter?.type !== undefined) out = out.filter((e) => e.type === filter.type);
    if (filter?.source !== undefined) out = out.filter((e) => e.source === filter.source);
    if (filter?.since !== undefined) out = out.filter((e) => e.timestamp >= filter.since!);
    return out;
  }

  get(id: string): CitemeshEvent | undefined {
    return this.buffer.find((e) => e.id === id);
  }

  stats(): CitemeshStats {
    let subs = 0;
    for (const s of this.handlers.values()) subs += s.size;
    return {
      published: this.published,
      delivered: this.delivered,
      failed: this.failed,
      subscribers: subs,
      bufferSize: this.buffer.length,
    };
  }

  clear(): void {
    this.buffer.length = 0;
    this.handlers.clear();
  }
}
