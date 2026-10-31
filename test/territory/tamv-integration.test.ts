import { describe, expect, it } from "vitest";
import {
  TAMV_INTEGRATION_MAP,
  TAMV_MODULES,
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

  it("keeps every listed module registered with its own disclaimer", () => {
    for (const module of TAMV_MODULES) {
      const descriptor = TAMV_INTEGRATION_MAP[module];
      expect(descriptor.module).toBe(module);
      expect(CAPABILITY_MATURITY).toContain(descriptor.maturity);
      expect(descriptor.disclaimer.length).toBeGreaterThan(0);
    }
  });

  it("registers the audio system below production and says what it does not do", () => {
    expect(TAMV_INTEGRATION_MAP.KaosAudioSystem.maturity).toBe("tested");
    expect(TAMV_INTEGRATION_MAP.KaosAudioSystem.disclaimer).toMatch(/sintetiz|renderiz/i);
    expect(assessIntegrationHonesty("KaosAudioSystem", "tested").claimedAsProduction).toBe(false);
    expect(assessIntegrationHonesty("KaosAudioSystem", "verified").claimedAsProduction).toBe(true);
  });
});
