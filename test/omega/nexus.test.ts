import { describe, expect, it } from "vitest";
import {
  NEXUS_PANELS,
  buildNexusView,
  type NexusPanel,
} from "../../src/omega/nexus";

describe("Ω∞-22 Isabella Nexus", () => {
  it("usa el título por defecto", () => {
    expect(buildNexusView().title).toBe("Isabella Nexus Ω∞");
    expect(buildNexusView({}).title).toBe("Isabella Nexus Ω∞");
  });

  it("respeta un título personalizado", () => {
    expect(buildNexusView({ title: "Consola Regional" }).title).toBe("Consola Regional");
  });

  it("cuenta 8 paneles", () => {
    expect(buildNexusView().panelCount).toBe(8);
    expect(buildNexusView().panels).toHaveLength(8);
    expect(NEXUS_PANELS).toHaveLength(8);
  });

  it("contiene todos los ids esperados en orden", () => {
    const expected: string[] = [
      "constitution",
      "simulation",
      "capital",
      "civilization",
      "trust",
      "memory",
      "twins",
      "territory",
    ];
    expect(buildNexusView().panels.map((p: NexusPanel) => p.id)).toEqual(expected);
  });

  it("capitaliza cada label", () => {
    const labels = buildNexusView().panels.map((p: NexusPanel) => p.label);
    expect(labels).toEqual([
      "Constitution",
      "Simulation",
      "Capital",
      "Civilization",
      "Trust",
      "Memory",
      "Twins",
      "Territory",
    ]);
  });

  it("devuelve un arreglo fresco en cada llamada", () => {
    const first = buildNexusView();
    const second = buildNexusView();
    expect(second.panels).not.toBe(first.panels);
    expect(second.panels).toEqual(first.panels);
  });
});
