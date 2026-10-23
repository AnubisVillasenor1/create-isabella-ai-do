import { describe, expect, it } from "vitest";
import { fabricateTerritories, type Territory } from "../../src/omega/territory";

function territory(overrides: Partial<Territory> & Pick<Territory, "id">): Territory {
  return {
    name: `Territorio ${overrides.id}`,
    population: 9999,
    readiness: 0.5,
    sovereignty: "soberania:demo",
    ...overrides,
  };
}

describe("Ω∞-23 Territorial Civilization Fabric", () => {
  it("computa el índice readiness × log10(population+1) redondeado a 4 decimales", () => {
    const result = fabricateTerritories([territory({ id: "t1", population: 9999, readiness: 0.5 })]);
    expect(result.territories).toHaveLength(1);
    const first = result.territories[0];
    expect(first?.index).toBe(2);
    expect(first?.name).toBe("Territorio t1");
    expect(first?.sovereignty).toBe("soberania:demo");

    const round = fabricateTerritories([territory({ id: "t2", population: 9, readiness: 0.3333 })]);
    expect(round.territories[0]?.index).toBe(0.3333);
  });

  it("asigna prioridad immediate/planned/deferred según los umbrales de readiness", () => {
    const result = fabricateTerritories([
      territory({ id: "a", readiness: 0.8 }),
      territory({ id: "b", readiness: 0.7999 }),
      territory({ id: "c", readiness: 0.5 }),
      territory({ id: "d", readiness: 0.4999 }),
      territory({ id: "e", readiness: 0 }),
    ]);
    const priorities = new Map(result.territories.map((t) => [t.id, t.priority]));
    expect(priorities.get("a")).toBe("immediate");
    expect(priorities.get("b")).toBe("planned");
    expect(priorities.get("c")).toBe("planned");
    expect(priorities.get("d")).toBe("deferred");
    expect(priorities.get("e")).toBe("deferred");
  });

  it("rechaza population negativa y no entera con TERRITORY_POPULATION_INVALID", () => {
    expect(() => fabricateTerritories([territory({ id: "neg", population: -1 })])).toThrow(
      "TERRITORY_POPULATION_INVALID",
    );
    expect(() => fabricateTerritories([territory({ id: "frac", population: 10.5 })])).toThrow(
      "TERRITORY_POPULATION_INVALID",
    );
  });

  it("rechaza readiness no finito o fuera de 0..1 con TERRITORY_READINESS_OUT_OF_RANGE", () => {
    expect(() => fabricateTerritories([territory({ id: "low", readiness: -0.0001 })])).toThrow(
      "TERRITORY_READINESS_OUT_OF_RANGE",
    );
    expect(() => fabricateTerritories([territory({ id: "high", readiness: 1.0001 })])).toThrow(
      "TERRITORY_READINESS_OUT_OF_RANGE",
    );
    expect(() => fabricateTerritories([territory({ id: "nan", readiness: Number.NaN })])).toThrow(
      "TERRITORY_READINESS_OUT_OF_RANGE",
    );
    expect(() =>
      fabricateTerritories([territory({ id: "inf", readiness: Number.POSITIVE_INFINITY })]),
    ).toThrow("TERRITORY_READINESS_OUT_OF_RANGE");
  });

  it("rechaza ids duplicados con TERRITORY_DUPLICATE_ID", () => {
    expect(() =>
      fabricateTerritories([territory({ id: "dup" }), territory({ id: "dup", readiness: 0.9 })]),
    ).toThrow("TERRITORY_DUPLICATE_ID");
  });

  it("ordena por índice descendente y luego id ascendente, y nunca autoriza despliegue", () => {
    const result = fabricateTerritories([
      territory({ id: "zeta", population: 99, readiness: 0.9 }),
      territory({ id: "alpha", population: 999999, readiness: 0.4 }),
      territory({ id: "beta", population: 999999, readiness: 0.4 }),
    ]);
    expect(result.territories.map((t) => t.id)).toEqual(["alpha", "beta", "zeta"]);
    expect(result.deploymentAuthorized).toBe(false);

    const secondRun = fabricateTerritories([
      territory({ id: "beta", population: 999999, readiness: 0.4 }),
      territory({ id: "zeta", population: 99, readiness: 0.9 }),
      territory({ id: "alpha", population: 999999, readiness: 0.4 }),
    ]);
    expect(secondRun.territories.map((t) => t.id)).toEqual(["alpha", "beta", "zeta"]);
    expect(secondRun.deploymentAuthorized).toBe(false);

    const empty = fabricateTerritories([]);
    expect(empty.territories).toEqual([]);
    expect(empty.deploymentAuthorized).toBe(false);
  });
});
