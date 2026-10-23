import { describe, expect, it } from "vitest";
import { canEarn, computeRevenueShare } from "../../src/commerce/revenue-share";

const P = (userId: string, plan: "free" | "premium" | "vip" | "enterprise", status: "active" | "trialing" | "past_due" | "canceled" | "suspended", points: number) => ({ userId, plan, status, points });

describe("canEarn", () => {
  it("only paid plans with active subscription earn", () => {
    expect(canEarn("free", "active")).toEqual({ eligible: false, reason: "free_plan" });
    expect(canEarn("premium", "trialing")).toEqual({ eligible: false, reason: "subscription_not_active" });
    expect(canEarn("vip", "past_due").eligible).toBe(false);
    expect(canEarn("premium", "active")).toEqual({ eligible: true });
    expect(canEarn("enterprise", "active").eligible).toBe(true);
  });
});

describe("computeRevenueShare 70/30", () => {
  it("splits net 70/30 and excludes free users entirely", () => {
    const r = computeRevenueShare({
      grossCents: 100_000, refundsCents: 5_000, processorFeesCents: 3_000, taxesCents: 2_000,
      participants: [P("a", "premium", "active", 3), P("b", "vip", "active", 1), P("c", "free", "active", 999)],
    });
    expect(r.netCents).toBe(90_000);
    expect(r.userPoolCents).toBe(63_000);
    expect(r.platformCents).toBe(27_000);
    const by = Object.fromEntries(r.lines.map((l) => [l.userId, l]));
    expect(by.a?.amountCents).toBe(47_250);
    expect(by.b?.amountCents).toBe(15_750);
    expect(by.c).toEqual({ userId: "c", amountCents: 0, eligible: false, reason: "free_plan" });
  });

  it("conserves every cent (invariant) with awkward rounding", () => {
    for (const gross of [1, 7, 99, 101, 12_345, 999_999]) {
      const r = computeRevenueShare({
        grossCents: gross,
        participants: [P("x", "premium", "active", 1), P("y", "premium", "active", 1), P("z", "vip", "active", 1)],
      });
      const sum = r.lines.reduce((s, l) => s + l.amountCents, 0);
      expect(sum + r.platformCents + r.unallocatedCents).toBe(r.netCents);
      expect(r.platformCents).toBeGreaterThanOrEqual(Math.floor((r.netCents * 3000) / 10000));
    }
  });

  it("keeps the user pool with the platform when nobody is eligible", () => {
    const r = computeRevenueShare({ grossCents: 10_000, participants: [P("f", "free", "active", 5), P("t", "premium", "trialing", 5)] });
    expect(r.unallocatedCents).toBe(7_000);
    expect(r.lines.every((l) => l.amountCents === 0)).toBe(true);
  });

  it("is deterministic regardless of participant order", () => {
    const ps = [P("b", "premium", "active", 1), P("a", "premium", "active", 1), P("c", "premium", "active", 1)];
    const a = computeRevenueShare({ grossCents: 1_000, participants: ps });
    const b = computeRevenueShare({ grossCents: 1_000, participants: [...ps].reverse() });
    expect(a).toEqual(b);
  });

  it("rejects invalid inputs", () => {
    expect(() => computeRevenueShare({ grossCents: 10.5, participants: [] })).toThrow();
    expect(() => computeRevenueShare({ grossCents: 100, refundsCents: 200, participants: [] })).toThrow(/superan/);
    expect(() => computeRevenueShare({ grossCents: 100, participants: [P("a", "vip", "active", 1), P("a", "vip", "active", 1)] })).toThrow(/duplicado/);
    expect(() => computeRevenueShare({ grossCents: 100, participants: [P("a", "vip", "active", -1)] })).toThrow();
    expect(() => computeRevenueShare({ grossCents: 100, userShareBps: 10_001, participants: [] })).toThrow();
  });
});
