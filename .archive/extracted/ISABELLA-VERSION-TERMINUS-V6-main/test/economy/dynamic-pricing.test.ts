import { describe, expect, it } from "vitest";
import { DynamicPricingEngine, dynamicPrice } from "../../src/economy/dynamic-pricing";

describe("Dynamic Pricing", () => {
  it("computes dynamic price", () => {
    expect(dynamicPrice({ basePrice: 10, demandFactor: 1.2, loadFactor: 1.1, valueFactor: 1 })).toBe(13.2);
  });
  it("never negative", () => {
    expect(dynamicPrice({ basePrice: 0, demandFactor: 2, loadFactor: 2, valueFactor: 2 })).toBe(0);
  });
  it("validates input", () => {
    expect(() => dynamicPrice({ basePrice: -1, demandFactor: 1, loadFactor: 1, valueFactor: 1 })).toThrow();
    expect(() => dynamicPrice({ basePrice: 1, demandFactor: -1, loadFactor: 1, valueFactor: 1 })).toThrow();
  });
  it("engine tracks history and surge", () => {
    const e = new DynamicPricingEngine();
    e.price({ basePrice: 10, demandFactor: 1, loadFactor: 1, valueFactor: 1 });
    expect(e.stats().samples).toBe(1);
    expect(e.surgeMultiplier(10, 5)).toBeGreaterThan(1);
    expect(e.surgeMultiplier(5, 10)).toBe(1);
  });
});
