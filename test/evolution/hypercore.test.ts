import { describe, expect, it } from "vitest";
import {
  decideHypercore,
  isActivationAllowed,
  modeForPressure,
} from "../../src/evolution/hypercore";

describe("evolution/hypercore", () => {
  it("mapea presión a modos CRUISE → BOOST → HYPERBOOST", () => {
    expect(modeForPressure(0.1)).toBe("CRUISE");
    expect(modeForPressure(0.6)).toBe("BOOST");
    expect(modeForPressure(0.95)).toBe("HYPERBOOST");
  });

  it("CRUISE nunca incluye especulación", () => {
    const d = decideHypercore("CRUISE", "LOW", 0.2);
    expect(d.governanceInvariant).toBe("PRESERVED");
    expect(d.activations).not.toContain("DRAFT_MODEL");
    expect(d.activations).not.toContain("EARLY_EXIT");
    expect(isActivationAllowed(d, "PREFIX_CACHE")).toBe(true);
  });

  it("BOOST uso permite draft/parallel/verifier pero no EARLY_EXIT", () => {
    const d = decideHypercore("BOOST", "MEDIUM", 0.7);
    expect(d.activations).toContain("DRAFT_MODEL");
    expect(d.activations).not.toContain("EARLY_EXIT");
  });

  it("HYPERBOOST con riesgo HIGH bloquea EARLY_EXIT (aceleración sin salto de gobernanza)", () => {
    const d = decideHypercore("HYPERBOOST", "HIGH", 0.98);
    expect(d.activations).not.toContain("EARLY_EXIT");
    expect(d.governanceInvariant).toBe("PRESERVED");
  });

  it("HYPERBOOST con riesgo NEGLIGIBLE admite EARLY_EXIT", () => {
    const d = decideHypercore("HYPERBOOST", "NEGLIGIBLE", 0.98);
    expect(d.activations).toContain("EARLY_EXIT");
  });

  it("la autoridad constitucional nunca cambia con el modo", () => {
    for (const mode of ["CRUISE", "BOOST", "HYPERBOOST"] as const) {
      expect(decideHypercore(mode, "CRITICAL", 1).governanceInvariant).toBe("PRESERVED");
    }
  });
});