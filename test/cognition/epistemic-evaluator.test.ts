import { describe, expect, it } from "vitest";
import { evaluateEpistemicState, EPISTEMIC_LADDER_SPEC } from "../../src/cognition/epistemic-evaluator";

describe("IKES Epistemic Evaluator", () => {
  it("defines all 7 levels E0 through E6 in the canonical ladder", () => {
    const levels = ["E0", "E1", "E2", "E3", "E4", "E5", "E6"];
    for (const lvl of levels) {
      const step = EPISTEMIC_LADDER_SPEC[lvl];
      expect(step).toBeDefined();
      expect(step?.level).toBe(lvl);
      expect(step?.state).toBeDefined();
      expect(typeof step?.rank).toBe("number");
      expect(step?.description).toBeTruthy();
    }
  });

  it("evaluates E6_ESTABLISHED for canonical constitutional invariant text", () => {
    const evaluation = evaluateEpistemicState({
      input: "Confirma el Invariante Operativo: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE",
      evidenceSourceCount: 2,
      admitted: true,
      governancePassed: true,
    });
    expect(evaluation.level).toBe("E6");
    expect(evaluation.state).toBe("E6_ESTABLISHED");
    expect(evaluation.rank).toBe(6);
    expect(evaluation.criteriaMet.length).toBeGreaterThan(0);
  });

  it("evaluates E3_ACADEMICALLY_SUPPORTED when DOI / Zenodo citations exist", () => {
    const evaluation = evaluateEpistemicState({
      input: "Consulta el registro Zenodo DOI 10.5281/zenodo.20606361 del Nodo Cero",
      evidenceSourceCount: 1,
      admitted: true,
    });
    expect(evaluation.level).toBe("E3");
    expect(evaluation.state).toBe("E3_ACADEMICALLY_SUPPORTED");
    expect(evaluation.rank).toBe(3);
    expect(evaluation.ladder.find((l) => l.level === "E3")?.achieved).toBe(true);
  });

  it("evaluates E4_REPRODUCIBLE when computational hash chain verification is present", () => {
    const evaluation = evaluateEpistemicState({
      input: "Verifica la cadena hash de BookPI con SHA-256",
      hasReproducibleProof: true,
      evidenceSourceCount: 0,
      admitted: true,
    });
    expect(evaluation.level).toBe("E4");
    expect(evaluation.state).toBe("E4_REPRODUCIBLE");
    expect(evaluation.rank).toBe(4);
  });

  it("evaluates E2_CORROBORATED when 2 or more sources are present without DOI", () => {
    const evaluation = evaluateEpistemicState({
      input: "Consulta la altitud y clima de la montaña",
      evidenceSourceCount: 2,
      admitted: true,
    });
    expect(evaluation.level).toBe("E2");
    expect(evaluation.state).toBe("E2_CORROBORATED");
    expect(evaluation.rank).toBe(2);
  });

  it("evaluates E0_UNVERIFIED for arbitrary ungrounded text with no sources", () => {
    const evaluation = evaluateEpistemicState({
      input: "un invento sin fuentes ni registro",
      evidenceSourceCount: 0,
      admitted: true,
    });
    expect(evaluation.level).toBe("E0");
    expect(evaluation.state).toBe("E0_UNVERIFIED");
    expect(evaluation.rank).toBe(0);
  });

  it("produces deterministic audit hash and ladder step states", () => {
    const eval1 = evaluateEpistemicState({ input: "test query", evidenceSourceCount: 1 });
    const eval2 = evaluateEpistemicState({ input: "test query", evidenceSourceCount: 1 });
    expect(eval1.auditHash).toBe(eval2.auditHash);
    expect(eval1.ladder.length).toBe(7);
  });
});
