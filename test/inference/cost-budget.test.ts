import { describe, expect, it } from "vitest";
import { BudgetDeniedError, CostBudget, estimateCostMicroUsd } from "../../src/inference/cost-budget";

/** state: draft | engine-generated */
const D1 = Date.UTC(2026, 9, 16, 10);
const D2 = Date.UTC(2026, 9, 17, 10);

describe("estimateCostMicroUsd", () => {
  it("computes integer µUSD, rounding up", () => {
    expect(estimateCostMicroUsd(1_000_000, 0, 3, 15)).toBe(3_000_000);
    expect(estimateCostMicroUsd(1000, 500, 3, 15)).toBe(10_500);
    expect(estimateCostMicroUsd(1, 0, 0.5, 0)).toBe(1);
    expect(() => estimateCostMicroUsd(-1, 0, 1, 1)).toThrow();
  });
});

describe("CostBudget", () => {
  it("reserves, settles and tracks remaining", () => {
    const b = new CostBudget(1000);
    const r = b.reserve("t", 400, D1);
    expect(b.remaining("t", D1)).toBe(600);
    expect(b.settle(r.id, 300)).toEqual({ charged: 300, overrun: 0 });
    expect(b.usage("t", D1)).toMatchObject({ spent: 300, reserved: 0, remaining: 700 });
  });
  it("fails closed when the reservation does not fit (no partial spend)", () => {
    const b = new CostBudget(1000);
    b.reserve("t", 700, D1);
    expect(() => b.reserve("t", 400, D1)).toThrow(BudgetDeniedError);
    expect(b.usage("t", D1).reserved).toBe(700);
  });
  it("release refunds; double close is rejected", () => {
    const b = new CostBudget(1000);
    const r = b.reserve("t", 1000, D1);
    b.release(r.id);
    expect(b.remaining("t", D1)).toBe(1000);
    expect(() => b.release(r.id)).toThrow();
    expect(() => b.settle(r.id, 1)).toThrow();
  });
  it("records overruns visibly and resets daily", () => {
    const b = new CostBudget(1000);
    const r = b.reserve("t", 100, D1);
    expect(b.settle(r.id, 250).overrun).toBe(150);
    expect(b.usage("t", D1).overrun).toBe(150);
    expect(b.usage("t", D2)).toMatchObject({ spent: 0, overrun: 0, remaining: 1000 });
  });
  it("a reservation opened yesterday does not corrupt today's counters", () => {
    const b = new CostBudget(1000);
    const r = b.reserve("t", 500, D1);
    expect(b.remaining("t", D2)).toBe(1000);
    b.settle(r.id, 500);
    expect(b.usage("t", D2)).toMatchObject({ spent: 0, reserved: 0 });
  });
  it("isolates tenants, supports per-tenant limits and validates input", () => {
    const b = new CostBudget(100);
    b.setLimit("big", 10_000);
    b.reserve("a", 100, D1);
    expect(() => b.reserve("a", 1, D1)).toThrow();
    expect(b.reserve("b", 100, D1).amount).toBe(100);
    expect(b.reserve("big", 5000, D1).amount).toBe(5000);
    expect(() => b.reserve("", 1)).toThrow();
    expect(() => b.reserve("a", 1.5)).toThrow();
    expect(() => new CostBudget(-1)).toThrow();
  });
  it("bounds open reservations", () => {
    const b = new CostBudget(1_000_000, 2);
    b.reserve("t", 1, D1);
    b.reserve("t", 1, D1);
    expect(() => b.reserve("t", 1, D1)).toThrow(BudgetDeniedError);
  });
});
