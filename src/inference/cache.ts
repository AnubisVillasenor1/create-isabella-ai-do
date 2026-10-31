export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

/**
 * Bounded in-memory TTL cache with least-recently-used eviction.
 * Expired entries are removed on reads and opportunistically before writes;
 * this cache is process-local and must not be used as durable storage.
 */
export class TtlCache<T> {
  private readonly data = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs = 30_000,
    private readonly maxEntries = 1_000
  ) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
      throw new RangeError('TTL_CACHE_TTL_INVALID');
    }
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('TTL_CACHE_MAX_ENTRIES_INVALID');
    }
  }

  get(key: string): T | undefined {
    const entry = this.data.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.data.delete(key);
      return undefined;
    }

    entry.hits += 1;
    // Map insertion order is used as the LRU order: most recently used last.
    this.data.delete(key);
    this.data.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();
    this.removeExpired(now);

    const existing = this.data.get(key);
    if (existing) this.data.delete(key);
    while (this.data.size >= this.maxEntries) {
      const leastRecentlyUsed = this.data.keys().next().value;
      if (leastRecentlyUsed === undefined) break;
      this.data.delete(leastRecentlyUsed);
    }

    this.data.set(key, {
      value,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      hits: 0,
    });
  }

  clear(): void {
    this.data.clear();
  }

  stats(): { entries: number; hits: number } {
    return {
      entries: this.data.size,
      hits: [...this.data.values()].reduce((total, entry) => total + entry.hits, 0),
    };
  }

  private removeExpired(now: number): void {
    for (const [key, entry] of this.data) {
      if (now >= entry.expiresAt) this.data.delete(key);
    }
  }
}
