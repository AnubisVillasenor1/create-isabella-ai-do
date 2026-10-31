import { describe, expect, it } from "vitest";
import { EXPERT_REGISTRY, GENESIS_EXPERTS, planExperts } from "../../src/cognition/experts";
describe("Genesis experts",()=>{
  it("registers the canonical 24 expert modules as descriptors",()=>{expect(GENESIS_EXPERTS).toHaveLength(24); expect(EXPERT_REGISTRY).toHaveLength(24);});
  it("preserves the full authority path for parallel plans",()=>{const plan=planExperts(["E01_SECURITY","E16_TRANSPARENCY","E22_MEMORY_RAG"]); expect(plan.parallelizable).toBe(true); expect(plan.authorityPath).toBe("FULL");});
});