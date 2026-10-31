import { describe, expect, it } from "vitest";
import { runResearchCycle, type ResearchHypothesis } from "../../src/omega/research";

function hypothesis(overrides: Partial<ResearchHypothesis> & { id: string }): ResearchHypothesis {
  return {
    statement: `hipótesis ${overrides.id}`,
    novelty: 0.5,
    feasibility: 0.5,
    evidence: 0.5,
    risk: 0.5,
    ...overrides,
  };
}

describe("Ω∞-21 Autonomous Research Engine", () => {
  it("1. hipótesis fuerte → pursue, stage rank y selección", () => {
    const result = runResearchCycle([
      hypothesis({ id: "strong", novelty: 1, feasibility: 1, evidence: 1, risk: 0 }),
    ]);
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0]).toEqual({
      id: "strong",
      statement: "hipótesis strong",
      score: 1,
      stage: "rank",
      recommendation: "pursue",
    });
    expect(result.selectedId).toBe("strong");
  });

  it("2. evidencia baja → gather_evidence, stage verify y no se selecciona", () => {
    const result = runResearchCycle([
      hypothesis({ id: "thin", novelty: 1, feasibility: 1, evidence: 0.2, risk: 0 }),
    ]);
    expect(result.evaluations[0]?.recommendation).toBe("gather_evidence");
    expect(result.evaluations[0]?.stage).toBe("verify");
    expect(result.evaluations[0]?.score).toBe(0.76);
    expect(result.selectedId).toBeNull();
  });

  it("3. score bajo con evidencia suficiente → reject, stage forecast", () => {
    const result = runResearchCycle([
      hypothesis({ id: "weak", novelty: 0.1, feasibility: 0.1, evidence: 0.6, risk: 0.9 }),
    ]);
    expect(result.evaluations[0]).toEqual({
      id: "weak",
      statement: "hipótesis weak",
      score: 0.25,
      stage: "forecast",
      recommendation: "reject",
    });
    expect(result.selectedId).toBeNull();
  });

  it("4. score = combinación ponderada redondeada a 4 decimales", () => {
    const result = runResearchCycle([
      hypothesis({ id: "round", novelty: 1 / 3, feasibility: 0.25, evidence: 0.25, risk: 0.125 }),
    ]);
    expect(result.evaluations[0]?.score).toBe(0.3375);
  });

  it("5. el umbral de evidencia controla la transición pursue → gather_evidence", () => {
    const hypotheses = [
      hypothesis({ id: "alpha", novelty: 0.9, feasibility: 0.9, evidence: 0.9, risk: 0.1 }),
      hypothesis({ id: "bravo", novelty: 0.4, feasibility: 0.5, evidence: 0.6, risk: 0.3 }),
    ];
    expect(runResearchCycle(hypotheses).evaluations.map((e) => e.recommendation)).toEqual([
      "pursue",
      "pursue",
    ]);
    const strict = runResearchCycle(hypotheses, { evidenceThreshold: 0.8 });
    expect(strict.evaluations.find((e) => e.id === "bravo")?.recommendation).toBe("gather_evidence");
    expect(strict.evaluations.find((e) => e.id === "alpha")?.recommendation).toBe("pursue");
    expect(strict.selectedId).toBe("alpha");
  });

  it("6. selecciona el pursue de mayor score (falla cerrado ante score alto sin evidencia)", () => {
    const result = runResearchCycle([
      hypothesis({ id: "delta", novelty: 1, feasibility: 1, evidence: 0.4, risk: 0 }),
      hypothesis({ id: "alpha", novelty: 0.6, feasibility: 0.6, evidence: 0.8, risk: 0.3 }),
      hypothesis({ id: "bravo", novelty: 0.4, feasibility: 0.4, evidence: 0.9, risk: 0.2 }),
    ]);
    expect(result.evaluations[0]?.id).toBe("delta");
    expect(result.evaluations[0]?.score).toBe(0.82);
    expect(result.evaluations[0]?.recommendation).toBe("gather_evidence");
    expect(result.selectedId).toBe("alpha");
  });

  it("6b. empate de score entre pursues se resuelve por id ascendente", () => {
    const result = runResearchCycle([
      hypothesis({ id: "tie-b", novelty: 0.5, feasibility: 0.5, evidence: 0.5, risk: 0.5 }),
      hypothesis({ id: "tie-a", novelty: 0.5, feasibility: 0.5, evidence: 0.5, risk: 0.5 }),
    ]);
    expect(result.evaluations.map((e) => e.id)).toEqual(["tie-a", "tie-b"]);
    expect(result.selectedId).toBe("tie-a");
  });

  it("7. valida factores, ids duplicados y umbral", () => {
    expect(() => runResearchCycle([hypothesis({ id: "n", novelty: 1.5 })])).toThrow(
      "RESEARCH_FACTOR_OUT_OF_RANGE",
    );
    expect(() => runResearchCycle([hypothesis({ id: "n", feasibility: -0.1 })])).toThrow(
      "RESEARCH_FACTOR_OUT_OF_RANGE",
    );
    expect(() => runResearchCycle([hypothesis({ id: "n", evidence: Number.NaN })])).toThrow(
      "RESEARCH_FACTOR_OUT_OF_RANGE",
    );
    expect(() => runResearchCycle([hypothesis({ id: "n", risk: Number.POSITIVE_INFINITY })])).toThrow(
      "RESEARCH_FACTOR_OUT_OF_RANGE",
    );
    expect(() =>
      runResearchCycle([hypothesis({ id: "dup" }), hypothesis({ id: "dup" })]),
    ).toThrow("RESEARCH_DUPLICATE_ID");
    expect(() => runResearchCycle([], { evidenceThreshold: 1.2 })).toThrow(
      "RESEARCH_THRESHOLD_OUT_OF_RANGE",
    );
    expect(() => runResearchCycle([], { evidenceThreshold: -0.5 })).toThrow(
      "RESEARCH_THRESHOLD_OUT_OF_RANGE",
    );
    expect(() => runResearchCycle([], { evidenceThreshold: Number.NaN })).toThrow(
      "RESEARCH_THRESHOLD_OUT_OF_RANGE",
    );
  });

  it("8. orden determinista de evaluations: score desc y luego id asc", () => {
    const hypotheses = [
      hypothesis({ id: "c-low", novelty: 0.2, feasibility: 0.2, evidence: 0.6, risk: 0.8 }),
      hypothesis({ id: "b-tie", novelty: 0.5, feasibility: 0.5, evidence: 0.5, risk: 0.5 }),
      hypothesis({ id: "a-tie", novelty: 0.5, feasibility: 0.5, evidence: 0.5, risk: 0.5 }),
      hypothesis({ id: "d-high", novelty: 1, feasibility: 1, evidence: 1, risk: 0 }),
    ];
    const first = runResearchCycle(hypotheses);
    const second = runResearchCycle([...hypotheses].reverse());
    expect(first.evaluations.map((e) => e.id)).toEqual(["d-high", "a-tie", "b-tie", "c-low"]);
    expect(second.evaluations).toEqual(first.evaluations);
    expect(first.selectedId).toBe("d-high");
  });

  it("9. entrada vacía → sin evaluations y selectedId nulo", () => {
    expect(runResearchCycle([])).toEqual({ evaluations: [], selectedId: null });
  });
});
