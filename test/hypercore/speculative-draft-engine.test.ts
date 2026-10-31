import { describe, expect, it } from "vitest";
import { createDraft, estimateSpeedup } from "../../src/hypercore/speculative-draft-engine";

describe("HyperCore Speculative Draft Engine", () => {
  it("models declared speedup from acceptance rate and draft tokens", () => {
    expect(estimateSpeedup(0, 4)).toBeCloseTo(1);
    expect(estimateSpeedup(1, 4)).toBeCloseTo(4);
    expect(estimateSpeedup(0.78, 4)).toBeGreaterThan(1);
  });

  it("pins finalized to false: a draft is never final", () => {
    const draft = createDraft({ safety: "pass" });
    expect(draft.finalized).toBe(false);
    expect(draft.candidate).toEqual({ safety: "pass" });
    expect(draft.estimatedSpeedup).toBeGreaterThan(1);
  });

  it("clamps out-of-range configuration", () => {
    const draft = createDraft({}, { acceptanceRate: 5, draftTokens: 0 });
    expect(draft.acceptanceRate).toBe(1);
    expect(draft.draftTokens).toBe(1);
  });
});
