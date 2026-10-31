import { describe, expect, it } from "vitest";
import { expertFamily, IGE_EXPERT_COUNT, IGE_HEAD_COUNT, routeGenesisExperts } from "../../src/cognition/genesis-moe";

const input = {
  requestId: "req-1",
  headScores: Array.from({ length: IGE_HEAD_COUNT }, (_, i) => i),
  expertScores: Array.from({ length: IGE_EXPERT_COUNT }, (_, i) => i),
};

describe("Genesis MoE routing contract", () => {
  it("selects stable top heads and experts with normalized weights", () => {
    const result = routeGenesisExperts(input);
    expect(result.activeHeads).toEqual([11, 10, 9, 8]);
    expect(result.activeExperts).toEqual([23, 22, 21, 20]);
    expect(result.weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    expect(result.expertFamilies).toEqual(["metacognitive", "metacognitive", "metacognitive", "metacognitive"]);
    expect(result.confidence).toBeGreaterThan(0);
  });
  it("uses deterministic index order to break ties", () => {
    const result = routeGenesisExperts({
      requestId: "tie", headScores: Array(IGE_HEAD_COUNT).fill(0),
      expertScores: Array(IGE_EXPERT_COUNT).fill(0), topHeads: 2, topK: 2,
    });
    expect(result.activeHeads).toEqual([0, 1]);
    expect(result.activeExperts).toEqual([0, 1]);
    expect(result.weights).toEqual([0.5, 0.5]);
  });
  it("rejects malformed score vectors and non-finite values", () => {
    expect(() => routeGenesisExperts({ ...input, headScores: [1] })).toThrow(/exactly 12/);
    const scores = [...input.expertScores]; scores[3] = Number.NaN;
    expect(() => routeGenesisExperts({ ...input, expertScores: scores })).toThrow(/finite numbers/);
  });
  it("enforces top-K and expert family boundaries", () => {
    expect(() => routeGenesisExperts({ ...input, topK: 5 })).toThrow(/topK/);
    expect(expertFamily(0)).toBe("thematic");
    expect(expertFamily(6)).toBe("functional");
    expect(expertFamily(12)).toBe("ethical");
    expect(expertFamily(18)).toBe("metacognitive");
    expect(() => expertFamily(24)).toThrow(/expert index/);
  });
});
