import { describe, expect, it } from "vitest";
import { SloTracker, burnRate } from "../../src/observability/slo";

/** state: draft | engine-generated */
const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);
const MIN = 60_000;

function feed(t: SloTracker, now: number, minutesBack: number, perMin: number, errRate: number): void {
  for (let m = 0; m < minutesBack; m += 1) {
    const bad = Math.floor(errRate * perMin);
    for (let i = 0; i < perMin; i += 1) t.record(i >= bad, now - m * MIN);
  }
}

describe("burnRate", () => {
  it("is error ratio over error budget", () => {
    expect(burnRate(0.001, 0.999)).toBeCloseTo(1, 9);
    expect(burnRate(0.0144, 0.999)).toBeCloseTo(14.4, 9);
    expect(() => burnRate(0.1, 1)).toThrow();
    expect(() => burnRate(2, 0.99)).toThrow();
  });
});

describe("SloTracker", () => {
  it("raises no alert at a healthy error rate and none without traffic", () => {
    const t = new SloTracker(0.999);
    expect(t.evaluate(T0)).toEqual([]);
    feed(t, T0, 120, 2000, 0.0005); // 1 error/2000 = 0.05% → burn 0.5 (< 1)
    expect(t.evaluate(T0)).toEqual([]);
  });
  it("pages on a sustained fast burn (both windows)", () => {
    const t = new SloTracker(0.999);
    feed(t, T0, 70, 100, 0.05); // 5% error → burn 50
    const ids = t.evaluate(T0).map((a) => a.rule);
    expect(ids).toContain("fast-burn-1h");
    expect(t.evaluate(T0).find((a) => a.rule === "fast-burn-1h")?.severity).toBe("PAGE");
  });
  it("does not page when only the short window burns... or only the long one", () => {
    const longOnly = new SloTracker(0.999);
    feed(longOnly, T0 - 10 * MIN, 50, 100, 0.05); // terminó hace 10 min
    feed(longOnly, T0, 8, 100, 0);
    expect(longOnly.evaluate(T0).map((a) => a.rule)).not.toContain("fast-burn-1h");
    const shortOnly = new SloTracker(0.999);
    feed(shortOnly, T0 - 5 * MIN, 600, 100, 0);
    feed(shortOnly, T0, 5, 100, 0.05);
    expect(shortOnly.evaluate(T0).map((a) => a.rule)).not.toContain("fast-burn-1h");
  });
  it("computes budget consumed and ignores data beyond the window", () => {
    const t = new SloTracker(0.99);
    feed(t, T0, 10, 100, 0.01);
    expect(t.budgetConsumed(60 * MIN, T0)).toBeCloseTo(1, 1);
    expect(t.errorRatio(MIN, T0 + 10 * 60 * MIN)).toBeNull();
    expect(() => t.errorRatio(365 * 24 * 60 * MIN, T0)).toThrow();
  });
  it("prunes memory beyond retention and validates config", () => {
    const t = new SloTracker(0.99);
    for (let m = 0; m < 5000; m += 1) t.record(true, T0 + m * MIN);
    expect((t as unknown as { buckets: Map<number, unknown> }).buckets.size).toBeLessThan(4400);
    expect(() => new SloTracker(1)).toThrow();
    expect(() => new SloTracker(0.99, [{ id: "x", severity: "PAGE", burnRate: 1, longWindowMs: 10, shortWindowMs: 20 }])).toThrow();
  });
});
