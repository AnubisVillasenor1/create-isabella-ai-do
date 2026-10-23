import { describe, expect, it } from "vitest";
import { remediateRefusal } from "../../src/gifts/refusal-remediation";

describe("Regalo 6 — Remediación de Rechazos", () => {
  it("para ROJO explica por qué no y ofrece cómo sí (apelable)", () => {
    const remediation = remediateRefusal({ band: "RED", riskTier: "CRITICAL", reasons: ["DESTRUCTIVE"] });
    expect(remediation.blocked).toBe(true);
    expect(remediation.appealable).toBe(true);
    expect(remediation.steps.length).toBeGreaterThan(1);
    expect(remediation.safeAlternative).toBeTruthy();
    expect(remediation.steps.join(" ")).toContain("borrado");
  });

  it("para VERDE no bloquea y no exige alternativa", () => {
    const remediation = remediateRefusal({ band: "GREEN", riskTier: "LOW" });
    expect(remediation.blocked).toBe(false);
    expect(remediation.appealable).toBe(false);
  });

  it("rechaza contextos sin banda", () => {
    expect(() => remediateRefusal(undefined as never)).toThrow();
  });
});
