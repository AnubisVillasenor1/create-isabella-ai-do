import { describe, expect, it } from "vitest";
import {
  CONSTITUTION_ARTICLES,
  CONSTITUTIONAL_FLOW,
  civilizationalValue,
  evaluateConstitution,
  runHyperSimulation,
  valuateCapital,
  type ConstitutionalAssertion,
} from "../../src/omega";

function validAssertions(): ConstitutionalAssertion[] {
  const full: ConstitutionalAssertion = {
    stage: "constitution",
    identity: "operator:1",
    evidence: ["ev-1"],
    authority: "mandate:1",
    auditTrail: ["audit-1"],
    humanOverrideAvailable: true,
    economicJustification: "cost < benefit",
    territory: "RDM",
    explanation: "porque el mandato lo exige",
    recoveryPlan: "rollback",
    learningRecord: "crisis-1",
  };
  return [
    full,
    { stage: "policy" },
    { stage: "mandate" },
    { stage: "capability" },
    { stage: "execution" },
  ];
}

describe("Ω∞-15 Constitution Engine", () => {
  it("define 10 artículos y 5 etapas de flujo", () => {
    expect(CONSTITUTION_ARTICLES).toHaveLength(10);
    expect(CONSTITUTIONAL_FLOW).toEqual(["constitution", "policy", "mandate", "capability", "execution"]);
  });

  it("aprueba una propuesta completa que recorre el flujo", () => {
    const decision = evaluateConstitution(validAssertions(), () => "t");
    expect(decision.allowed).toBe(true);
    expect(decision.violations).toEqual([]);
    expect(decision.evaluated).toHaveLength(10);
  });

  it("falla cerrado cuando falta una etapa del flujo", () => {
    const decision = evaluateConstitution(validAssertions().slice(0, 4), () => "t");
    expect(decision.allowed).toBe(false);
    expect(decision.violations.some((v) => v.article === 1)).toBe(true);
  });

  it("detecta el orden invertido del flujo", () => {
    const decision = evaluateConstitution(validAssertions().reverse(), () => "t");
    expect(decision.allowed).toBe(false);
    expect(decision.violations.some((v) => v.article === 3)).toBe(true);
  });

  it("exige human override y trazabilidad de identidad", () => {
    const noOverride = validAssertions();
    (noOverride[0] as { humanOverrideAvailable?: boolean }).humanOverrideAvailable = false;
    expect(evaluateConstitution(noOverride, () => "t").violations.some((v) => v.article === 5)).toBe(true);

    const noIdentity = validAssertions();
    delete (noIdentity[0] as { identity?: string }).identity;
    expect(evaluateConstitution(noIdentity, () => "t").violations.some((v) => v.article === 1)).toBe(true);
  });

  it("rechaza una propuesta vacía", () => {
    expect(evaluateConstitution([], () => "t").allowed).toBe(false);
  });
});

describe("Ω∞-17 Hyper Simulation Fabric", () => {
  it("produce mejor, esperado y peor escenario", () => {
    const report = runHyperSimulation({ base: 100, volatility: 0.2, confidence: 0.9 });
    expect(report).toEqual({
      bestCase: 120,
      expectedCase: 100,
      worstCase: 80,
      confidence: 0.9,
      economicImpact: 0,
      socialImpact: 0,
      riskResidual: 0.2,
    });
  });

  it("reduce el riesgo residual con mitigación", () => {
    expect(runHyperSimulation({ base: 100, volatility: 0.2, confidence: 1, riskMitigation: 0.5 }).riskResidual).toBe(0.1);
  });

  it("rechaza entradas fuera de rango", () => {
    expect(() => runHyperSimulation({ base: 100, volatility: 2, confidence: 1 })).toThrow();
    expect(() => runHyperSimulation({ base: -1, volatility: 0.1, confidence: 1 })).toThrow();
  });
});

describe("Ω∞-20 Cognitive Capital Engine", () => {
  it("suma los componentes del capital", () => {
    const capital = valuateCapital({ utility: 10, trust: 20, demand: 30, evidence: 40, reputation: 50 });
    expect(capital.value).toBe(150);
    expect(capital.utility).toBe(10);
    expect(capital.reproducibility).toBe(50);
  });

  it("rechaza componentes fuera de [0,100]", () => {
    expect(() => valuateCapital({ utility: 200, trust: 0, demand: 0, evidence: 0, reputation: 0 })).toThrow();
  });
});

describe("Ω∞ Master Equation", () => {
  const one = {
    intelligence: 1,
    governance: 1,
    evidence: 1,
    trust: 1,
    economy: 1,
    memory: 1,
    resilience: 1,
    territorialImpact: 1,
  };

  it("multiplica los ocho factores", () => {
    expect(civilizationalValue(one).value).toBe(1);
    expect(civilizationalValue(one).zeroFactors).toEqual([]);
  });

  it("si un factor es cero, el valor civilizatorio es cero", () => {
    const result = civilizationalValue({ ...one, trust: 0 });
    expect(result.value).toBe(0);
    expect(result.zeroFactors).toEqual(["trust"]);
  });

  it("rechaza factores fuera de [0,1]", () => {
    expect(() => civilizationalValue({ ...one, trust: 2 })).toThrow();
  });
});
