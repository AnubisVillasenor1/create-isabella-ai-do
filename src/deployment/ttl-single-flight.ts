/**
 * TTL cache with single-flight request coalescing for expensive health probes.
 * Successful results are cached; failures are not cached so recovery is immediate.
 * Invalidation advances a generation so an older in-flight probe cannot repopulate
 * the cache or prevent a fresh probe from starting.
 */
export class TtlSingleFlight<T> {
  private value: T | undefined;
  private expiresAt = 0;
  private generation = 0;
  private inFlight: { generation: number; promise: Promise<T> } | undefined;

  constructor(private readonly ttlMs: number) {
    if (!Number.isFinite(ttlMs) || ttlMs < 1) throw new Error('TTL_CACHE_TTL_INVALID');
  }

  async get(loader: () => Promise<T>, now = Date.now()): Promise<T> {
    if (this.value !== undefined && now < this.expiresAt) return this.value;
    const generation = this.generation;
    if (this.inFlight?.generation === generation) return this.inFlight.promise;

    let loaded: Promise<T>;
    try {
      loaded = loader();
    } catch (error) {
      loaded = Promise.reject(error);
    }
    const pending = Promise.resolve(loaded);
    this.inFlight = { generation, promise: pending };
    try {
      const result = await pending;
      if (this.generation === generation) {
        this.value = result;
        this.expiresAt = Date.now() + this.ttlMs;
      }
      return result;
    } catch (error) {
      if (this.generation === generation) {
        this.value = undefined;
        this.expiresAt = 0;
      }
      throw error;
    } finally {
      if (this.inFlight?.promise === pending) this.inFlight = undefined;
    }
  }

  invalidate(): void {
    this.generation += 1;
    this.value = undefined;
    this.expiresAt = 0;
    this.inFlight = undefined;
  }
}
