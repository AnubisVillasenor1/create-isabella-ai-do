import { describe, expect, it } from "vitest";
import { assessManifestCompleteness, canClaimStable, createEvidenceManifest } from "../../src/governance/evidence-manifest";

const validSeed = {
  repository: "https://github.com/OsoPanda1/Isabella-Villase-or-GenesisAI",
  commit: "a".repeat(40),
  claimIds: ["claim-1"],
  sourceIds: ["source-1"],
  validation: { status: "passed" as const, tests: ["npm test"], lsp: ["tsc --noEmit"] },
  security: { secretScan: "passed" as const, dependencyScan: "passed" as const },
  policyDecision: "DEC-ALLOW-001",
  bookpiAuditIds: ["bookpi-event-1"],
  rollbackPlan: "revert commit aaaa",
  limitations: ["BookPI storage is volatile"],
};

describe("evidence manifest integrity", () => {
  it("changes identity when material evidence changes", () => {
    const first = createEvidenceManifest(validSeed);
    expect(first.manifestId).toMatch(/^EVM-[A-F0-9]{64}$/);
    const changedClaim = createEvidenceManifest({ ...validSeed, claimIds: ["claim-2"] });
    expect(first.manifestId).not.toBe(changedClaim.manifestId);
  });

  it("does not require timestamps to create different identities for the same manifest", () => {
    const first = createEvidenceManifest({ ...validSeed, createdAt: "2026-10-08T00:00:00.000Z" });
    const second = createEvidenceManifest({ ...validSeed, createdAt: "2026-10-09T00:00:00.000Z" });
    expect(first.manifestId).toBe(second.manifestId);
  });

  it("requires claims, sources and audit evidence before stable status", () => {
    const incomplete = createEvidenceManifest({
      ...validSeed, claimIds: [], sourceIds: [], bookpiAuditIds: [],
    });
    const result = assessManifestCompleteness(incomplete);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("claim_ids");
    expect(result.missing).toContain("source_ids");
    expect(result.missing).toContain("bookpi_audit_ids");
    expect(canClaimStable(incomplete)).toBe(false);
  });

  it("requires an external verifier for a documented exception", () => {
    const incomplete = createEvidenceManifest({ ...validSeed, claimIds: [] });
    const exception = {
      exceptionId: "EX-001",
      approver: "security-reviewer",
      rationale: "Temporary controlled release",
      approvedAt: "2026-10-08T12:00:00.000Z",
      evidenceId: "approval-record-1",
    };
    expect(canClaimStable(incomplete, exception)).toBe(false);
    expect(canClaimStable(incomplete, exception, () => false)).toBe(false);
    expect(canClaimStable(incomplete, exception, () => true)).toBe(true);
  });
});
