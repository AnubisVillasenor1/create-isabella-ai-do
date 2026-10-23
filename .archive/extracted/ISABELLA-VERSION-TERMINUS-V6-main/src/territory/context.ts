export interface GeoPoint { lat: number; lon: number; }
export interface TerritoryContext {
  territoryId: string;
  jurisdiction: string;
  locale: string;
  language: string;
  point?: GeoPoint;
  pointsOfInterest: readonly string[];
  routes: readonly string[];
  policies: readonly string[];
  sources: readonly string[];
  observedAt: string;
}

export interface TerritoryQuery {
  intent: "route" | "history" | "food" | "commerce" | "event" | "safety" | "general";
  query: string;
  context: TerritoryContext;
}

export interface TerritoryAnswer {
  answer: string;
  sourceIds: readonly string[];
  territoryId: string;
  confidence: "source_bound" | "insufficient_evidence";
}

export function queryTerritory(input: TerritoryQuery, resolver: (query: TerritoryQuery)=>TerritoryAnswer): TerritoryAnswer {
  if (!input.query.trim()) throw new Error("TERRITORY: query is required");
  if (!input.context.territoryId) throw new Error("TERRITORY: territoryId is required");
  const result=resolver(input);
  if(result.territoryId!==input.context.territoryId) throw new Error("TERRITORY: resolver returned a different territory");
  return Object.freeze({...result,sourceIds:[...result.sourceIds]});
}
