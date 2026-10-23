import { describe, expect, it } from "vitest";
import { MetricsRegistry, createMetricsSnapshotHash } from "../../src/observability/metrics";

describe("metrics registry", () => {
  it("computes count, average, percentiles and error rate from recorded requests", () => {
    const metrics = new MetricsRegistry();
    for (let i = 1; i <= 10; i++) metrics.recordRequest(i);
    metrics.recordError();
    metrics.recordError();
    const snapshot = metrics.getSnapshot();
    expect(snapshot.requestCount).toBe(10);
    expect(snapshot.errorCount).toBe(2);
    expect(snapshot.errorRate).toBeCloseTo(0.2, 4);
    expect(snapshot.avgResponseTimeMs).toBeCloseTo(5.5, 1);
    expect(snapshot.p50ResponseTimeMs).toBe(5);
    expect(snapshot.p95ResponseTimeMs).toBe(10);
  });

  it("ignores invalid latency inputs", () => {
    const metrics = new MetricsRegistry();
    metrics.recordRequest(Number.NaN);
    metrics.recordRequest(-5);
    metrics.recordRequest(1);
    expect(metrics.getSnapshot().requestCount).toBe(1);
  });

  it("bounds the latency window to the configured size", () => {
    const metrics = new MetricsRegistry(100);
    for (let i = 1; i <= 250; i++) metrics.recordRequest(i);
    expect(metrics.getSnapshot().requestCount).toBe(250);
    expect(metrics.getSnapshot().p95ResponseTimeMs).toBeGreaterThan(100);
  });

  it("rejects invalid window sizes and hashes snapshots deterministically", () => {
    expect(() => new MetricsRegistry(10)).toThrow("latencyWindowSize");
    const metrics = new MetricsRegistry();
    metrics.recordRequest(3);
    const s1 = metrics.getSnapshot();
    expect(createMetricsSnapshotHash(s1)).toMatch(/^[a-f0-9]{12}$/);
    expect(createMetricsSnapshotHash(s1)).toBe(createMetricsSnapshotHash(s1));
    metrics.recordRequest(100);
    expect(createMetricsSnapshotHash(metrics.getSnapshot())).not.toBe(createMetricsSnapshotHash(s1));
  });
});