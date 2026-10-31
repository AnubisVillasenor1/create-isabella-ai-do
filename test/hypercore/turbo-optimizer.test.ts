import { describe, expect, it } from "vitest";
import { createHyperCoreTurboOptimizer } from "../../src/hypercore/turbo-optimizer";

describe("HyperCore Turbo Optimizer", () => {
  it("reports hitRate as a fraction of operations (never above 1)", () => {
    const turbo = createHyperCoreTurboOptimizer(60_000, 8);
    turbo.resolve("k", () => "v");
    for (let i = 0; i < 4; i += 1) turbo.resolve("k", () => "v");
    const snapshot = turbo.snapshot();
    // 4 hits over 5 operations = 0.8, NOT 400% (the previous bug).
    expect(snapshot.hitRate).toBeCloseTo(0.8, 10);
    expect(snapshot.cacheHitRate).toBeCloseTo(80, 10);
    expect(snapshot.hitRate).toBeLessThanOrEqual(1);
    expect(snapshot.hits).toBe(4);
    expect(snapshot.misses).toBe(1);
    expect(snapshot.throughput).toBe(1);
  });

  it("evicts the least recently USED entry, not the oldest inserted", () => {
    const turbo = createHyperCoreTurboOptimizer(60_000, 3);
    turbo.resolve("a", () => 1);
    turbo.resolve("b", () => 2);
    turbo.resolve("c", () => 3);
    // Touch "a" so "b" becomes the least recently used key.
    turbo.resolve("a", () => 1);
    turbo.resolve("d", () => 4);
    expect(turbo.has("a")).toBe(true);
    expect(turbo.has("b")).toBe(false);
    expect(turbo.has("c")).toBe(true);
    expect(turbo.has("d")).toBe(true);
    expect(turbo.snapshot().evictions).toBe(1);
  });

  it("keeps context metadata out of the value cache", () => {
    const turbo = createHyperCoreTurboOptimizer(60_000, 4, 3);
    for (let i = 0; i < 10; i += 1) {
      turbo.resolve("value", () => "v", { op: "render", metadata: { i } });
    }
    const snapshot = turbo.snapshot();
    // The value key is never evicted by metadata churn.
    expect(turbo.has("value")).toBe(true);
    expect(snapshot.entries).toBe(1);
    expect(snapshot.evictions).toBe(0);
    expect(snapshot.metadataSamples).toBe(3); // bounded ring buffer
    expect(turbo.samples()).toHaveLength(3);
    expect(turbo.samples().at(-1)?.metadata).toEqual({ i: 9 });
  });

  it("counts expirations instead of returning a stale value", () => {
    let now = 0;
    const turbo = createHyperCoreTurboOptimizer(1_000, 4);
    const realNow = Date.now;
    Date.now = () => now;
    try {
      turbo.resolve("k", () => "first");
      now = 5_000;
      expect(turbo.resolve("k", () => "second")).toBe("second");
      const snapshot = turbo.snapshot();
      expect(snapshot.expirations).toBe(1);
      expect(snapshot.hits).toBe(0);
      expect(snapshot.misses).toBe(2);
    } finally {
      Date.now = realNow;
    }
  });

  it("rejects empty keys and validates configuration", () => {
    const turbo = createHyperCoreTurboOptimizer(60_000, 4);
    expect(() => turbo.resolve("  ", () => 1)).toThrow("TURBO_KEY_REQUIRED");
    expect(() => createHyperCoreTurboOptimizer(0, 4)).toThrow("TURBO_TTL_INVALID");
    expect(() => createHyperCoreTurboOptimizer(1_000, 0)).toThrow("TURBO_MAX_ENTRIES_INVALID");
  });

  it("invalidates single entries and purges all state", () => {
    const turbo = createHyperCoreTurboOptimizer(60_000, 4);
    turbo.resolve("a", () => 1);
    expect(turbo.invalidate("a")).toBe(true);
    expect(turbo.invalidate("a")).toBe(false);
    turbo.resolve("b", () => 2);
    turbo.purge();
    const snapshot = turbo.snapshot();
    expect(snapshot.entries).toBe(0);
    expect(snapshot.hits).toBe(0);
    expect(snapshot.misses).toBe(0);
    expect(snapshot.ready).toBe(false);
    expect(snapshot.metadataSamples).toBe(0);
  });
});
