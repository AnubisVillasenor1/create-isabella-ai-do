import { describe, expect, it } from "vitest";
import { buildPricingCatalog, RECOMMENDED_PLAN, yearlySavings } from "../../src/commerce/catalog";
import { BILLING_PRICES } from "../../src/commerce/pricing";

describe("pricing catalog", () => {
  it("computes yearly savings honestly", () => {
    expect(yearlySavings(1900, 19000)).toEqual({ pct: 16.7, monthsFree: 2 });
    expect(yearlySavings(7900, 79000)).toEqual({ pct: 16.7, monthsFree: 2 });
    expect(yearlySavings(1000, 12000)).toEqual({ pct: 0, monthsFree: 0 });
    expect(yearlySavings(0, 100)).toEqual({ pct: 0, monthsFree: 0 });
  });

  it("covers every plan in order, recommends exactly one, and marks enterprise as contact-sales", () => {
    const c = buildPricingCatalog();
    expect(c.plans.map((p) => p.id)).toEqual(["free", "premium", "vip", "enterprise"]);
    expect(c.plans.filter((p) => p.recommended).map((p) => p.id)).toEqual([RECOMMENDED_PLAN]);
    expect(c.plans.find((p) => p.id === "enterprise")?.contactSales).toBe(true);
    expect(c.plans.find((p) => p.id === "free")?.monthly).toBeNull();
  });

  it("derives effective monthly price from the yearly price and never leaks Stripe ids", () => {
    const c = buildPricingCatalog();
    const premium = c.plans.find((p) => p.id === "premium")!;
    expect(premium.monthly?.unitAmount).toBe(1900);
    expect(premium.yearly?.effectiveMonthly).toBe(Math.round(19000 / 12));
    expect(JSON.stringify(c)).not.toMatch(/stripePriceId|price_/);
    expect(BILLING_PRICES.length).toBeGreaterThan(0);
  });

  it("describes quotas in plain language, with unlimited for enterprise", () => {
    const c = buildPricingCatalog();
    expect(c.plans.find((p) => p.id === "enterprise")?.highlights.join("|")).toContain("ilimitados");
    expect(c.plans.find((p) => p.id === "premium")?.highlights.join("|")).toContain("ofertas activas");
  });
});
