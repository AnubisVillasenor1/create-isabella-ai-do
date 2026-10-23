import { afterEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "../../src/inference/cache";

afterEach(() => {
  vi.useRealTimers();
});

describe("TtlCache", () => {
  it("rejects invalid capacity and TTL instead of silently disabling bounds", () => {
    expect(() => new TtlCache(0, 10)).toThrow("TTL_CACHE_TTL_INVALID");
    expect(() => new TtlCache(1_000, 0)).toThrow("TTL_CACHE_MAX_ENTRIES_INVALID");
    expect(() => new TtlCache(Number.POSITIVE_INFINITY, 10)).toThrow("TTL_CACHE_TTL_INVALID");
  });

  it("expires entries on read and removes expired entries before inserting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    const cache = new TtlCache<string>(1_000, 2);
    cache.set("expired", "old");
    vi.advanceTimersByTime(1_001);
    expect(cache.get("expired")).toBeUndefined();

    cache.set("live-a", "a");
    cache.set("live-b", "b");
    vi.advanceTimersByTime(1_001);
    cache.set("live-c", "c");
    expect(cache.stats().entries).toBe(1);
    expect(cache.get("live-c")).toBe("c");
  });

  it("evicts the least recently used entry when capacity is reached", () => {
    const cache = new TtlCache<string>(30_000, 2);
    cache.set("a", "A");
    cache.set("b", "B");

    expect(cache.get("a")).toBe("A"); // refresh A; B becomes least recently used
    cache.set("c", "C");

    expect(cache.get("a")).toBe("A");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("C");
    expect(cache.stats()).toEqual({ entries: 2, hits: 3 });
  });

  it("replacing a key does not grow the cache past its configured capacity", () => {
    const cache = new TtlCache<number>(30_000, 1);
    cache.set("same", 1);
    cache.set("same", 2);
    expect(cache.get("same")).toBe(2);
    expect(cache.stats().entries).toBe(1);
  });

  it("clears entries and hit accounting", () => {
    const cache = new TtlCache<number>();
    cache.set("x", 1);
    cache.get("x");
    cache.clear();
    expect(cache.stats()).toEqual({ entries: 0, hits: 0 });
  });
});
