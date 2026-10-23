import { describe, expect, it } from "vitest";
import { verifySelfConsistency } from "../../src/gifts/self-consistency";

describe("Regalo 5 — Auto-Consistencia", () => {
  it("elige el consenso cuando las muestras coinciden", () => {
    const result = verifySelfConsistency([
      { text: "la capital de Francia es París" },
      { text: "París es la capital de Francia" },
      { text: "en Francia la capital es París" },
    ]);
    expect(result.sampleCount).toBe(3);
    expect(result.consistent).toBe(true);
    expect(result.agreement).toBeGreaterThanOrEqual(0.66);
    expect(result.consensus).toBeDefined();
  });

  it("no entrega consenso con muestras divergentes", () => {
    const result = verifySelfConsistency([
      { text: "uno dos tres cuatro" },
      { text: "alfa beta gamma delta" },
      { text: "rojo verde azul negro" },
    ]);
    expect(result.consistent).toBe(false);
    expect(result.consensus).toBeUndefined();
  });

  it("rechaza conjuntos vacíos", () => {
    expect(() => verifySelfConsistency([])).toThrow();
  });
});
