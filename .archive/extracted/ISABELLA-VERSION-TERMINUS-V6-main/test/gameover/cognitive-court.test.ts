import { describe, expect, it } from "vitest";
import { adjudicate } from "../../src/gameover/cognitive-court";

describe("GAME OVER CognitiveCourt", () => {
  it("rejects on ethics violation regardless of trust", () => {
    const verdict = adjudicate({ ethicsPassed: false, riskLevel: "LOW", trustScore: 100 });
    expect(verdict.outcome).toBe("REJECT");
    expect(verdict.rationale).toContain("ETHICS_VIOLATION");
  });

  it("escalates critical risk below the critical trust floor", () => {
    const verdict = adjudicate({ ethicsPassed: true, riskLevel: "CRITICAL", trustScore: 80 });
    expect(verdict.outcome).toBe("ESCALATE");
    expect(verdict.rationale).toContain("CRITICAL_RISK_LOW_TRUST");
  });

  it("rejects high risk below the high-risk trust floor", () => {
    const verdict = adjudicate({ ethicsPassed: true, riskLevel: "HIGH", trustScore: 65 });
    expect(verdict.outcome).toBe("REJECT");
    expect(verdict.rationale).toContain("HIGH_RISK_INSUFFICIENT_TRUST");
  });

  it("accepts high risk at or above the floor", () => {
    const verdict = adjudicate({ ethicsPassed: true, riskLevel: "HIGH", trustScore: 70 });
    expect(verdict.outcome).toBe("ACCEPT");
  });

  it("accepts critical risk at or above the critical floor", () => {
    const verdict = adjudicate({ ethicsPassed: true, riskLevel: "CRITICAL", trustScore: 85 });
    expect(verdict.outcome).toBe("ACCEPT");
  });
});
