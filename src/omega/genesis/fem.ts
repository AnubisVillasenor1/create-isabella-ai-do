// state: draft | engine-generated — Fractal Executive Memory (FEM) de 6 niveles (Documento §VII).
// Unifica y reemplaza la ETM anterior: seis horizontes de memoria, cada uno con un backend
// canónico y una capacidad acotada. Este módulo enruta UNA escritura al nivel según su
// horizonte temporal y aplica eviction FIFO por nivel. El adaptador por defecto es EN
// MEMORIA (volátil): los backends reales (Redis/PostgreSQL/pgvector/Neo4j/KG/BookPI) se
// inyectan como puertos. FEM no afirma persistencia duradera salvo que se enlace BookPI (N6).
export const FEM_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type FemLevel = (typeof FEM_LEVELS)[number];

export interface FemLevelInfo {
  readonly level: FemLevel;
  readonly name: string;
  readonly horizon: string;
  readonly canonicalBackend: string;
  /** Duración mínima del horizonte en milisegundos; se usa para enrutar la escritura. */
  readonly minHorizonMs: number;
  readonly capacity: number;
}

export const FEM_REGISTRY: Readonly<Record<FemLevel, FemLevelInfo>> = Object.freeze({
  1: {
    level: 1,
    name: 'Conversacional',
    horizon: 'minutos',
    canonicalBackend: 'Redis',
    minHorizonMs: 0,
    capacity: 64,
  },
  2: {
    level: 2,
    name: 'Operacional',
    horizon: 'horas',
    canonicalBackend: 'PostgreSQL',
    minHorizonMs: 60_000,
    capacity: 256,
  },
  3: {
    level: 3,
    name: 'Táctica',
    horizon: 'días',
    canonicalBackend: 'pgvector',
    minHorizonMs: 3_600_000,
    capacity: 512,
  },
  4: {
    level: 4,
    name: 'Estratégica',
    horizon: 'meses',
    canonicalBackend: 'Neo4j',
    minHorizonMs: 86_400_000,
    capacity: 256,
  },
  5: {
    level: 5,
    name: 'Institucional',
    horizon: 'años',
    canonicalBackend: 'Knowledge Graph',
    minHorizonMs: 2_592_000_000,
    capacity: 128,
  },
  6: {
    level: 6,
    name: 'Canónica',
    horizon: 'permanente',
    canonicalBackend: 'BookPI (inmutable)',
    minHorizonMs: 31_536_000_000,
    capacity: 1024,
  },
});

export interface FemRecord {
  readonly id: string;
  readonly payload: string;
  /** Horizonte que desea el escritor (ms). Determina el nivel destino. */
  readonly horizonMs: number;
  readonly createdAt: string;
}

/** Puerto de persistencia por nivel. El adaptador por defecto guarda en memoria. */
export interface FemBackend {
  save(record: FemRecord): void;
  recent(limit: number): readonly FemRecord[];
  size(): number;
}

function makeInMemoryBackend(capacity: number): FemBackend {
  const store: FemRecord[] = [];
  return {
    save(record) {
      store.push(record);
      while (store.length > capacity) store.shift();
    },
    recent(limit) {
      return store.slice(Math.max(0, store.length - limit));
    },
    size() {
      return store.length;
    },
  };
}

/** Enruta un horizonte al nivel FEM cuyo rango cubre el horizonte (menor nivel que aplica). */
export function levelForHorizon(horizonMs: number): FemLevel {
  if (!Number.isFinite(horizonMs) || horizonMs < 0) return 1;
  let level: FemLevel = 1;
  for (const candidate of FEM_LEVELS) {
    if (horizonMs >= FEM_REGISTRY[candidate].minHorizonMs) level = candidate;
  }
  return level;
}

/**
 * Memoria Ejecutiva Fractal. Seis niveles con capacidad acotada; `write` enruta por horizonte.
 * Determinista salvo por el reloj inyectado. No muta memoria canónica por sí sola: el nivel 6
 * queda marcado `durable: false` salvo que el llamador enlace un backend duradero real.
 */
export class FractalExecutiveMemory {
  private readonly backends = new Map<FemLevel, FemBackend>();
  private readonly clock: () => string;

  constructor(clock: () => string = () => new Date().toISOString()) {
    this.clock = clock;
    for (const level of FEM_LEVELS)
      this.backends.set(level, makeInMemoryBackend(FEM_REGISTRY[level].capacity));
  }

  /** Permite inyectar un backend real (p. ej. BookPI) para un nivel concreto. */
  attachBackend(level: FemLevel, backend: FemBackend): void {
    this.backends.set(level, backend);
  }

  write(id: string, payload: string, horizonMs: number): { level: FemLevel; record: FemRecord } {
    if (!id.trim()) throw new Error('FEM_RECORD_ID_REQUIRED');
    const level = levelForHorizon(horizonMs);
    const record: FemRecord = Object.freeze({ id, payload, horizonMs, createdAt: this.clock() });
    this.backends.get(level)?.save(record);
    return { level, record };
  }

  read(level: FemLevel, limit = 10): readonly FemRecord[] {
    return this.backends.get(level)?.recent(limit) ?? [];
  }

  stats(): Record<FemLevel, number> {
    const out = {} as Record<FemLevel, number>;
    for (const level of FEM_LEVELS) out[level] = this.backends.get(level)?.size() ?? 0;
    return out;
  }
}
