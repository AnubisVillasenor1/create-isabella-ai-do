// Ω∞-23 Territorial Civilization Fabric (state: draft | engine-generated).
// Malla civilizatoria territorial que valida cada territorio y calcula un índice
// de readiness ponderado por escala poblacional más una prioridad de intervención.
// NUNCA despliega: el resultado declara deploymentAuthorized=false de forma permanente.

export interface Territory {
  id: string;
  name: string;
  population: number;
  readiness: number;
  sovereignty: string;
}

export interface TerritorialIndex {
  id: string;
  name: string;
  sovereignty: string;
  index: number;
  priority: "immediate" | "planned" | "deferred";
}

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function validatePopulation(population: number): void {
  if (!Number.isInteger(population) || population < 0) {
    throw new Error("TERRITORY_POPULATION_INVALID");
  }
}

function validateReadiness(readiness: number): void {
  if (!Number.isFinite(readiness) || readiness < 0 || readiness > 1) {
    throw new Error("TERRITORY_READINESS_OUT_OF_RANGE");
  }
}

function priorityFor(readiness: number): "immediate" | "planned" | "deferred" {
  if (readiness >= 0.8) return "immediate";
  if (readiness >= 0.5) return "planned";
  return "deferred";
}

export function fabricateTerritories(territories: Territory[]): {
  territories: TerritorialIndex[];
  deploymentAuthorized: false;
} {
  const seen = new Set<string>();
  const indices: TerritorialIndex[] = [];

  for (const territory of territories) {
    if (seen.has(territory.id)) {
      throw new Error("TERRITORY_DUPLICATE_ID");
    }
    seen.add(territory.id);
    validatePopulation(territory.population);
    validateReadiness(territory.readiness);

    const index = round4(territory.readiness * Math.log10(territory.population + 1));
    indices.push({
      id: territory.id,
      name: territory.name,
      sovereignty: territory.sovereignty,
      index,
      priority: priorityFor(territory.readiness),
    });
  }

  indices.sort((a, b) => {
    if (b.index !== a.index) return b.index - a.index;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { territories: indices, deploymentAuthorized: false };
}
