import { describe, expect, it } from "vitest";
import { createKnowledgeEntry, decidePreservation, runIkesPipeline } from "../src/memory/knowledge-entry";

const entry = createKnowledgeEntry({
  entityId: "entity-1",
  provenanceId: "source-1",
  claimIds: ["claim-1"],
  evidenceIds: ["evidence-1"],
});

describe("IKES release requirements", () => {
  it("preserves non-identical documents even when a duplicate label is supplied", () => {
    expect(decidePreservation("IDENTICAL_ARTIFACT")).toBe("ALLOW_DELETE");
    expect(decidePreservation("VERIFIED_DUPLICATE")).toBe("PRESERVE");
    expect(decidePreservation("LIKELY_UPDATE")).toBe("PRESERVE");
  });

  it("freezes nested knowledge entry arrays", () => {
    const mutable = ["claim-a"];
    const created = createKnowledgeEntry({ entityId: "freeze-test", provenanceId: "source", claimIds: mutable, sourceIds: ["source"], evidenceIds: ["evidence"] });
    mutable.push("claim-b");
    expect(created.claimIds).toEqual(["claim-a"]);
    expect(Object.isFrozen(created.claimIds)).toBe(true);
    expect(() => (created.claimIds as string[]).push("tamper")).toThrow();
  });


  it("blocks release when BookPI audit IDs are absent", () => {
    const result = runIkesPipeline({
      entry,
      sanitizationAdmitted: true,
      policyGateGranted: true,
      gitCommit: "a".repeat(40),
      indexed: true,
    });
    expect(result.released).toBe(false);
    expect(result.stages.find((stage) => stage.stage === "audit")?.ok).toBe(false);
    expect(result.stages.find((stage) => stage.stage === "release")?.ok).toBe(false);
  });

  it("releases only when audit, commit, evidence and index are all present", () => {
    const result = runIkesPipeline({
      entry,
      sanitizationAdmitted: true,
      policyGateGranted: true,
      auditIds: ["bookpi-event-1"],
      gitCommit: "a".repeat(40),
      indexed: true,
    });
    expect(result.released).toBe(true);
    expect(result.entry.auditIds).toEqual(["bookpi-event-1"]);
  });
});
