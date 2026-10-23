import { describe, expect, it } from "vitest";
import { consensusLabel, deriveChecks, verifyCandidate } from "../../src/hypercore/veritas-omega";
import type { HyperCoreVerifierName, RiskClass } from "../../src/hypercore/types";

function passingCandidate(risk: RiskClass): Record<string, unknown> {
  return { safety: "pass", policy: "pass", security: "pass", factuality: "pass", evidence: [], financialExecution: false, __risk: risk };
}

describe("HyperCore Veritas Ω consensus", () => {
  it("approves when all considered verifiers pass", () => {
    for (const risk of ["low", "medium", "high", "critical"] as const) {
      const verdict = verifyCandidate({ checks: deriveChecks(passingCandidate(risk), risk), risk });
      expect(verdict.verdict).toBe("ALLOW");
      expect(verdict.approvals).toBeGreaterThanOrEqual(verdict.required);
    }
  });

  it("hard-fails on a safety verifier failure", () => {
    const verdict = verifyCandidate({ checks: deriveChecks({ ...passingCandidate("low"), safety: "fail" }, "low"), risk: "low" });
    expect(verdict.verdict).toBe("DENY");
    expect(verdict.failed).toContain("safety");
  });

  it("hard-fails on a financial side effect at high risk", () => {
    const verdict = verifyCandidate({
      checks: deriveChecks({ ...passingCandidate("high"), financialExecution: true }, "high"),
      risk: "high",
    });
    expect(verdict.verdict).toBe("DENY");
    expect(verdict.failed).toContain("financial");
  });

  it("escalates on a single missing approval", () => {
    const checks = [{ name: "safety" as const, passed: true }];
    const verdict = verifyCandidate({ checks, risk: "low" });
    expect(verdict.verdict).toBe("ESCALATE");
  });

  it("returns RETRY_SAFE when required verifiers are entirely absent", () => {
    const verdict = verifyCandidate({ checks: [], risk: "low" });
    expect(verdict.verdict).toBe("RETRY_SAFE");
  });

  it("labels consensus as approvals over checked verifiers", () => {
    const verdict = verifyCandidate({ checks: deriveChecks(passingCandidate("medium"), "medium"), risk: "medium" });
    const names: readonly HyperCoreVerifierName[] = ["safety", "policy", "security", "provenance", "factuality"];
    expect(verdict.checks.length).toBe(names.length);
    expect(consensusLabel(verdict)).toBe(`${verdict.approvals}/${verdict.checks.length}`);
  });
});
