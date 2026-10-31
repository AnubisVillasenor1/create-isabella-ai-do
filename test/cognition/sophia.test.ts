import { describe, expect, it } from "vitest";
import { assessEpistemicState, passesEriGate, ERI_THRESHOLD, SOPHIA_LEVELS } from "../../src/cognition/sophia";

describe("SOPHIA epistemic engine", () => {
  it("declares the 5 canonical levels and the ERI threshold", () => {
    expect(SOPHIA_LEVELS).toEqual(["E0_AXIOM", "E1_VERIFIED", "E2_INFERRED", "E3_HYPOTHETICAL", "E4_UNFOUNDED"]);
    expect(ERI_THRESHOLD).toBe(95);
  });

  it("only reaches E0 with a declared axiom and high ERI", () => {
    const axiom = assessEpistemicState({
      corroboratingSources: 5,
      unsupportedClaims: 0,
      contradictions: 0,
      reproducibility: 1,
      methodDeclared: true,
      declaredAxiom: true,
    });
    expect(axiom.level).toBe("E0_AXIOM");
    expect(axiom.eri).toBeGreaterThanOrEqual(ERI_THRESHOLD);
  });

  it("classifies verified, inferred and unfounded states deterministically", () => {
    const verified = assessEpistemicState({
      corroboratingSources: 3, unsupportedClaims: 0, contradictions: 0, reproducibility: 1, methodDeclared: true,
    });
    expect(verified.level).toBe("E1_VERIFIED");

    const inferred = assessEpistemicState({
      corroboratingSources: 1, unsupportedClaims: 0, contradictions: 0, reproducibility: 0.3, methodDeclared: true,
    });
    expect(inferred.level).toBe("E2_INFERRED");

    const unfounded = assessEpistemicState({
      corroboratingSources: 0, unsupportedClaims: 3, contradictions: 2, reproducibility: 0, methodDeclared: false,
    });
    expect(unfounded.level).toBe("E4_UNFOUNDED");
  });

  it("never elevates above E3 without corroboration", () => {
    const hypothesis = assessEpistemicState({
      corroboratingSources: 0, unsupportedClaims: 0, contradictions: 0, reproducibility: 0.9, methodDeclared: true,
    });
    expect(hypothesis.level).toBe("E3_HYPOTHETICAL");
    expect(passesEriGate(hypothesis)).toBe(false);
  });
});
