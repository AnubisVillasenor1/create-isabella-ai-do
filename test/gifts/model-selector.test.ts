import { describe, expect, it } from "vitest";
import { selectModel, type ModelCandidate } from "../../src/gifts/model-selector";

const models: readonly ModelCandidate[] = [
  { id: "fast", latencyMs: 100, costPer1kTokens: 1, quality: 0.6 },
  { id: "smart", latencyMs: 900, costPer1kTokens: 5, quality: 0.95 },
  { id: "cheap", latencyMs: 300, costPer1kTokens: 0.2, quality: 0.5 },
];

describe("Regalo 8 — Selector de Modelo", () => {
  it("elige el mejor compromiso factible bajo restricciones", () => {
    const selection = selectModel(models, { maxLatencyMs: 500 });
    expect(selection.feasible).toBe(true);
    expect(selection.selected?.id).toBe("fast");
    expect(selection.ranked[0]?.feasible).toBe(true);
  });

  it("falla cerrado cuando no hay modelo factible", () => {
    const selection = selectModel(models, { maxLatencyMs: 50 });
    expect(selection.feasible).toBe(false);
    expect(selection.selected).toBeUndefined();
    expect(selection.reason).toBe("NO_FEASIBLE_MODEL");
  });

  it("rechaza candidatos inválidos", () => {
    expect(() => selectModel([{ id: "x", latencyMs: 1, costPer1kTokens: 1, quality: 2 }])).toThrow();
    expect(() => selectModel([])).toThrow();
  });
});
