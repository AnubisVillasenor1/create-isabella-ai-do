/**
 * API CATALOG SIMULATOR — simulador honesto sin ejecución privilegiada (ISA-455).
 * state: draft | engine-generated (pendiente revisión humana).
 *
 * El catálogo de rutas (`docs/api/route-inventory.json`, 42 rutas) marca rutas
 * sensibles sin contrato verificado. Este simulador NO puede ejecutar acciones
 * privilegiadas: por construcción `executesPrivilegedActions()` es siempre
 * `false`, ningún endpoint sensible (o con `sideEffects` distinto de "NONE")
 * puede crearse, y `execute()` sólo devuelve respuestas simuladas en memoria.
 * No realiza side effects ni delega en PDP/identidad.
 */
export type HttpMethod = "GET" | "POST";

export interface SimulatedEndpoint {
  readonly route: string;
  readonly method: HttpMethod;
  readonly sensitive: boolean;
  readonly sideEffects: "NONE";
}

export interface ApiCatalogSimulator {
  readonly execute: (route: string) => SimulatedResponse;
  readonly executesPrivilegedActions: () => false;
  readonly isSensitive: (route: string) => boolean;
}

export interface SimulatedResponse {
  readonly ok: true;
  readonly simulated: true;
  readonly payload: string;
}

export interface ApiSimulatorConfig {
  readonly catalog: readonly SimulatedEndpoint[];
}

export function createApiCatalogSimulator(config: ApiSimulatorConfig): ApiCatalogSimulator {
  const byRoute = new Map<string, SimulatedEndpoint>();
  for (const endpoint of config.catalog) {
    if (endpoint.route.trim().length === 0) throw new Error("CATALOG_SIMULATOR: ruta vacía");
    if (!endpoint.route.startsWith("/")) throw new Error(`CATALOG_SIMULATOR: ruta sin '/' inicial: ${endpoint.route}`);
    if (endpoint.method !== "GET" && endpoint.method !== "POST") {
      throw new Error(`CATALOG_SIMULATOR: método no soportado ${endpoint.method}`);
    }
    if (endpoint.sideEffects !== "NONE") {
      throw new Error(`CATALOG_SIMULATOR: endpoint con side effects no es simulable: ${endpoint.route}`);
    }
    if (byRoute.has(endpoint.route)) throw new Error(`CATALOG_SIMULATOR: ruta duplicada ${endpoint.route}`);
    byRoute.set(endpoint.route, Object.freeze({ ...endpoint }));
  }

  const execute = (route: string): SimulatedResponse => {
    const endpoint = byRoute.get(route);
    if (!endpoint) throw new Error(`CATALOG_SIMULATOR: ruta no simulada ${route}`);
    if (endpoint.sensitive) {
      throw new Error(`CATALOG_SIMULATOR: ruta sensible no simulable sin ejecución: ${route}`);
    }
    return Object.freeze({ ok: true as const, simulated: true as const, payload: `simulated:${route}` });
  };

  return Object.freeze({
    execute,
    executesPrivilegedActions: () => false as const,
    isSensitive: (route: string): boolean => byRoute.get(route)?.sensitive ?? false,
  });
}