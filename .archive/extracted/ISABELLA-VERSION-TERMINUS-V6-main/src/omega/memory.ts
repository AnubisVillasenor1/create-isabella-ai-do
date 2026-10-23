// Ω∞-18 Omni Memory (state: draft | engine-generated).
// Memoria cognitiva multicapa en proceso (episódica, semántica, procedimental y
// territorial). Las consultas son deterministas y explicables, sin red ni LLM.
// Almacenar y consultar no concede autoridad ni ejecuta acciones.

export type MemoryLayer = "episodic" | "semantic" | "procedural" | "territorial";

export interface MemoryRecord {
  id: string;
  layer: MemoryLayer;
  content: string;
  importance: number;
  createdAt: string;
}

export interface MemoryQuery {
  layers?: MemoryLayer[];
  minImportance?: number;
  limit?: number;
  text?: string;
}

const ALLOWED_LAYERS: readonly MemoryLayer[] = ["episodic", "semantic", "procedural", "territorial"];

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function isUnit(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export class OmniMemory {
  private readonly records = new Map<string, MemoryRecord>();
  private readonly clock: () => string;

  constructor(clock: () => string = () => new Date().toISOString()) {
    this.clock = clock;
  }

  store(input: {
    id: string;
    layer: MemoryLayer;
    content: string;
    importance: number;
    createdAt?: string;
  }): MemoryRecord {
    if (!ALLOWED_LAYERS.includes(input.layer)) {
      throw new Error("MEMORY_LAYER_INVALID");
    }
    if (!isUnit(input.importance)) {
      throw new Error("MEMORY_IMPORTANCE_OUT_OF_RANGE");
    }
    if (this.records.has(input.id)) {
      throw new Error("MEMORY_DUPLICATE_ID");
    }
    const record: MemoryRecord = {
      id: input.id,
      layer: input.layer,
      content: input.content,
      importance: round4(input.importance),
      createdAt: input.createdAt ?? this.clock(),
    };
    this.records.set(record.id, record);
    return { ...record };
  }

  get(id: string): MemoryRecord | undefined {
    const record = this.records.get(id);
    return record === undefined ? undefined : { ...record };
  }

  query(q: MemoryQuery = {}): MemoryRecord[] {
    const minImportance = q.minImportance ?? 0;
    if (!isUnit(minImportance)) {
      throw new Error("MEMORY_MIN_IMPORTANCE_OUT_OF_RANGE");
    }
    if (q.limit !== undefined && (!Number.isInteger(q.limit) || q.limit < 0)) {
      throw new Error("MEMORY_LIMIT_INVALID");
    }
    const layers = q.layers;
    const needle = q.text?.toLowerCase();

    const results: MemoryRecord[] = [];
    for (const record of this.records.values()) {
      if (layers && !layers.includes(record.layer)) continue;
      if (record.importance < minImportance) continue;
      if (needle !== undefined && !record.content.toLowerCase().includes(needle)) continue;
      results.push({ ...record });
    }

    results.sort((a, b) => {
      if (a.importance !== b.importance) return b.importance - a.importance;
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return q.limit === undefined ? results : results.slice(0, q.limit);
  }

  forget(id: string): boolean {
    return this.records.delete(id);
  }

  size(): number {
    return this.records.size;
  }
}
