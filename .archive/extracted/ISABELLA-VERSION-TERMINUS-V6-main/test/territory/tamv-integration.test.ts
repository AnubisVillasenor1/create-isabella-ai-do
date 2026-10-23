import { describe, expect, it } from "vitest";
import {
  TAMV_INTEGRATION_MAP,
  CAPABILITY_MATURITY,
  assessIntegrationHonesty,
} from "../../src/territory/tamv-integration";

describe("TAMV integration honesty", () => {
  it("declares module maturity and disclaimers", () => {
    expect(TAMV_INTEGRATION_MAP.MSR.maturity).toBe("implemented");
    expect(TAMV_INTEGRATION_MAP.MDD.disclaimer).toMatch(/legal|financiera|bancaria/i);
    expect(CAPABILITY_MATURITY).toContain("verified");
  });

  it("flags claims above real maturity as overclaim", () => {
    const honest = assessIntegrationHonesty("MSR", "implemented");
    expect(honest.claimedAsProduction).toBe(false);
    const overclaim = assessIntegrationHonesty("MDD", "verified");
    expect(overclaim.claimedAsProduction).toBe(true);
  });
});
