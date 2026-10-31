import { describe, expect, it } from "vitest";
import { splitZeroLossRevenue, verifyZeroLossSplit } from "../../src/lib/monetization/revenue";

describe("zero-loss revenue split · accounting invariant", () => {
  it("holds exactly for every gross/infrastructure combination", () => {
    for (let gross = 1; gross < 2_000; gross += 1) {
      for (const infra of [0, 37, 111, 250, 999]) {
        const split = splitZeroLossRevenue({
          grossPaidCents: gross,
          infrastructureCostCents: infra,
          refundReserveRatio: 0.1,
          communityShareRatio: 0.05,
        });
        expect(verifyZeroLossSplit(split)).toBe(true);
        expect(split.netUserAmountCents).toBeGreaterThanOrEqual(0);
        expect(split.refundReserveCents).toBeGreaterThanOrEqual(0);
        expect(split.platformFeeCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("reports an uncovered loss explicitly when infrastructure exceeds gross", () => {
    const split = splitZeroLossRevenue({
      grossPaidCents: 100,
      infrastructureCostCents: 250,
      refundReserveRatio: 0.1,
      communityShareRatio: 0.05,
    });
    expect(split.uncoveredLossCents).toBe(150);
    expect(split.netUserAmountCents).toBe(0);
    expect(verifyZeroLossSplit(split)).toBe(true);
  });

  it("fails closed on out-of-range ratios", () => {
    const base = { grossPaidCents: 1_000, infrastructureCostCents: 0 };
    expect(() => splitZeroLossRevenue({ ...base, refundReserveRatio: -0.1, communityShareRatio: 0.05 })).toThrow();
    expect(() => splitZeroLossRevenue({ ...base, refundReserveRatio: 1.5, communityShareRatio: 0.05 })).toThrow();
    expect(() => splitZeroLossRevenue({ ...base, refundReserveRatio: 0.1, communityShareRatio: 2 })).toThrow();
    expect(() => splitZeroLossRevenue({ ...base, refundReserveRatio: Number.NaN, communityShareRatio: 0.05 })).toThrow();
  });
});
