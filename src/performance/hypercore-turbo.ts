/**
 * HyperCore Turbo Ω v2 — process-local acceleration primitives.
 *
 * state: wired | tested (unit). This module performs real work: bounded TTL+LRU
 * caching with single-flight coalescing and stale-while-revalidate, a concurrency
 * gate for external provider calls, bounded latency histograms and deterministic
 * progressive-delivery chunking. It is NOT a distributed cache, a CDN, a model
 * runtime, or proof of production throughput. Metrics describe this process only.
 */

export interface TurboCacheStats {
  readonly entries: number;
  readonly hits: number;
  readonly staleHits: number;
  readonly misses: number;
  readonly coalesced: number;
  readonly evictions: number;
  readonly loadErrors: number;
  readonly loads: number;
}

export type TurboCacheOutcome = 'fresh' | 'stale' | 'coalesced' | 'miss';

export interface TurboCacheResult<T> {
  readonly value: T;
  readonly outcome: TurboCacheOutcome;
}

interface TurboCacheEntry<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

export interface TurboCacheOptions {
  readonly ttlMs: number;
  readonly staleMs?: number;
  readonly maxEntries?: number;
  readonly now?: () => number;
}

/**
 * Bounded LRU cache with single-flight loading. A stale value is returned
 * immediately inside the stale window while one background refresh runs; the
 * caller never receives a rejected refresh as a cache hit.
 */
export class TurboTtlCache<T> {
  private readonly entries = new Map<string, TurboCacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly ttlMs: number;
  private readonly staleMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private stats = {
    hits: 0,
    staleHits: 0,
    misses: 0,
    coalesced: 0,
    evictions: 0,
    loadErrors: 0,
    loads: 0,
  };

  constructor(options: TurboCacheOptions) {
    if (!Number.isFinite(options.ttlMs) || options.ttlMs < 1)
      throw new RangeError('TURBO_TTL_INVALID');
    const staleMs = options.staleMs ?? 0;
    if (!Number.isFinite(staleMs) || staleMs < 0) throw new RangeError('TURBO_STALE_INVALID');
    const maxEntries = options.maxEntries ?? 256;
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1)
      throw new RangeError('TURBO_MAX_ENTRIES_INVALID');
    this.ttlMs = Math.trunc(options.ttlMs);
    this.staleMs = Math.trunc(staleMs);
    this.maxEntries = maxEntries;
    this.now = options.now ?? (() => Date.now());
  }

  read(key: string): TurboCacheResult<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const now = this.now();
    if (now >= entry.staleUntil) {
      this.entries.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    if (now < entry.expiresAt) {
      this.stats.hits += 1;
      return { value: entry.value, outcome: 'fresh' };
    }
    this.stats.staleHits += 1;
    return { value: entry.value, outcome: 'stale' };
  }

  async getOrLoad(key: string, loader: () => Promise<T>): Promise<TurboCacheResult<T>> {
    const cached = this.read(key);
    if (cached) {
      if (cached.outcome === 'stale' && !this.inFlight.has(key)) {
        // Refresh in the background. Failures are counted but never surfaced as a
        // fresh value; the stale value remains usable until staleUntil.
        void this.load(key, loader).catch(() => undefined);
      }
      return cached;
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      this.stats.coalesced += 1;
      return { value: await existing, outcome: 'coalesced' };
    }
    const value = await this.load(key, loader);
    return { value, outcome: 'miss' };
  }

  set(key: string, value: T): void {
    const now = this.now();
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.stats.evictions += 1;
    }
    this.entries.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      staleUntil: now + this.ttlMs + this.staleMs,
    });
  }

  invalidate(key?: string): void {
    if (key === undefined) this.entries.clear();
    else this.entries.delete(key);
  }

  snapshot(): TurboCacheStats {
    return {
      entries: this.entries.size,
      ...this.stats,
    };
  }

  private load(key: string, loader: () => Promise<T>): Promise<T> {
    this.stats.loads += 1;
    const pending = (async () => {
      try {
        const value = await loader();
        this.set(key, value);
        return value;
      } catch (error) {
        this.stats.loadErrors += 1;
        throw error;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, pending);
    return pending;
  }
}

/** Bounded latency histogram; percentiles are approximations from a fixed sample window. */
export class TurboLatencyHistogram {
  private readonly samples: number[] = [];
  private total = 0;
  private max = 0;
  private dropped = 0;

  constructor(private readonly maxSamples = 2_048) {
    if (!Number.isSafeInteger(maxSamples) || maxSamples < 16)
      throw new RangeError('TURBO_HISTOGRAM_SIZE_INVALID');
  }

  record(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
    const value = Math.round(milliseconds * 10) / 10;
    if (this.samples.length >= this.maxSamples) {
      this.samples.shift();
      this.dropped += 1;
    }
    this.samples.push(value);
    this.total += value;
    this.max = Math.max(this.max, value);
  }

  percentile(percentile: number): number {
    if (this.samples.length === 0) return 0;
    const clamped = Math.min(100, Math.max(0, percentile));
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((clamped / 100) * sorted.length) - 1)
    );
    return sorted[index] ?? 0;
  }

  snapshot(): {
    count: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    dropped: number;
  } {
    return {
      count: this.samples.length,
      avg: this.samples.length === 0 ? 0 : Math.round((this.total / this.samples.length) * 10) / 10,
      p50: this.percentile(50),
      p90: this.percentile(90),
      p95: this.percentile(95),
      p99: this.percentile(99),
      max: this.max,
      dropped: this.dropped,
    };
  }
}

export class TurboGateSaturatedError extends Error {
  constructor() {
    super('TURBO_GATE_SATURATED');
    this.name = 'TurboGateSaturatedError';
  }
}

interface QueuedGateTask {
  readonly start: () => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** Bounded concurrency gate with FIFO queue; saturation fails closed instead of unbounded waiting. */
export class TurboGate {
  private active = 0;
  private queued: QueuedGateTask[] = [];
  private totalQueueWaitMs = 0;
  private completed = 0;
  private rejected = 0;
  private peakActive = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number
  ) {
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1)
      throw new RangeError('TURBO_GATE_CONCURRENCY_INVALID');
    if (!Number.isSafeInteger(maxQueue) || maxQueue < 0)
      throw new RangeError('TURBO_GATE_QUEUE_INVALID');
  }

  async run<T>(task: () => Promise<T>, queueTimeoutMs = 0): Promise<T> {
    if (this.active < this.maxConcurrent) return this.execute(task);
    if (this.queued.length >= this.maxQueue || queueTimeoutMs <= 0) {
      this.rejected += 1;
      throw new TurboGateSaturatedError();
    }
    return new Promise<T>((resolve, reject) => {
      const startedAt = Date.now();
      const queued: QueuedGateTask = {
        start: () => {
          const wait = Date.now() - startedAt;
          this.totalQueueWaitMs += wait;
          void this.execute(task).then(resolve, reject);
        },
        reject,
        timer: setTimeout(() => {
          this.queued = this.queued.filter((entry) => entry !== queued);
          this.rejected += 1;
          reject(new TurboGateSaturatedError());
        }, queueTimeoutMs),
      };
      this.queued.push(queued);
    });
  }

  snapshot(): {
    active: number;
    queued: number;
    completed: number;
    rejected: number;
    peakActive: number;
    avgQueueWaitMs: number;
  } {
    return {
      active: this.active,
      queued: this.queued.length,
      completed: this.completed,
      rejected: this.rejected,
      peakActive: this.peakActive,
      avgQueueWaitMs:
        this.completed === 0 ? 0 : Math.round((this.totalQueueWaitMs / this.completed) * 10) / 10,
    };
  }

  private async execute<T>(task: () => Promise<T>): Promise<T> {
    this.active += 1;
    this.peakActive = Math.max(this.peakActive, this.active);
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.completed += 1;
      const next = this.queued.shift();
      if (next) {
        clearTimeout(next.timer);
        next.start();
      }
    }
  }
}

const COUNTER_KEY = /^[a-z0-9_.-]{1,64}$/;

/** Bounded named counters and latency histograms for honest, process-local telemetry. */
export class TurboMetrics {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, TurboLatencyHistogram>();

  increment(name: string, by = 1): void {
    if (!COUNTER_KEY.test(name) || !Number.isFinite(by)) return;
    if (!this.counters.has(name) && this.counters.size >= 128) return;
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  observe(name: string, milliseconds: number): void {
    if (!COUNTER_KEY.test(name)) return;
    let histogram = this.histograms.get(name);
    if (!histogram) {
      if (this.histograms.size >= 32) return;
      histogram = new TurboLatencyHistogram();
      this.histograms.set(name, histogram);
    }
    histogram.record(milliseconds);
  }

  snapshot(): {
    counters: Record<string, number>;
    latencies: Record<string, ReturnType<TurboLatencyHistogram['snapshot']>>;
  } {
    const latencies: Record<string, ReturnType<TurboLatencyHistogram['snapshot']>> = {};
    for (const [name, histogram] of this.histograms) latencies[name] = histogram.snapshot();
    return {
      counters: Object.fromEntries(
        [...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b))
      ),
      latencies,
    };
  }
}

/**
 * Split text into progressive-delivery chunks without splitting inside a word when
 * possible. This is deterministic chunking of an already generated response; it is
 * not token-level streaming from an upstream model.
 */
export function splitStreamChunks(text: string, maxChunkChars = 220): string[] {
  if (!Number.isSafeInteger(maxChunkChars) || maxChunkChars < 16)
    throw new RangeError('TURBO_CHUNK_SIZE_INVALID');
  const trimmed = text.trim();
  if (!trimmed) return [];
  const chunks: string[] = [];
  let remaining = trimmed;
  while (remaining.length > maxChunkChars) {
    const window = remaining.slice(0, maxChunkChars);
    const boundary = Math.max(
      window.lastIndexOf('\n'),
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf('; '),
      window.lastIndexOf(', '),
      window.lastIndexOf(' ')
    );
    const cut = boundary > maxChunkChars * 0.4 ? boundary + 1 : maxChunkChars;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export interface TurboSnapshot {
  readonly engine: 'hypercore-turbo-v2';
  readonly scope: 'process-local';
  readonly generatedAt: string;
  readonly metrics: ReturnType<TurboMetrics['snapshot']>;
  readonly providerGate: ReturnType<TurboGate['snapshot']>;
  readonly disclaimers: readonly string[];
}

export const turboMetrics = new TurboMetrics();
export const providerGate = new TurboGate(6, 96);

export function buildTurboSnapshot(): TurboSnapshot {
  return {
    engine: 'hypercore-turbo-v2',
    scope: 'process-local',
    generatedAt: new Date().toISOString(),
    metrics: turboMetrics.snapshot(),
    providerGate: providerGate.snapshot(),
    disclaimers: [
      'Las métricas describen este proceso y su ventana actual; no son un SLA ni una medición de producción.',
      'La caché es local, acotada y no durable; no constituye memoria verificada ni permiso.',
      'La entrega progresiva reenvía contenido ya generado; no afirma streaming nativo del proveedor.',
    ],
  };
}
