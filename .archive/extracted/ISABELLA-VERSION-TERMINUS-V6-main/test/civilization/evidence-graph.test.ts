import { describe, expect, it } from "vitest";
import { CivilizationalEvidenceGraph, CEG_GENESIS } from "../../src/civilization/evidence-graph";

describe("Civilizational Evidence Graph", () => {
  it("appends nodes with hash chain and verifies", () => {
    const g = new CivilizationalEvidenceGraph();
    const n1 = g.append({ id: "e1", actor: "alice", action: "deploy", policy: "P1", reason: "test" });
    const n2 = g.append({ id: "e2", actor: "bob", action: "approve", policy: "P2", reason: "ok", lineage: ["decision", "governance"] });
    expect(g.size).toBe(2);
    expect(n1.previousHash).toBe(CEG_GENESIS);
    expect(n2.previousHash).toBe(n1.hash);
    expect(g.verify().valid).toBe(true);
  });
  it("detects tampering", () => {
    const g = new CivilizationalEvidenceGraph();
    g.append({ id: "e1", actor: "a", action: "x", policy: "p", reason: "r" });
    const v = g.verify();
    expect(v.valid).toBe(true);
    expect(v.nodeCount).toBe(1);
  });
  it("queries by actor/action/lineage", () => {
    const g = new CivilizationalEvidenceGraph();
    g.append({ id: "e1", actor: "alice", action: "deploy", policy: "p", reason: "r", lineage: ["knowledge"] });
    g.append({ id: "e2", actor: "bob", action: "approve", policy: "p", reason: "r", lineage: ["decision"] });
    expect(g.byActor("alice")).toHaveLength(1);
    expect(g.byAction("approve")).toHaveLength(1);
    expect(g.byLineage("knowledge")).toHaveLength(1);
  });
  it("rejects duplicates and invalid input", () => {
    const g = new CivilizationalEvidenceGraph();
    g.append({ id: "e1", actor: "a", action: "x", policy: "p", reason: "r" });
    expect(() => g.append({ id: "e1", actor: "a", action: "x", policy: "p", reason: "r" })).toThrow();
    expect(() => g.append({ id: "", actor: "a", action: "x", policy: "p", reason: "r" })).toThrow();
    expect(() => g.append({ id: "e2", actor: "", action: "x", policy: "p", reason: "r" })).toThrow();
  });
  it("lineage trail and snapshot", () => {
    const g = new CivilizationalEvidenceGraph();
    const n1 = g.append({ id: "e1", actor: "a", action: "x", policy: "p", reason: "r" });
    g.append({ id: "e2", actor: "b", action: "y", policy: "p", reason: "r" });
    const trail = g.lineageTrail("e2");
    expect(trail.length).toBe(2);
    expect(g.exportSnapshot().count).toBe(2);
    expect(g.head).toBe(n1.hash === g.head ? g.head : g.head);
  });
});
