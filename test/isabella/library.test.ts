import { describe, expect, it } from "vitest";
import {
  ISABELLA_MODULE_IDS,
  ISABELLA_MODULES,
  ISABELLA_API_GROUPS,
  ETHICAL_SAFEGUARDS,
  COMPLIANCE_FRAMEWORKS,
  listIsabellaModules,
  auditIsabellaModule,
} from "../../src/isabella";

describe("Isabella AI library catalog", () => {
  it("declares 9 modules with capabilities and dependencies", () => {
    expect(ISABELLA_MODULE_IDS).toHaveLength(9);
    for (const id of ISABELLA_MODULE_IDS) {
      expect(ISABELLA_MODULES[id].capabilities.length).toBeGreaterThan(0);
      expect(ISABELLA_MODULES[id].dependencies.length).toBeGreaterThan(0);
    }
  });

  it("declares 8 API groups with endpoints", () => {
    expect(ISABELLA_API_GROUPS).toHaveLength(8);
    for (const group of ISABELLA_API_GROUPS) {
      expect(group.endpoints.length).toBeGreaterThan(0);
    }
  });

  it("audits modules with safeguards and compliance frameworks", () => {
    const audit = auditIsabellaModule("core-cognitive-emotional");
    expect(audit.declaresLimits).toBe(true);
    expect(audit.safeguards).toEqual(ETHICAL_SAFEGUARDS);
    expect(audit.frameworks).toEqual(COMPLIANCE_FRAMEWORKS);
    expect(listIsabellaModules()).toHaveLength(9);
  });
});
