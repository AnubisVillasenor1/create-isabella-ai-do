import { describe, expect, it } from "vitest";
import {
  assessProductionReadiness,
  TokenBucket,
  CircuitBreaker,
  withTimeout,
  createCorrelation,
  isMaintenanceActive,
  buildOpsSnapshot,
} from "../../src/deployment";

describe("production readiness", () => {
  it("is ready only when all required dependencies are healthy", () => {
    expect(assessProductionReadiness([{ name: "a", status: "healthy", required: true }]).ready).toBe(true);
    const degraded = assessProductionReadiness([
      { name: "a", status: "healthy", required: true },
      { name: "b", status: "unavailable", required: false },
    ]);
    expect(degraded.status).toBe("degraded");
    expect(degraded.ready).toBe(false);

    const down = assessProductionReadiness([{ name: "a", status: "unavailable", required: true }]);
    expect(down.status).toBe("unavailable");
    expect(down.blockers).toContain("a:unavailable");
  });

  it("fails closed when no dependency evidence is supplied", () => {
    const result = assessProductionReadiness([]);
    expect(result.status).toBe("unavailable");
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("dependencies:not-configured");
  });

  it("reports required degraded dependencies as blockers", () => {
    const result = assessProductionReadiness([{ name: "bookpi", status: "degraded", required: true }]);
    expect(result.status).toBe("degraded");
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("bookpi:degraded");
  });

  it("rejects ambiguous duplicate dependency names", () => {
    const result = assessProductionReadiness([
      { name: "database", status: "healthy", required: true },
      { name: "database", status: "healthy", required: true },
    ]);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("dependency:duplicate:database");
  });

  it("rejects unknown runtime health states", () => {
    const malformed = [{ name: "database", status: "unknown", required: true }] as unknown as Parameters<typeof assessProductionReadiness>[0];
    const result = assessProductionReadiness(malformed);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("database:invalid-health-record");
  });
});

describe("token bucket rate limiting", () => {
  it("allows up to capacity then rejects with retry hint", () => {
    const bucket = new TokenBucket(2, 0.001, 1000);
    expect(bucket.tryConsume(1, 1000).allowed).toBe(true);
    expect(bucket.tryConsume(1, 1000).allowed).toBe(true);
    const denied = bucket.tryConsume(1, 1000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills over time", () => {
    const bucket = new TokenBucket(1, 0.001, 0);
    expect(bucket.tryConsume(1, 0).allowed).toBe(true);
    expect(bucket.tryConsume(1, 0).allowed).toBe(false);
    expect(bucket.tryConsume(1, 2000).allowed).toBe(true);
  });

  it("rejects non-finite configuration, costs, and timestamps", () => {
    expect(() => new TokenBucket(Number.NaN, 0.1)).toThrow(/capacity/);
    expect(() => new TokenBucket(1, Number.POSITIVE_INFINITY)).toThrow(/refill rate/);
    expect(() => new TokenBucket(1, 0.1, Number.NaN)).toThrow(/time/);
    const bucket = new TokenBucket(2, 0.1, 0);
    expect(() => bucket.tryConsume(Number.NaN, 1)).toThrow(/cost/);
    expect(() => bucket.tryConsume(3, 1)).toThrow(/capacity/);
    expect(() => bucket.tryConsume(1, Number.POSITIVE_INFINITY)).toThrow(/time/);
  });

  it("does not double-count elapsed time when the clock moves backwards", () => {
    const bucket = new TokenBucket(3, 0.001, 1000);
    expect(bucket.tryConsume(2, 1000).remaining).toBe(1);
    expect(bucket.tryConsume(1, 500).allowed).toBe(true);
    expect(bucket.tryConsume(1, 1500).allowed).toBe(false);
    expect(bucket.tryConsume(1, 2000).allowed).toBe(true);
  });
});

describe("circuit breaker", () => {
  it("rejects invalid thresholds, durations, and timestamps", () => {
    expect(() => new CircuitBreaker({ failureThreshold: 0 })).toThrow(/failureThreshold/);
    expect(() => new CircuitBreaker({ failureThreshold: 1.5 })).toThrow(/failureThreshold/);
    expect(() => new CircuitBreaker({ openMs: Number.NaN })).toThrow(/openMs/);
    const breaker = new CircuitBreaker();
    expect(() => breaker.allow(Number.NaN)).toThrow(/time/);
    expect(() => breaker.recordFailure(Number.POSITIVE_INFINITY)).toThrow(/time/);
  });

  it("opens after threshold and recovers via half-open", () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, openMs: 100 });
    expect(breaker.allow(0)).toBe(true);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    expect(breaker.currentState).toBe("OPEN");
    expect(breaker.allow(50)).toBe(false);
    expect(breaker.allow(150)).toBe(true);
    expect(breaker.currentState).toBe("HALF_OPEN");
    expect(breaker.allow(151)).toBe(false);
    breaker.recordSuccess();
    expect(breaker.currentState).toBe("CLOSED");
  });
});

describe("timeouts, correlation and maintenance", () => {
  it("rejects invalid timeout values", async () => {
    await expect(withTimeout(async () => "unused", Number.NaN)).rejects.toThrow(/finite and > 0/);
    await expect(withTimeout(async () => "unused", Number.POSITIVE_INFINITY)).rejects.toThrow(/finite and > 0/);
  });

  it("rejects on timeout", async () => {
    await expect(withTimeout(() => new Promise((r) => setTimeout(r, 50)), 10, "x")).rejects.toThrow(/timed out/);
    await expect(withTimeout(async () => "ok", 100)).resolves.toBe("ok");
  });

  it("propagates trace id in correlation context", () => {
    const parent = createCorrelation();
    const child = createCorrelation(parent);
    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
  });

  it("detects active maintenance windows", () => {
    const windows = [{ startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T01:00:00Z", reason: "deploy" }];
    expect(isMaintenanceActive(windows, new Date("2026-01-01T00:30:00Z"))).toBe(true);
    expect(isMaintenanceActive(windows, new Date("2026-01-01T02:00:00Z"))).toBe(false);
  });

  it("rejects malformed or inverted maintenance windows", () => {
    expect(() => isMaintenanceActive([
      { startsAt: "not-a-date", endsAt: "2026-01-01T01:00:00Z", reason: "deploy" },
    ])).toThrow(/valid dates/);
    expect(() => isMaintenanceActive([
      { startsAt: "2026-01-01T02:00:00Z", endsAt: "2026-01-01T01:00:00Z", reason: "deploy" },
    ])).toThrow(/startsAt <= endsAt/);
  });

  it("builds a coherent ops snapshot", () => {
    const snapshot = buildOpsSnapshot([{ name: "a", status: "healthy", required: true }]);
    expect(snapshot.readiness.ready).toBe(true);
    expect(snapshot.correlation.requestId).toBeTruthy();
  });
});
