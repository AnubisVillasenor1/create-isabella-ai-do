import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "../../src/security/rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("allows up to the configured limit and then denies", () => {
    const limiter = new FixedWindowRateLimiter(2, 1000);
    expect(limiter.consume("ip-a", 100).allowed).toBe(true);
    expect(limiter.consume("ip-a", 200).allowed).toBe(true);
    expect(limiter.consume("ip-a", 300)).toMatchObject({ allowed: false, remaining: 0, retryAfterMs: 800 });
  });

  it("resets after the window and isolates keys", () => {
    const limiter = new FixedWindowRateLimiter(1, 1000);
    expect(limiter.consume("ip-a", 100).allowed).toBe(true);
    expect(limiter.consume("ip-b", 200).allowed).toBe(true);
    expect(limiter.consume("ip-a", 1100).allowed).toBe(true);
  });

  it("rejects invalid limits, capacity, and empty keys", () => {
    expect(() => new FixedWindowRateLimiter(0, 1000)).toThrow(/LIMIT_INVALID/);
    expect(() => new FixedWindowRateLimiter(1, 0)).toThrow(/WINDOW_INVALID/);
    expect(() => new FixedWindowRateLimiter(1, 1000, 0)).toThrow(/MAX_KEYS_INVALID/);
    expect(() => new FixedWindowRateLimiter(1, 1000).consume(" ")).toThrow(/KEY_REQUIRED/);
  });

  it("does not evict an active bucket when an attacker floods unique keys", () => {
    const limiter = new FixedWindowRateLimiter(2, 1000, 2);
    expect(limiter.consume("victim", 100)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("other", 100)).toMatchObject({ allowed: true, remaining: 1 });

    for (let i = 0; i < 100; i += 1) {
      expect(limiter.consume(`attacker-${i}`, 200)).toMatchObject({ allowed: false, remaining: 0 });
    }

    // The victim's quota remains intact despite the key-flood attempt.
    expect(limiter.consume("victim", 300)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("victim", 400)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("reclaims expired buckets before rejecting a new key", () => {
    const limiter = new FixedWindowRateLimiter(1, 1000, 1);
    expect(limiter.consume("old", 100).allowed).toBe(true);
    expect(limiter.consume("new", 1100)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("fails closed on clock rollback and preserves bounded capacity", () => {
    const limiter = new FixedWindowRateLimiter(1, 1000, 2);
    limiter.consume("a", 1000);
    limiter.consume("b", 1000);
    expect(limiter.consume("a", 900)).toMatchObject({ allowed: true });
    expect(limiter.consume("c", 901)).toMatchObject({ allowed: false });
  });
});
