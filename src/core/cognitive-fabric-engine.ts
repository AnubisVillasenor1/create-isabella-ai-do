/**
 * Cognitive Fabric Engine (CFE) — unifica TINA/TRINIDAD/HYPERCORE en un tejido cognitivo (state: draft | engine-generated).
 *
 * Compone meshes especializados (reasoning, agent, memory, rag, twin, research, simulation) bajo un único
 * runtime de ejecución cognitiva. Clasifica, enruta y agrega; NO autoriza ni ejecuta efectos externos.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export type MeshKind =
  'reasoning' | 'agent' | 'memory' | 'rag' | 'twin' | 'research' | 'simulation';

export interface MeshHealth {
  readonly kind: MeshKind;
  readonly name: string;
  readonly healthy: boolean;
  readonly load: number;
}

export interface MeshTask {
  readonly id: string;
  readonly kind: MeshKind;
  readonly input: unknown;
  readonly priority: number;
}

export interface MeshResult {
  readonly taskId: string;
  readonly kind: MeshKind;
  readonly output: unknown;
  readonly latencyMs: number;
  readonly success: boolean;
}

export interface MeshHandler {
  (task: MeshTask): Promise<MeshResult> | MeshResult;
}

export class CognitiveFabricEngine {
  private readonly meshes = new Map<
    MeshKind,
    { name: string; handler: MeshHandler; healthy: boolean; load: number }
  >();
  private seq = 0;

  register(kind: MeshKind, name: string, handler: MeshHandler): void {
    if (typeof name !== 'string' || name.length === 0) throw new RangeError('CFE: name required');
    this.meshes.set(kind, { name, handler, healthy: true, load: 0 });
  }

  unregister(kind: MeshKind): boolean {
    return this.meshes.delete(kind);
  }

  has(kind: MeshKind): boolean {
    return this.meshes.has(kind);
  }

  async execute(task: Omit<MeshTask, 'id'> & { id?: string }): Promise<MeshResult> {
    const full: MeshTask = {
      id: task.id ?? `task-${(this.seq += 1)}`,
      kind: task.kind,
      input: task.input,
      priority: task.priority ?? 0,
    };
    const mesh = this.meshes.get(full.kind);
    if (mesh === undefined) throw new RangeError(`CFE: mesh not registered: ${full.kind}`);
    if (!mesh.healthy) {
      mesh.load = Math.max(0, mesh.load);
      return { taskId: full.id, kind: full.kind, output: null, latencyMs: 0, success: false };
    }
    mesh.load += 1;
    const start = Date.now();
    try {
      const r = await mesh.handler(full);
      mesh.load = Math.max(0, mesh.load - 1);
      return { ...r, taskId: r.taskId ?? full.id, latencyMs: r.latencyMs ?? Date.now() - start };
    } catch (e) {
      mesh.load = Math.max(0, mesh.load - 1);
      return {
        taskId: full.id,
        kind: full.kind,
        output: null,
        latencyMs: Date.now() - start,
        success: false,
      };
    }
  }

  async executeAll(
    tasks: readonly (Omit<MeshTask, 'id'> & { id?: string })[]
  ): Promise<MeshResult[]> {
    return Promise.all(tasks.map((t) => this.execute(t)));
  }

  health(): MeshHealth[] {
    return [...this.meshes.entries()].map(([kind, m]) => ({
      kind,
      name: m.name,
      healthy: m.healthy,
      load: m.load,
    }));
  }

  setHealthy(kind: MeshKind, healthy: boolean): void {
    const m = this.meshes.get(kind);
    if (m !== undefined) m.healthy = healthy;
  }

  meshesRegistered(): MeshKind[] {
    return [...this.meshes.keys()];
  }

  stats(): { meshes: number; healthy: number; totalLoad: number } {
    const all = [...this.meshes.values()];
    return {
      meshes: all.length,
      healthy: all.filter((m) => m.healthy).length,
      totalLoad: all.reduce((s, m) => s + m.load, 0),
    };
  }
}
