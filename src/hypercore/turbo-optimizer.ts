/**
 * HyperCore Turbo Optimizer (state: draft | engine-generated).
 *
 * A bounded, deterministic memoization layer for the HyperCore hot path.
 *
 * Honesty contract: this is a per-process, in-memory memoizer — NOT a
 * distributed cache, NOT a measured throughput benchmark. `hitRate` is a derived
 * ratio over operations observed in this process; the latency figures are
 * wall-clock measurements of the wrapped factory only.
 *
 * Design invariants (all previously violated and now enforced):
 * - True LRU: a hit re-inserts the entry so the least-recently USED key is the
 *   one evicted (a plain Map insertion order is FIFO, which evicted hot keys).
 * - `hitRate` is a ratio in 0..1 (a fraction of all operations), so it can never
 *   exceed 1. The previous implementation divided hits by misses, reporting
 *   400% for four hits over a single miss.
 * - Context metadata never shares storage with values: it is appended to a
 *   separate bounded ring buffer. Previously every call with metadata created a
 *   fresh `key:meta:<uuid>` entry that polluted the value cache and evicted real
 *   entries.
 * - Eviction, expiry and rejection are counted so callers can see pressure.
 */

export interface TurboMetricSnapshot {
  /** Hits as a fraction of all operations (0..1). Never exceeds 1. */
  readonly hitRate: number;
  /** Hits as a percentage (0..100), derived from `hitRate`. */
  readonly cacheHitRate: number;
  readonly averageLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  /** Factory executions (cache misses) observed in this process. */
  readonly throughput: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly expirations: number;
  readonly entries: number;
  readonly metadataSamples: number;
  readonly warmFactor: number;
  readonly ready: boolean;
}

export interface TurboExecutionContext {
  op: string;
  payloadSize?: number;
  timestamp?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface TurboMetricSample {
  readonly op: string;
  readonly key: string;
  readonly payloadSize: number | null;
  readonly timestamp: number;
  readonly metadata: Readonly<Record<string, string | number | boolean | null | undefined>> | null;
}

/** Bounded latency window; keeps the last N samples for mean/p50/p95. */
class LatencyWindow {
  private readonly samples: number[] = [];

  constructor(private readonly capacity: number) {}

  record(value: number): void {
    this.samples.push(value);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  mean(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
  }

  percentile(p: number): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
    );
    return sorted[index] ?? 0;
  }

  clear(): void {
    this.samples.length = 0;
  }
}

interface TurboEntry {
  readonly value: unknown;
  readonly expiresAt: number;
}

export class HyperCoreTurboOptimizer {
  /** Insertion order encodes recency: the first key is the least recently used. */
  private readonly cache = new Map<string, TurboEntry>();
  private readonly metadata: TurboMetricSample[] = [];
  private readonly latency: LatencyWindow;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(
    private readonly ttlMs = 60_000,
    private readonly maxEntries = 512,
    private readonly maxMetadataSamples = 256,
    private readonly warmupOperations = 25
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs < 1) throw new Error('TURBO_TTL_INVALID');
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1)
      throw new Error('TURBO_MAX_ENTRIES_INVALID');
    if (!Number.isSafeInteger(maxMetadataSamples) || maxMetadataSamples < 1) {
      throw new Error('TURBO_MAX_METADATA_INVALID');
    }
    this.latency = new LatencyWindow(Math.max(16, maxEntries));
  }

  private touch(key: string, entry: TurboEntry): void {
    // Re-insert to move the key to the most-recently-used end of the Map.
    this.cache.delete(key);
    this.cache.set(key, entry);
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) return;
      this.cache.delete(oldestKey);
      this.evictions += 1;
    }
  }

  private recordMetadata(key: string, ctx: TurboExecutionContext | undefined): void {
    if (!ctx) return;
    const sample: TurboMetricSample = Object.freeze({
      op: ctx.op,
      key,
      payloadSize:
        typeof ctx.payloadSize === 'number' && Number.isFinite(ctx.payloadSize)
          ? ctx.payloadSize
          : null,
      timestamp:
        typeof ctx.timestamp === 'number' && Number.isFinite(ctx.timestamp)
          ? ctx.timestamp
          : Date.now(),
      metadata: ctx.metadata ? Object.freeze({ ...ctx.metadata }) : null,
    });
    this.metadata.push(sample);
    if (this.metadata.length > this.maxMetadataSamples) this.metadata.shift();
  }

  /**
   * Returns the cached value for `key` when present and unexpired; otherwise
   * computes `factory()`, stores it and returns it.
   */
  resolve<T>(key: string, factory: () => T, ctx?: TurboExecutionContext): T {
    const normalizedKey = key.trim();
    if (!normalizedKey) throw new Error('TURBO_KEY_REQUIRED');
    const now = Date.now();
    const cached = this.cache.get(normalizedKey);

    if (cached && cached.expiresAt > now) {
      this.hits += 1;
      this.touch(normalizedKey, cached);
      this.recordMetadata(normalizedKey, ctx);
      return cached.value as T;
    }
    if (cached) {
      // Expired: drop it so it is never reported as a stale hit.
      this.cache.delete(normalizedKey);
      this.expirations += 1;
    }

    const started = performance.now();
    const value = factory();
    this.latency.record(performance.now() - started);
    this.misses += 1;

    this.evictIfNeeded();
    this.cache.set(normalizedKey, { value, expiresAt: now + this.ttlMs });
    this.recordMetadata(normalizedKey, ctx);
    return value;
  }

  /** Whether a live, unexpired entry exists. Does not count as a hit. */
  has(key: string): boolean {
    const entry = this.cache.get(key.trim());
    return entry !== undefined && entry.expiresAt > Date.now();
  }

  /** Drops a single entry. Returns true when something was removed. */
  invalidate(key: string): boolean {
    return this.cache.delete(key.trim());
  }

  snapshot(): TurboMetricSnapshot {
    const operations = this.hits + this.misses;
    const hitRate = operations === 0 ? 0 : this.hits / operations;
    return Object.freeze({
      hitRate,
      cacheHitRate: hitRate * 100,
      averageLatencyMs: this.latency.mean(),
      p50LatencyMs: this.latency.percentile(50),
      p95LatencyMs: this.latency.percentile(95),
      throughput: this.misses,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations,
      entries: this.cache.size,
      metadataSamples: this.metadata.length,
      warmFactor: Math.min(1, operations / Math.max(1, this.warmupOperations)),
      ready: operations > 0,
    });
  }

  /** Recent context samples (bounded). Never part of the value cache. */
  samples(): readonly TurboMetricSample[] {
    return Object.freeze([...this.metadata]);
  }

  purge(): void {
    this.cache.clear();
    this.metadata.length = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
    this.latency.clear();
  }
}

export const createHyperCoreTurboOptimizer = (
  ttlMs?: number,
  maxEntries?: number,
  maxMetadataSamples?: number
) =>
  maxMetadataSamples === undefined
    ? new HyperCoreTurboOptimizer(ttlMs, maxEntries)
    : new HyperCoreTurboOptimizer(ttlMs, maxEntries, maxMetadataSamples);

export const hyperCoreTurbo = createHyperCoreTurboOptimizer(60000, 512);

export const turboProfile = {
  optimize: <T>(key: string, factory: () => T, ctx?: TurboExecutionContext) =>
    hyperCoreTurbo.resolve(key, factory, ctx),
  snapshot: () => hyperCoreTurbo.snapshot(),
  samples: () => hyperCoreTurbo.samples(),
  purge: () => hyperCoreTurbo.purge(),
};
