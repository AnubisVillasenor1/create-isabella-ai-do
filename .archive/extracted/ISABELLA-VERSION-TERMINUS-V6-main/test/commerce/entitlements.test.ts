import { describe, expect, it } from "vitest";
import { checkFeature, checkQuota, planEntitlements } from "../../src/commerce/entitlements";

describe("commerce/entitlements", () => {
  it("FREE no habilita funciones comerciales", () => {
    expect(checkFeature("free", "active", "publish").allowed).toBe(false);
    expect(checkFeature("free", "active", "publish").code).toBe("FEATURE_NOT_IN_PLAN");
  });

  it("PREMIUM habilita offer y landing", () => {
    expect(checkFeature("premium", "active", "offer").allowed).toBe(true);
    expect(checkFeature("premium", "active", "landing").allowed).toBe(true);
  });

  it("PREMIUM no habilita marketplace (es VIP)", () => {
    expect(checkFeature("premium", "active", "marketplace").code).toBe("FEATURE_NOT_IN_PLAN");
    expect(checkFeature("vip", "active", "marketplace").allowed).toBe(true);
  });

  it("una suscripción inactiva bloquea incluso funciones del plan", () => {
    const decision = checkFeature("premium", "canceled", "offer");
    expect(decision.allowed).toBe(false);
    expect(checkFeature("premium", "past_due", "offer").code).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("cuenta suspendida tiene prioridad sobre el plan", () => {
    const decision = checkFeature("vip", "suspended", "marketplace");
    expect(checkFeature("vip", "suspended", "offer").code).toBe("ACCOUNT_SUSPENDED");
    void decision;
  });

  it("ENTERPRISE activo habilita todas las funciones (el contrato se valida al suscribir)", () => {
    expect(checkFeature("enterprise", "active", "publish").allowed).toBe(true);
    expect(checkFeature("enterprise", "active", "marketplace").allowed).toBe(true);
  });

  it("cuota PREMIUM de offers se agota en 3", () => {
    expect(checkQuota("premium", "active", "active_offers", 2).allowed).toBe(true);
    const exceeded = checkQuota("premium", "active", "active_offers", 3);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.code).toBe("QUOTA_EXCEEDED");
    expect(exceeded.limit).toBe(3);
  });

  it("cuota ilimitada del plan ENTERPRISE no se agota", () => {
    const decision = checkQuota("enterprise", "active", "active_offers", 1_000_000);
    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe("OK");
  });

  it("planEntitlements expone features y quotas", () => {
    const entitlements = planEntitlements("vip");
    expect(entitlements.features).toContain("revenue_dashboard");
    expect(entitlements.quotas.workspaces).toBe(3);
  });

  it("cuota en estado inactivo se rechaza por suscripción, no por cupo", () => {
    expect(checkQuota("premium", "canceled", "active_offers", 0).code).toBe("SUBSCRIPTION_INACTIVE");
  });
});
