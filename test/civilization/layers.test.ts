import { describe, expect, it } from "vitest";
import {
  CCR_DECLARED_LAYERS,
  CIVILIZATION_LAYERS,
  CIVILIZATION_LAYER_COUNT,
  CIVILIZATION_LAYER_STATUSES,
  layerById,
  layerSummary,
} from "../../src/civilization/layers";

describe("ISABELLA Ω · CCR-1 — capas Ω", () => {
  it("registra 13 capas Ω (Ω-0..Ω-12) aunque el spec declare 12", () => {
    expect(CIVILIZATION_LAYER_COUNT).toBe(13);
    expect(CCR_DECLARED_LAYERS).toBe(12);
    expect(CIVILIZATION_LAYERS.map((l) => l.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("usa identificadores Ω únicos y contiguos", () => {
    const ids = CIVILIZATION_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("Ω-0");
    expect(ids[ids.length - 1]).toBe("Ω-12");
  });

  it("declara un estado honesto dentro del vocabulario permitido", () => {
    for (const layer of CIVILIZATION_LAYERS) {
      expect(CIVILIZATION_LAYER_STATUSES).toContain(layer.status);
      expect(layer.reality.trim().length).toBeGreaterThan(0);
    }
  });

  it("marca la capa de confianza como IMPLEMENTED y la de ciencia como NOT_WIRED", () => {
    expect(layerById("Ω-7")?.status).toBe("IMPLEMENTED");
    expect(layerById("Ω-5")?.status).toBe("NOT_WIRED");
    expect(layerById("Ω-5")?.wiring).toEqual([]);
  });

  it("resume los estados sumando el total de capas", () => {
    const summary = layerSummary();
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(CIVILIZATION_LAYER_COUNT);
  });
});
