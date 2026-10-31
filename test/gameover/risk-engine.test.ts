import { describe, expect, it } from "vitest";
import { assessRisk } from "../../src/gameover/risk-engine";

describe("GAME OVER RiskEngine", () => {
  it("maps base criticality to a bounded risk level", () => {
    expect(assessRisk({ criticality: "LOW" }).score).toBe(0.1);
    expect(assessRisk({ criticality: "LOW" }).level).toBe("LOW");
    expect(assessRisk({ criticality: "MEDIUM" }).score).toBe(0.35);
    expect(assessRisk({ criticality: "HIGH" }).score).toBe(0.65);
    expect(assessRisk({ criticality: "CRITICAL" }).level).toBe("CRITICAL");
  });

  it("treats invalid runtime criticality as CRITICAL", () => {
    const risk = assessRisk({ criticality: "INVALID" as never });
    expect(risk.criticality).toBe("CRITICAL");
    expect(risk.level).toBe("CRITICAL");
  });

  it("defaults to MEDIUM criticality when unspecified", () => {
    const risk = assessRisk();
    expect(risk.criticality).toBe("MEDIUM");
    expect(risk.score).toBe(0.35);
  });

  it("adds a per-capability penalty", () => {
    expect(assessRisk({ criticality: "MEDIUM", capabilityCount: 1 }).score).toBe(0.43);
    expect(assessRisk({ criticality: "MEDIUM", capabilityCount: 2 }).score).toBe(0.51);
  });

  it("caps the capability penalty at 0.35 and clamps the score to 1", () => {
    const risk = assessRisk({ criticality: "HIGH", capabilityCount: 10 });
    expect(risk.score).toBe(1);
    expect(risk.level).toBe("CRITICAL");
  });

  it("never returns a negative or >1 score", () => {
    for (const criticality of ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const) {
      const risk = assessRisk({ criticality, capabilityCount: 999 });
      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThanOrEqual(1);
    }
  });
});
