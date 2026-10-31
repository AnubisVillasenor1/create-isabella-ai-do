import { describe, expect, it } from "vitest";
import {
  buildSovereignResponse,
  validateSovereignResponse,
} from "../../src/civilization/contract";

function sample() {
  return buildSovereignResponse({
    answer: "Ciclo gobernado de prueba.",
    confidence: 0.7,
    reasoningPath: ["sovereign-kernel:EXECUTED"],
    usedKnowledgeDomains: ["TAMV"],
    evidence: ["integrity:abc"],
    simulation: null,
    evolution: null,
    policy: { decision: "ALLOW", band: "GREEN", policyVersion: "test", authorityPath: "FULL" },
  });
}

describe("ISABELLA Ω · CCR-1 — contrato soberano", () => {
  it("construye una respuesta congelada que no autoriza ni ejecuta", () => {
    const response = sample();
    expect(response.authorityPath).toBe("FULL");
    expect(response.authorizationPerformed).toBe(false);
    expect(response.executionPerformed).toBe(false);
    expect(Object.isFrozen(response)).toBe(true);
    expect(response.bookpiHash).toHaveLength(64);
  });

  it("acepta una respuesta válida", () => {
    const validation = validateSovereignResponse(sample());
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("rechaza intentos de declarar autorización o ejecución", () => {
    const forged = { ...sample(), authorizationPerformed: true, executionPerformed: true };
    const validation = validateSovereignResponse(forged);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("SOVEREIGN_MUST_NOT_AUTHORIZE");
    expect(validation.errors).toContain("SOVEREIGN_MUST_NOT_EXECUTE");
  });

  it("exige authorityPath FULL", () => {
    const forged = { ...sample(), authorityPath: "PARTIAL" };
    const validation = validateSovereignResponse(forged);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("SOVEREIGN_AUTHORITY_PATH_MUST_BE_FULL");
  });

  it("falla cerrado sin respuesta y acota la confianza a [0,1]", () => {
    expect(() =>
      buildSovereignResponse({
        answer: "   ",
        confidence: 0.5,
        reasoningPath: [],
        usedKnowledgeDomains: [],
        evidence: [],
        policy: { decision: "ALLOW", band: "GREEN", policyVersion: "test", authorityPath: "FULL" },
      }),
    ).toThrow(/SOVEREIGN_ANSWER_REQUIRED/);

    const high = buildSovereignResponse({
      answer: "x",
      confidence: 5,
      reasoningPath: [],
      usedKnowledgeDomains: [],
      evidence: [],
      policy: { decision: "ALLOW", band: "GREEN", policyVersion: "test", authorityPath: "FULL" },
    });
    expect(high.confidence).toBe(1);
  });

  it("rechaza valores no objetos", () => {
    expect(validateSovereignResponse(null).valid).toBe(false);
    expect(validateSovereignResponse("nope").errors).toContain("SOVEREIGN_RESPONSE_NOT_OBJECT");
  });
});
