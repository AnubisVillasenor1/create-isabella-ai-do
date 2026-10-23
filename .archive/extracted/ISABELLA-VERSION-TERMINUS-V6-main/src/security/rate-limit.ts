export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface WindowState {
  startedAt: number;
  count: number;
}

/**
 * Process-local fixed-window limiter.
 *
 * Capacity pressure is fail-closed: active buckets are never evicted to admit a
 * new key, because doing so lets an attacker reset another client's quota by
 * flooding the map with distinct keys. Expired buckets may be reclaimed.
 * This remains a per-process guard, not a distributed WAF.
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("RATE_LIMIT_LIMIT_INVALID");
    if (!Number.isFinite(windowMs) || windowMs < 1) throw new Error("RATE_LIMIT_WINDOW_INVALID");
    if (!Number.isSafeInteger(maxKeys) || maxKeys < 1) throw new Error("RATE_LIMIT_MAX_KEYS_INVALID");
  }

  consume(key: string, now = Date.now()): RateLimitDecision {
    const normalizedKey = key.trim();
    if (!normalizedKey) throw new Error("RATE_LIMIT_KEY_REQUIRED");

    let state = this.windows.get(normalizedKey);
    if (state && (now - state.startedAt >= this.windowMs || now < state.startedAt)) {
      this.windows.delete(normalizedKey);
      state = undefined;
    }

    if (!state && this.windows.size >= this.maxKeys) {
      this.evictExpired(now);
      // Do not evict an active client's quota to make room for an attacker-
      // controlled key. Reject new buckets until a window expires.
      if (this.windows.size >= this.maxKeys) {
        let retryAfterMs = this.windowMs;
        for (const active of this.windows.values()) {
          retryAfterMs = Math.min(retryAfterMs, Math.max(1, this.windowMs - (now - active.startedAt)));
        }
        return { allowed: false, remaining: 0, retryAfterMs };
      }
    }

    if (!state) {
      state = { startedAt: now, count: 0 };
      this.windows.set(normalizedKey, state);
    }

    if (state.count >= this.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, this.windowMs - (now - state.startedAt)) };
    }

    state.count += 1;
    return { allowed: true, remaining: Math.max(0, this.limit - state.count), retryAfterMs: 0 };
  }

  private evictExpired(now: number): void {
    // Only genuinely elapsed windows are reclaimable. A rolled-back clock
    // (now < startedAt) must never free capacity: that would let a new key
    // capture another client's quota by rewinding time.
    for (const [key, state] of this.windows) {
      if (now - state.startedAt >= this.windowMs) this.windows.delete(key);
    }
  }
}
