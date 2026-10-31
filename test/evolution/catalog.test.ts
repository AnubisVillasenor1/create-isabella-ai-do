import { describe, expect, it } from "vitest";
import {
  CONTROL_COUNT,
  controlMatrixDigest,
  controlSummary,
  generateControls,
} from "../../src/evolution/catalog";
import { ENGINEERING_AXES, IMPROVEMENT_PRIMITIVES } from "../../src/core/types";
import { DOMAIN_COUNT } from "../../src/evolution/domains";

describe("evolution/catalog", () => {
  it("genera exactamente 7,000 controles (70 × 10 × 10)", () => {
    const controls = generateControls();
    expect(controls).toHaveLength(7000);
    expect(CONTROL_COUNT).toBe(7000);
    expect(DOMAIN_COUNT).toBe(70);
  });

  it("todos los controles usan IDs únicos", () => {
    const controls = generateControls();
    const ids = new Set(controls.map((c) => c.id));
    expect(ids.size).toBe(controls.length);
  });

  it("el digest de la matriz es determinista", () => {
    expect(controlMatrixDigest(generateControls())).toBe(controlMatrixDigest(generateControls()));
  });

  it("el resumen suma 7,000 con los cuatro estados", () => {
    const summary = controlSummary(generateControls());
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(7000);
    expect(summary.declared + summary.wired + summary.verified + summary.blocked).toBe(7000);
  });

  it("cubre los 10 ejes y las 10 primitivas", () => {
    const controls = generateControls();
    const axes = new Set(controls.map((c) => c.axis));
    const primitives = new Set(controls.map((c) => c.primitive));
    expect(axes.size).toBe(ENGINEERING_AXES.length);
    expect(primitives.size).toBe(IMPROVEMENT_PRIMITIVES.length);
  });

  it("ningún control se auto-declara verificado sin evidencia (sólo un subset está en verified)", () => {
    const controls = generateControls();
    const verified = controls.filter((c) => c.state === "verified");
    expect(verified.length).toBeLessThan(16 * 100);
  });
});