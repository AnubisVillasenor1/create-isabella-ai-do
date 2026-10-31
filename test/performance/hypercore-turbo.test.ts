import { describe, expect, it } from "vitest";
import {
  buildTurboSnapshot,
  splitStreamChunks,
  TurboGate,
  TurboGateSaturatedError,
  TurboLatencyHistogram,
  TurboMetrics,
  TurboTtlCache,
} from "../../src/performance/hypercore-turbo";

function clock(start = 1_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
      return now;
    },
  };
}

describe("TurboTtlCache", () => {
  it("serves fresh values, then stale values inside the stale window, then misses", () => {
    const time = clock();
    const cache = new TurboTtlCache<string>({ ttlMs: 100, staleMs: 50, now: time.now });
    cache.set("k", "v");
    expect(cache.read("k")).toEqual({ value: "v", outcome: "fresh" });
    time.advance(120);
    expect(cache.read("k")).toEqual({ value: "v", outcome: "stale" });
    time.advance(40);
    expect(cache.read("k")).toBeNull();
  });

  it("coalesces concurrent loads for the same key into a single flight", async () => {
    const cache = new TurboTtlCache<string>({ ttlMs: 1_000 });
    let loads = 0;
    let release: (value: string) => void = () => undefined;
    const loader = () => {
      loads += 1;
      return new Promise<string>((resolve) => {
        release = resolve;
      });
    };
    const first = cache.getOrLoad("key", loader);
    const second = cache.getOrLoad("key", loader);
    release("answer");
    const [a, b] = await Promise.all([first, second]);
    expect(loads).toBe(1);
    expect([a.outcome, b.outcome].sort()).toEqual(["coalesced", "miss"]);
    expect(a.value).toBe("answer");
    expect(b.value).toBe("answer");
    expect(cache.snapshot().coalesced).toBe(1);
  });

  it("revalidates a stale value in the background without blocking the caller", async () => {
    const time = clock();
    const cache = new TurboTtlCache<string>({ ttlMs: 100, staleMs: 5_000, now: time.now });
    cache.set("k", "old");
    time.advance(150);
    let refreshed = false;
    const result = await cache.getOrLoad("k", async () => {
      refreshed = true;
      return "new";
    });
    expect(result).toEqual({ value: "old", outcome: "stale" });
    await Promise.resolve();
    expect(refreshed).toBe(true);
    expect(cache.read("k")?.value).toBe("new");
    expect(cache.snapshot().staleHits).toBe(1);
  });

  it("bounds entries with LRU eviction", () => {
    const cache = new TurboTtlCache<number>({ ttlMs: 1_000, maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.read("a");
    cache.set("c", 3);
    expect(cache.read("b")).toBeNull();
    expect(cache.read("a")?.value).toBe(1);
    expect(cache.read("c")?.value).toBe(3);
    expect(cache.snapshot().evictions).toBe(1);
  });
});

describe("TurboLatencyHistogram", () => {
  it("reports bounded percentiles from recorded samples", () => {
    const histogram = new TurboLatencyHistogram(128);
    for (let value = 1; value <= 100; value += 1) histogram.record(value);
    const snapshot = histogram.snapshot();
    expect(snapshot.count).toBe(100);
    expect(snapshot.p50).toBeGreaterThanOrEqual(49);
    expect(snapshot.p50).toBeLessThanOrEqual(51);
    expect(snapshot.p95).toBeGreaterThanOrEqual(94);
    expect(snapshot.p99).toBeGreaterThanOrEqual(98);
    expect(snapshot.max).toBe(100);
  });

  it("ignores invalid samples and reports zero when empty", () => {
    const histogram = new TurboLatencyHistogram();
    histogram.record(Number.NaN);
    histogram.record(-5);
    expect(histogram.snapshot()).toMatchObject({ count: 0, avg: 0, p50: 0, p99: 0 });
  });
});

describe("TurboGate", () => {
  it("enforces the concurrency ceiling and drains the queue in FIFO order", async () => {
    const gate = new TurboGate(1, 2);
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const first = gate.run(async () => {
      order.push("first");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
    }, 1_000);
    const second = gate.run(async () => {
      order.push("second");
    }, 1_000);
    await Promise.resolve();
    expect(gate.snapshot()).toMatchObject({ active: 1, queued: 1 });
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "second"]);
    expect(gate.snapshot().completed).toBe(2);
  });

  it("fails closed when the queue is full or the wait expires", async () => {
    const gate = new TurboGate(1, 0);
    let release: () => void = () => undefined;
    const active = gate.run(() => new Promise<void>((resolve) => {
      release = resolve;
    }), 1_000);
    await expect(gate.run(async () => undefined, 1_000)).rejects.toBeInstanceOf(TurboGateSaturatedError);
    release();
    await active;

    const slowGate = new TurboGate(1, 4);
    let slowRelease: () => void = () => undefined;
    const slow = slowGate.run(() => new Promise<void>((resolve) => {
      slowRelease = resolve;
    }), 1_000);
    await expect(slowGate.run(async () => undefined, 5)).rejects.toBeInstanceOf(TurboGateSaturatedError);
    slowRelease();
    await slow;
  });
});

describe("TurboMetrics", () => {
  it("bounds counters and histograms by name", () => {
    const metrics = new TurboMetrics();
    metrics.increment("cognition.cache.hit");
    metrics.increment("cognition.cache.hit");
    metrics.increment("invalid name with spaces");
    metrics.observe("cognition.route.latency", 12);
    const snapshot = metrics.snapshot();
    expect(snapshot.counters["cognition.cache.hit"]).toBe(2);
    expect(snapshot.counters["invalid name with spaces"]).toBeUndefined();
    expect(snapshot.latencies["cognition.route.latency"]?.count).toBe(1);
  });
});

describe("splitStreamChunks", () => {
  it("reassembles the exact text and prefers safe boundaries", () => {
    const text = "Isabella entrega una respuesta gobernada. ".repeat(30).trim();
    const chunks = splitStreamChunks(text, 80);
    expect(chunks.join("")).toBe(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(80);
  });

  it("returns no chunks for blank input and rejects invalid sizes", () => {
    expect(splitStreamChunks("   ")).toEqual([]);
    expect(() => splitStreamChunks("x", 4)).toThrow(RangeError);
  });
});

describe("buildTurboSnapshot", () => {
  it("labels the engine as process-local and includes honest disclaimers", () => {
    const snapshot = buildTurboSnapshot();
    expect(snapshot.engine).toBe("hypercore-turbo-v2");
    expect(snapshot.scope).toBe("process-local");
    expect(snapshot.disclaimers.join(" ")).toMatch(/no son un SLA/);
  });
});
