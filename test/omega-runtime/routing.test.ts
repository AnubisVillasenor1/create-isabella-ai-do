import { describe, expect, it } from "vitest";
import {
  AdaptiveTokenRouter,
  CognitiveLoadBalancer,
  HyperEvolutionEngine,
  MicroBatcher,
} from "../../src/omega-runtime/routing";

describe("ΩX-08 adaptive token routing", () => {
  it("routes economy vocabulary to the economy expert with normalized weights", () => {
    const router = new AdaptiveTokenRouter();
    const result = router.route("Necesito los precios de Stripe y las suscripciones del marketplace.");
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.topExperts[0]?.id).toBe("economy");
    expect(result.topExperts).toHaveLength(3);
    const total = Object.values(result.expertWeights).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(result.entropy).toBeGreaterThanOrEqual(0);
    expect(result.entropy).toBeLessThanOrEqual(1);
    expect(result.tokenRoutes.length).toBeGreaterThan(0);
  });

  it("returns an empty, safe result for an empty input", () => {
    const result = new AdaptiveTokenRouter().route("   ");
    expect(result.tokens).toBe(0);
    expect(result.tokenRoutes).toEqual([]);
    expect(result.topExperts).toHaveLength(3);
  });
});

describe("ΩX-09 micro-batching fabric", () => {
  it("groups concurrent jobs into one real batch", async () => {
    const seen: number[][] = [];
    const batcher = new MicroBatcher<number, number>({
      maxBatchSize: 3,
      maxDelayMs: 0,
      handler: async (items) => {
        seen.push([...items]);
        return items.map((value) => value * 2);
      },
    });
    const results = await Promise.all([batcher.submit(1), batcher.submit(2), batcher.submit(3)]);
    expect(results).toEqual([2, 4, 6]);
    expect(seen).toEqual([[1, 2, 3]]);
    expect(batcher.stats()).toMatchObject({ batches: 1, items: 3, failures: 0, largestBatch: 3, pending: 0 });
  });

  it("rejects every job in a failed batch", async () => {
    const batcher = new MicroBatcher<number, number>({
      maxBatchSize: 2,
      maxDelayMs: 0,
      handler: async () => {
        throw new Error("BATCH_FAILED");
      },
    });
    const settled = await Promise.allSettled([batcher.submit(1), batcher.submit(2)]);
    expect(settled.every((entry) => entry.status === "rejected")).toBe(true);
    expect(batcher.stats().failures).toBe(1);
  });

  it("validates batching bounds", () => {
    expect(
      () =>
        new MicroBatcher({
          maxBatchSize: 0,
          maxDelayMs: 0,
          handler: async () => [],
        }),
    ).toThrow(/maxBatchSize/);
    expect(
      () =>
        new MicroBatcher({
          maxBatchSize: 1,
          maxDelayMs: 2_000,
          handler: async () => [],
        }),
    ).toThrow(/maxDelayMs/);
  });
});

describe("ΩX-11 cognitive load balancer", () => {
  it("tracks in-flight work and latency pressure", () => {
    const balancer = new CognitiveLoadBalancer(16, 100, 4);
    const first = balancer.begin();
    const second = balancer.begin();
    expect(balancer.snapshot().inFlight).toBe(2);
    balancer.end(first, 80);
    balancer.end(second, 120);
    const snapshot = balancer.snapshot();
    expect(snapshot.inFlight).toBe(0);
    expect(snapshot.samples).toBe(2);
    expect(snapshot.p95Ms).toBe(120);
    expect(snapshot.pressure).toBeGreaterThan(0);
    expect(snapshot.pressure).toBeLessThanOrEqual(1);
  });

  it("ignores duplicate or unknown completion tokens", () => {
    const balancer = new CognitiveLoadBalancer(8, 100, 2);
    const token = balancer.begin();
    balancer.end(token, 10);
    balancer.end(token, 10);
    balancer.end(999, 10);
    expect(balancer.snapshot().samples).toBe(1);
    expect(balancer.snapshot().inFlight).toBe(0);
  });
});

describe("ΩX-25 hyper evolution engine", () => {
  it("explores every arm before exploiting measured rewards", () => {
    const engine = new HyperEvolutionEngine();
    expect(engine.select()).toBe("lean");
    engine.reward("lean", 0.9);
    expect(engine.select()).toBe("grounded");
    engine.reward("grounded", 0.3);
    expect(engine.select()).toBe("deep");
    engine.reward("deep", 0.6);
    const snapshot = engine.snapshot();
    expect(snapshot.map((arm) => arm.arm)).toEqual(["lean", "grounded", "deep"]);
    expect(snapshot.reduce((total, arm) => total + arm.pulls, 0)).toBe(3);
    expect(snapshot.every((arm) => Number.isFinite(arm.ucb) && arm.ucb < 9_999)).toBe(true);
    expect(engine.select()).toBe("lean");
  });
});
