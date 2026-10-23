import { describe, expect, it } from "vitest";
import { planClarification } from "../../src/gifts/clarify-engine";

describe("Regalo 4 — Motor de Pregunta", () => {
  it("convierte la ambigüedad en UNA pregunta aclaratoria", () => {
    const plan = planClarification({ input: "hazlo" });
    expect(plan.needed).toBe(true);
    expect(plan.question).not.toBeNull();
    expect(plan.question?.slot).toBeDefined();
  });

  it("no deja callejón sin salida: siempre ofrece contexto requerido", () => {
    const plan = planClarification({ input: "genera un informe" });
    expect(plan.requiredSlots.length).toBeGreaterThan(0);
    expect(plan.alternatives.length + (plan.question ? 1 : 0)).toBeGreaterThan(0);
  });

  it("rechaza entradas vacías", () => {
    expect(() => planClarification({ input: "   " })).toThrow();
  });
});
