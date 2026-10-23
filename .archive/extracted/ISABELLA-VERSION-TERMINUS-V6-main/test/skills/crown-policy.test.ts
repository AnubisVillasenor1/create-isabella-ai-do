import { describe, expect, it } from "vitest";
import { evaluateCrownPolicy, type SkillContract } from "../../src/skills";

function contract(overrides: Partial<SkillContract> = {}): SkillContract {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    authority: { requiredScopes: ["exec:run"], requiresStepUp: false, requiresQuorum: false },
    evidencePolicy: { required: false, piiRedaction: false, retentionDays: 1 },
    limits: { maxLatencyMs: 1000, maxMemoryMb: 64, maxCallsPerMinute: 3, maxEnergyUnits: 10 },
    rollback: { supported: false, strategy: "none" },
    ...overrides,
  };
}

describe("CROWN policy adapter", () => {
  it("DENIES when a required scope is missing", () => {
    const decision = evaluateCrownPolicy({ contract: contract(), riskTier: "LOW", grantedScopes: [], approvalProvided: false, callsThisWindow: 0 });
    expect(decision.verdict).toBe("DENY");
    expect(decision.missingScopes).toEqual(["exec:run"]);
  });

  it("ESCALATES high-risk skills without approval", () => {
    const decision = evaluateCrownPolicy({ contract: contract(), riskTier: "HIGH", grantedScopes: ["exec:run"], approvalProvided: false, callsThisWindow: 0 });
    expect(decision.verdict).toBe("ESCALATE");
  });

  it("ESCALATES step-up contracts without approval", () => {
    const stepped = contract({ authority: { requiredScopes: ["exec:run"], requiresStepUp: true, requiresQuorum: false } });
    const decision = evaluateCrownPolicy({ contract: stepped, riskTier: "LOW", grantedScopes: ["exec:run"], approvalProvided: false, callsThisWindow: 0 });
    expect(decision.verdict).toBe("ESCALATE");
  });

  it("ALLOWS a low-risk, scoped, approved call", () => {
    const decision = evaluateCrownPolicy({ contract: contract(), riskTier: "LOW", grantedScopes: ["exec:run"], approvalProvided: false, callsThisWindow: 0 });
    expect(decision.verdict).toBe("ALLOW");
  });

  it("DEGRADES when the per-minute call budget is exhausted", () => {
    const decision = evaluateCrownPolicy({ contract: contract(), riskTier: "LOW", grantedScopes: ["exec:run"], approvalProvided: false, callsThisWindow: 3 });
    expect(decision.verdict).toBe("DEGRADE");
  });
});
