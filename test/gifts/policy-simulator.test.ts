import { describe, expect, it } from "vitest";
import { simulatePolicy } from "../../src/gifts/policy-simulator";

describe("Regalo 10 — Simulador de Política", () => {
  it("predice una política sana por defecto", () => {
    const simulation = simulatePolicy({}, [
      { band: "GREEN", count: 8 },
      { band: "YELLOW", count: 1 },
      { band: "RED", count: 1 },
    ]);
    expect(simulation.predictedBlockRate).toBeCloseTo(0.1, 4);
    expect(simulation.verdict).toBe("HEALTHY");
  });

  it("advierte riesgo constitucional si los ROJOS no se bloquean", () => {
    const simulation = simulatePolicy({ redAlwaysBlocked: false }, [{ band: "RED", count: 1 }]);
    expect(simulation.verdict).toBe("CONSTITUTIONAL_RISK");
    expect(simulation.warnings.length).toBeGreaterThan(0);
  });

  it("advierte demasiada restricción si bloquearía la mayoría", () => {
    const simulation = simulatePolicy({ yellowRequiresApproval: true }, [
      { band: "YELLOW", count: 6 },
      { band: "RED", count: 4 },
    ]);
    expect(simulation.verdict).toBe("TOO_RESTRICTIVE");
  });
});
