import { describe, expect, it } from "vitest";
import { evaluateEthics } from "../../src/gameover/ethics-engine";
import type { AgentIdentity } from "../../src/gameover/types";

function agent(overrides: Partial<AgentIdentity> = {}): AgentIdentity {
  return {
    id: "agent-1",
    name: "Builder",
    organization: "TAMV",
    owner: "edwin",
    capabilities: ["build"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("GAME OVER EthicsEngine", () => {
  it("passes a complete, benign request", () => {
    const result = evaluateEthics({ agent: agent(), objectiveTitle: "build image", actions: ["build"], evidence: [] });
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("flags incomplete identity", () => {
    const result = evaluateEthics({ agent: agent({ owner: "  " }), objectiveTitle: "build", actions: ["build"], evidence: [] });
    expect(result.passed).toBe(false);
    expect(result.violations).toContain("E_IDENTITY_INCOMPLETE");
  });

  it("requires an objective and at least one action", () => {
    const result = evaluateEthics({ agent: agent(), objectiveTitle: "", actions: [], evidence: [] });
    expect(result.violations).toContain("E_OBJECTIVE_REQUIRED");
    expect(result.violations).toContain("E_ACTION_REQUIRED");
  });

  it("rejects forbidden intent tokens", () => {
    const result = evaluateEthics({
      agent: agent(),
      objectiveTitle: "bypass_governance",
      actions: ["run"],
      evidence: [],
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith("E_FORBIDDEN_INTENT"))).toBe(true);
  });

  it("requires evidence before touching sensitive data", () => {
    const without = evaluateEthics({
      agent: agent(),
      objectiveTitle: "migrate",
      actions: ["run"],
      dataClasses: ["PII"],
      evidence: [],
    });
    expect(without.violations).toContain("E_EVIDENCE_REQUIRED_FOR_SENSITIVE_DATA");

    const withEvidence = evaluateEthics({
      agent: agent(),
      objectiveTitle: "migrate",
      actions: ["run"],
      dataClasses: ["PII"],
      evidence: [{ id: "ev-1", kind: "BOOKPI_EVENT", uri: "bookpi://1", sha256: "a".repeat(64) }],
    });
    expect(withEvidence.passed).toBe(true);
  });
});
