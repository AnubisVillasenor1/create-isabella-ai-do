import { describe, expect, it } from "vitest";
import {
  PLANS,
  UNLIMITED,
  assertNotContractRequired,
  getPlan,
  planIncludes,
  planUpgradePath,
  quotaFor,
} from "../../src/commerce/plans";

describe("commerce/plans", () => {
  it("FREE no puede publicar ni cobrar", () => {
    expect(planIncludes("free", "publish")).toBe(false);
    expect(planIncludes("free", "collect_payment")).toBe(false);
    expect(planIncludes("free", "revenue_dashboard")).toBe(false);
    expect(planIncludes("free", "checkout")).toBe(false);
  });

  it("PREMIUM habilita oferta, campaña, landing, checkout y leads", () => {
    expect(planIncludes("premium", "offer")).toBe(true);
    expect(planIncludes("premium", "campaign")).toBe(true);
    expect(planIncludes("premium", "landing")).toBe(true);
    expect(planIncludes("premium", "checkout")).toBe(true);
    expect(planIncludes("premium", "lead_process")).toBe(true);
  });

  it("PREMIUM respeta los límites iniciales recomendados", () => {
    expect(quotaFor("premium", "active_offers")).toBe(3);
    expect(quotaFor("premium", "active_campaigns")).toBe(5);
    expect(quotaFor("premium", "connections_per_platform")).toBe(2);
    expect(quotaFor("premium", "attribution_events_per_day")).toBe(1000);
    expect(quotaFor("premium", "leads_per_month")).toBe(500);
  });

  it("VIP extiende límites y habilidades", () => {
    expect(quotaFor("vip", "leads_per_month")).toBe(5000);
    expect(planIncludes("vip", "revenue_dashboard")).toBe(true);
    expect(planIncludes("vip", "multi_workspace")).toBe(true);
    expect(planIncludes("vip", "scheduled_automation")).toBe(true);
  });

  it("ENTERPRISE es ilimitado y requiere contrato", () => {
    expect(quotaFor("enterprise", "active_offers")).toBe(UNLIMITED);
    expect(getPlan("enterprise").contractRequired).toBe(true);
    expect(() => assertNotContractRequired({ planCode: "enterprise" })).toThrow(/CONTRACT_REQUIRED/);
    expect(() => assertNotContractRequired({ planCode: "vip" })).not.toThrow();
  });

  it("describe la ruta de ascenso de plan", () => {
    expect(planUpgradePath("free")).toEqual(["premium", "vip", "enterprise"]);
    expect(planUpgradePath("vip")).toEqual(["enterprise"]);
    expect(planUpgradePath("enterprise")).toEqual([]);
  });

  it("el registro de planes está completo", () => {
    expect(Object.keys(PLANS)).toEqual(["free", "premium", "vip", "enterprise"]);
  });
});