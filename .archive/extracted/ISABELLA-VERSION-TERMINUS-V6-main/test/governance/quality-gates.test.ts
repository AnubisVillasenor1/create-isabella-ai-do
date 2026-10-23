import { describe, expect, it } from "vitest";
import { createEvidenceManifest, assessManifestCompleteness, canClaimStable } from "../../src/governance";
import { evaluateQualityGates, type QualityGateInput } from "../../src/governance";

const commit = "b".repeat(40);

function fullInput(manifest = createEvidenceManifest({
  repository: "isabella",
  commit,
  claimIds: ["clm-1"],
  sourceIds: ["src-1"],
  validation: { status: "passed", tests: ["t1"], lsp: ["clean"] },
  security: { secretScan: "passed", dependencyScan: "passed" },
  policyDecision: "DEC-1",
  bookpiAuditIds: ["audit-1"],
})): QualityGateInput {
  return {
    allFilesHaveSchema: true,
    noMockAsProduction: true,
    identityMultiSignal: true,
    preservationPolicyActive: true,
    temporalRetrievalActive: true,
    securityPreIndexScan: true,
    tenantIsolationEnforced: true,
    concurrencySerialized: true,
    evidenceManifest: manifest,
    reproducibilityDocumented: true,
    externalActionsGated: true,
    thirdPartyLicensesPreserved: true,
    rollbackPlanPresent: true,
    noTechnicalOverclaim: true,
    humanGateActive: true,
  };
}

describe("quality gates and evidence manifest", () => {
  it("requires a full sha commit and marks incomplete manifests", () => {
    expect(() => createEvidenceManifest({ repository: "r", commit: "short" })).toThrow();
    const incomplete = createEvidenceManifest({ repository: "r", commit });
    const completeness = assessManifestCompleteness(incomplete);
    expect(completeness.complete).toBe(false);
    expect(completeness.missing).toContain("validation.status");
    expect(canClaimStable(incomplete)).toBe(false);
    // Una excepción solo cuenta si está documentada y una autoridad externa la verifica.
    expect(canClaimStable(incomplete, { exceptionId: "EX-1", approver: "h", rationale: "r", approvedAt: "2026-01-01T00:00:00Z", evidenceId: "e1" })).toBe(false);
    const exception = { exceptionId: "EX-1", approver: "h", rationale: "r", approvedAt: "2026-01-01T00:00:00Z", evidenceId: "e1" };
    expect(canClaimStable(incomplete, exception, (candidate) => candidate.approver === "h")).toBe(true);
  });

  it("passes all 15 gates when inputs are satisfied", () => {
    const report = evaluateQualityGates(fullInput());
    expect(report.passed).toBe(true);
    expect(report.results).toHaveLength(15);
    expect(report.invariantPreserved).toBe(true);
  });

  it("blocks promotion when a gate fails", () => {
    const report = evaluateQualityGates({ ...fullInput(), tenantIsolationEnforced: false });
    expect(report.passed).toBe(false);
    expect(report.blockers).toContain("tenant");
  });
});
