import { describe, expect, it } from "vitest";
import { computeCee } from "../../src/hypercore/cee";

const full = {
  taskSuccess: 1,
  evidenceQuality: 1,
  decisionAccuracy: 1,
  userValue: 1,
  reuseValue: 1,
  riskReduction: 1,
};

describe("HyperCore Cognitive Energy Efficiency", () => {
  it("computes value per unit of energy", () => {
    const result = computeCee({ ...full, energyKwh: 0.001 });
    expect(result.weightedValue).toBeCloseTo(1);
    expect(result.cee).toBeCloseTo(1000);
  });

  it("reports zero CEE when no energy is spent", () => {
    const result = computeCee({ ...full, energyKwh: 0 });
    expect(result.cee).toBe(0);
  });

  it("clamps components into the unit interval", () => {
    const result = computeCee({ ...full, taskSuccess: 9, energyKwh: 0.001 });
    expect(result.components.taskSuccess).toBe(1);
  });

  it("honours declared weights", () => {
    const result = computeCee({ ...full, energyKwh: 0.001 }, [0, 0, 0, 0, 0, 1]);
    expect(result.weightedValue).toBeCloseTo(1);
  });
});
