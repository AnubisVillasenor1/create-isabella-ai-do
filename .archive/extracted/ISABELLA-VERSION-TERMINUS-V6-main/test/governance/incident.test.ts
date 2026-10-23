import { describe, expect, it } from "vitest";
import { Incident, classifyIncident, type IncidentSignals } from "../../src/governance/incident";

/** state: draft | engine-generated */
const none: IncidentSignals = { personalDataExposed: false, integrityCompromised: false, activeExploitation: false, availabilityImpactPct: 0, affectedSubjects: 0, privilegedCredentialsExposed: false };
const H = 3_600_000;

describe("classifyIncident", () => {
  it("maps signals to S0..S3", () => {
    expect(classifyIncident(none)).toBe("S3");
    expect(classifyIncident({ ...none, affectedSubjects: 3 })).toBe("S2");
    expect(classifyIncident({ ...none, availabilityImpactPct: 5 })).toBe("S2");
    expect(classifyIncident({ ...none, personalDataExposed: true })).toBe("S1");
    expect(classifyIncident({ ...none, availabilityImpactPct: 30 })).toBe("S1");
    expect(classifyIncident({ ...none, privilegedCredentialsExposed: true })).toBe("S0");
    expect(classifyIncident({ ...none, activeExploitation: true, personalDataExposed: true })).toBe("S0");
    expect(classifyIncident({ ...none, availabilityImpactPct: 80 })).toBe("S0");
  });
  it("rejects invalid signals", () => {
    expect(() => classifyIncident({ ...none, availabilityImpactPct: 101 })).toThrow();
    expect(() => classifyIncident({ ...none, availabilityImpactPct: Number.NaN })).toThrow();
    expect(() => classifyIncident({ ...none, affectedSubjects: -1 })).toThrow();
  });
});

describe("Incident", () => {
  it("walks the response flow in order and hash-chains the timeline", () => {
    const i = new Incident("inc-1", "S0", 0, "oncall");
    i.advance("TRIAGED", "oncall", "triaged", 10);
    i.advance("CONTAINED", "oncall", "isolated", 20);
    i.advance("ERADICATED", "sec", "patched", 30);
    i.advance("RECOVERED", "ops", "restored", 40);
    i.advance("CLOSED", "lead", "post-mortem PM-1", 50);
    expect(i.state).toBe("CLOSED");
    expect(i.timeline()).toHaveLength(6);
    expect(i.verifyTimeline()).toBe(true);
    expect(() => i.advance("TRIAGED", "x", "n")).toThrow("illegal transition");
  });
  it("forbids skipping states and blank actors/post-mortems", () => {
    const i = new Incident("inc-2", "S1", 0, "a");
    expect(() => i.advance("CONTAINED", "a", "skip")).toThrow("illegal transition");
    expect(() => i.advance("TRIAGED", " ", "n")).toThrow("actor");
    i.advance("TRIAGED", "a", "t");
    i.advance("CONTAINED", "a", "c");
    i.advance("ERADICATED", "a", "e");
    i.advance("RECOVERED", "a", "r");
    expect(() => i.advance("CLOSED", "a", "  ")).toThrow("post-mortem");
  });
  it("tracks S0 deadlines (contain 1h, notify 24h)", () => {
    const i = new Incident("inc-3", "S0", 0, "a");
    expect(i.deadlines(30 * 60_000)).toMatchObject({ containOverdue: false, notifyOverdue: false });
    expect(i.deadlines(1 * H + 1).containOverdue).toBe(true);
    i.advance("TRIAGED", "a", "t", 10);
    i.advance("CONTAINED", "a", "c", 50 * 60_000);
    expect(i.deadlines(5 * H).containOverdue).toBe(false);
    expect(i.deadlines(25 * H).notifyOverdue).toBe(true);
    i.recordNotification(20 * H);
    expect(i.deadlines(100 * H).notifyOverdue).toBe(false);
  });
  it("S2 has no notify deadline and S3 none at all", () => {
    expect(new Incident("a", "S2", 0, "x").deadlines(1000 * H)).toMatchObject({ containOverdue: true, notifyOverdue: false, notifyDueAt: null });
    expect(new Incident("b", "S3", 0, "x").deadlines(1000 * H)).toMatchObject({ containOverdue: false, containDueAt: null });
  });
});
