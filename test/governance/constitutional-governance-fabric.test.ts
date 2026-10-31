import { describe, expect, it } from "vitest";
import { ConstitutionalGovernanceFabric } from "../../src/governance/constitutional-governance-fabric";

describe("Constitutional Governance Fabric (CGF)", () => {
  it("allows low-risk approved actions with evidence", () => {
    const cgf = new ConstitutionalGovernanceFabric();
    const d = cgf.evaluate({ actor: "alice", action: "read", resource: "doc", riskScore: 0.1, policyAllowed: true, approvalGranted: true, evidencePresent: true });
    expect(d.decision).toBe("allow");
  });
  it("denies when policy denied or evidence missing", () => {
    const cgf = new ConstitutionalGovernanceFabric();
    const d1 = cgf.evaluate({ actor: "a", action: "x", resource: "r", riskScore: 0.1, policyAllowed: false, approvalGranted: true, evidencePresent: true });
    expect(d1.decision).toBe("deny");
    const d2 = cgf.evaluate({ actor: "a", action: "x", resource: "r", riskScore: 0.1, policyAllowed: true, approvalGranted: true, evidencePresent: false });
    expect(d2.decision).toBe("deny");
  });
  it("escalates high risk", () => {
    const cgf = new ConstitutionalGovernanceFabric();
    const d = cgf.evaluate({ actor: "a", action: "x", resource: "r", riskScore: 0.9, policyAllowed: true, approvalGranted: true, evidencePresent: true });
    expect(d.decision).toBe("escalate");
  });
  it("queries and stats", () => {
    const cgf = new ConstitutionalGovernanceFabric();
    cgf.evaluate({ actor: "alice", action: "x", resource: "r", riskScore: 0.1, policyAllowed: true, approvalGranted: true, evidencePresent: true });
    expect(cgf.byActor("alice")).toHaveLength(1);
    expect(cgf.stats().total).toBe(1);
    expect(cgf.listDossiers()).toHaveLength(1);
  });
  it("validates input", () => {
    const cgf = new ConstitutionalGovernanceFabric();
    expect(() => cgf.evaluate({ actor: "", action: "x", resource: "r", riskScore: 0.1, policyAllowed: true, approvalGranted: true, evidencePresent: true })).toThrow();
    expect(() => cgf.evaluate({ actor: "a", action: "x", resource: "r", riskScore: 2, policyAllowed: true, approvalGranted: true, evidencePresent: true })).toThrow();
  });

  it("bounds the in-memory dossier cache without resetting sequence IDs", () => {
    const cgf = new ConstitutionalGovernanceFabric(2);
    const input = { actor: "a", action: "read", resource: "r", riskScore: 0.1, policyAllowed: true, approvalGranted: true, evidencePresent: true };
    const first = cgf.evaluate(input);
    cgf.evaluate(input);
    const third = cgf.evaluate(input);
    expect(cgf.listDossiers()).toHaveLength(2);
    expect(cgf.listDossiers().map((d) => d.id)).toEqual(["dossier-2", "dossier-3"]);
    expect(cgf.stats()).toEqual({ total: 3, allow: 3, deny: 0, escalate: 0 });
    expect(first.id).toBe("dossier-1");
    expect(third.id).toBe("dossier-3");
  });

  it("rejects invalid runtime flags and cache limits", () => {
    expect(() => new ConstitutionalGovernanceFabric(0)).toThrow();
    const cgf = new ConstitutionalGovernanceFabric();
    expect(() => cgf.evaluate({ actor: "a", action: "x", resource: "r", riskScore: 0.1, policyAllowed: "yes" as unknown as boolean, approvalGranted: true, evidencePresent: true })).toThrow();
    expect(() => cgf.evaluate({ actor: "a".repeat(257), action: "x", resource: "r", riskScore: 0.1, policyAllowed: true, approvalGranted: true, evidencePresent: true })).toThrow();
  });
});
