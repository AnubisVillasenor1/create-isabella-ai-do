import { describe, expect, it } from "vitest";
import { CognitiveImmuneSystem } from "../../src/ihec/immune-system";

describe("IHEC Cognitive Immune System", () => {
  it("reports and resolves crises with antibodies", () => {
    const sys = new CognitiveImmuneSystem();
    const c = sys.reportIncident({ incident: "db-timeout", severity: "high", patterns: ["timeout"] });
    expect(sys.openCrises()).toHaveLength(1);
    const resolved = sys.resolve(c.id, "restart pool", ["add retry"]);
    expect(resolved.resolvedAt).toBeDefined();
    expect(sys.hasAntibody("db-timeout")).toBe(true);
    expect(sys.getAntibody("db-timeout")).toContain("antibody");
  });
  it("self-heals with antibody", () => {
    const sys = new CognitiveImmuneSystem();
    const c = sys.reportIncident({ incident: "x", severity: "medium" });
    sys.resolve(c.id, "fixed");
    expect(sys.selfHeal(c.id).healed).toBe(true);
  });
  it("assesses threats", () => {
    const sys = new CognitiveImmuneSystem();
    const a = sys.assess("intrusion", { anomalyScore: 0.9, blastRadius: 0.8, recurrence: 0.7 });
    expect(a.severity).toBe("critical");
    expect(a.recommendedAction).toBe("escalate");
    const b = sys.assess("noise", { anomalyScore: 0.1, blastRadius: 0.1, recurrence: 0.1 });
    expect(b.recommendedAction).toBe("monitor");
  });
  it("mutates and adapts", () => {
    const sys = new CognitiveImmuneSystem();
    const c = sys.reportIncident({ incident: "y", severity: "low" });
    const m = sys.mutate(c.id, "new-pattern");
    expect(m.patterns).toContain("new-pattern");
    expect(sys.adapt(0.5).adapted).toBe(true);
    expect(sys.stats().total).toBe(1);
  });
  it("validates input", () => {
    const sys = new CognitiveImmuneSystem();
    expect(() => sys.reportIncident({ incident: "", severity: "low" })).toThrow();
    expect(() => sys.resolve("nope", "pm")).toThrow();
    expect(() => sys.assess("", { anomalyScore: 0, blastRadius: 0, recurrence: 0 })).toThrow();
    expect(() => sys.adapt(2)).toThrow();
  });
  it("crisis memory", () => {
    const sys = new CognitiveImmuneSystem();
    sys.reportIncident({ incident: "z", severity: "low" });
    expect(sys.crisisMemory()).toHaveLength(1);
  });
});
