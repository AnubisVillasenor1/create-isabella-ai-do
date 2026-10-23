import { describe, expect, it } from "vitest";
import { LatencyRegistry } from "../../src/deployment/latency-metrics";

describe("bounded route latency metrics", () => {
  it("calculates percentiles and counts server errors", () => {
    const metrics = new LatencyRegistry(4, 16);
    for (let i = 1; i <= 10; i += 1) metrics.record("GET /hot", i, i === 10 ? 500 : 200);
    const [summary] = metrics.snapshot();
    expect(summary?.requests).toBe(10);
    expect(summary?.sampled).toBe(10);
    expect(summary?.p50Ms).toBe(5);
    expect(summary?.p95Ms).toBe(10);
    expect(summary?.serverErrors).toBe(1);
  });

  it("keeps a bounded sample window and route cardinality", () => {
    const metrics = new LatencyRegistry(2, 8);
    for (let i = 0; i < 20; i += 1) metrics.record("GET /hot", i, 200);
    metrics.record("GET /other", 3, 200);
    metrics.record("GET /third", 9, 503);
    const summaries = metrics.snapshot();
    expect(summaries.length).toBe(2);
    expect(summaries.find((x) => x.route === "GET /hot")?.requests).toBe(20);
    expect(summaries.find((x) => x.route === "GET /hot")?.sampled).toBe(8);
    expect(summaries.some((x) => x.route === "__other__")).toBe(true);
  });

  it("ignores invalid samples instead of corrupting percentiles", () => {
    const metrics = new LatencyRegistry();
    metrics.record("GET /x", Number.NaN, 200);
    metrics.record("GET /x", 3, 99);
    metrics.record("GET /x", 2, 200);
    expect(metrics.snapshot()[0]?.requests).toBe(1);
    expect(metrics.snapshot()[0]?.p95Ms).toBe(2);
  });
});
