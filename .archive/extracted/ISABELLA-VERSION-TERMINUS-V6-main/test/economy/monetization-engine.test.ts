import { describe, expect, it } from "vitest";
import { MonetizationEngine } from "../../src/economy/monetization-engine";

describe("Monetization Engine", () => {
  it("lists plans", () => {
    const m = new MonetizationEngine();
    expect(m.plans()).toHaveLength(4);
    expect(m.plan("free")?.priceMonthly).toBe(0);
  });
  it("escrow hold/release/refund", () => {
    const m = new MonetizationEngine();
    const h = m.escrow("alice", "bob", 100);
    expect(h.status).toBe("held");
    const r = m.releaseEscrow(h.id);
    expect(r.status).toBe("released");
    const h2 = m.escrow("a", "b", 50);
    const rf = m.refundEscrow(h2.id);
    expect(rf.status).toBe("refunded");
  });
  it("payouts", () => {
    const m = new MonetizationEngine();
    const p = m.payout("creator", 200, 500);
    expect(p.amount).toBe(200);
    expect(m.payouts_()).toHaveLength(1);
  });
  it("scer split 75/25", () => {
    const m = new MonetizationEngine();
    const s = m.scerSplit(100);
    expect(s.community).toBe(75);
    expect(s.sovereign).toBe(25);
    expect(s.total).toBe(100);
  });
  it("validates input", () => {
    const m = new MonetizationEngine();
    expect(() => m.escrow("", "b", 10)).toThrow();
    expect(() => m.escrow("a", "b", -1)).toThrow();
    expect(() => m.payout("r", -1)).toThrow();
    expect(() => m.scerSplit(-1)).toThrow();
  });
  it("stats", () => {
    const m = new MonetizationEngine();
    m.escrow("a", "b", 10);
    expect(m.stats().escrows).toBe(1);
  });
});
