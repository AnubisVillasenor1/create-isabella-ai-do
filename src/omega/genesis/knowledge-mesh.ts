// state: draft | engine-generated — Knowledge Mesh Universal (Documento §VIII).
// Un GRAFO SEMÁNTICO (no una base documental): nodos tipados (documento, persona, evento,
// entidad, proceso, proyecto) enlazados por aristas con tipo y fuerza. Ofrece inserción
// idempotente, recorrido BFS con salto máximo, fuerza de relación y detección de huecos
// (nodos aislados). Es una estructura de datos determinista en memoria: NO requiere Neo4j/
// ArangoDB real; esos backends compatibles se mencionan pero no se invocan. No autoriza.
export const NODE_TYPES = ['document', 'person', 'event', 'entity', 'process', 'project'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const RELATION_TYPES = [
  'references',
  'authored_by',
  'occurred_in',
  'part_of',
  'causes',
  'related_to',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface MeshNode {
  readonly id: string;
  readonly type: NodeType;
  readonly label: string;
}

export interface MeshEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: RelationType;
  /** Fuerza de la relación en [0,1]. */
  readonly strength: number;
}

export interface TraversalResult {
  readonly reached: readonly string[];
  readonly paths: Readonly<Record<string, number>>;
}

export interface MeshGap {
  readonly nodeId: string;
  readonly reason: string;
}

/** Malla de conocimiento acotada y determinista. */
export class KnowledgeMesh {
  private readonly nodes = new Map<string, MeshNode>();
  private readonly edges: MeshEdge[] = [];

  addNode(node: MeshNode): void {
    if (!node.id.trim()) throw new Error('MESH_NODE_ID_REQUIRED');
    // Idempotente: la última definición de un id gana.
    this.nodes.set(node.id, Object.freeze({ ...node }));
  }

  addEdge(edge: MeshEdge): void {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error('MESH_EDGE_UNKNOWN_NODE');
    }
    if (!(edge.strength >= 0 && edge.strength <= 1)) throw new Error('MESH_EDGE_STRENGTH_RANGE');
    this.edges.push(Object.freeze({ ...edge }));
  }

  nodeCount(): number {
    return this.nodes.size;
  }

  edgeCount(): number {
    return this.edges.length;
  }

  neighbors(id: string): readonly MeshEdge[] {
    return this.edges.filter((e) => e.from === id || e.to === id);
  }

  /** Recorrido BFS desde `root` hasta `maxHops`. Devuelve nodos alcanzados y su distancia. */
  traverse(root: string, maxHops = 2): TraversalResult {
    if (!this.nodes.has(root)) throw new Error('MESH_TRAVERSAL_UNKNOWN_ROOT');
    const distance: Record<string, number> = { [root]: 0 };
    const queue: string[] = [root];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const d = distance[current] ?? 0;
      if (d >= maxHops) continue;
      for (const edge of this.neighbors(current)) {
        const next = edge.from === current ? edge.to : edge.from;
        if (!(next in distance)) {
          distance[next] = d + 1;
          queue.push(next);
        }
      }
    }
    return Object.freeze({
      reached: Object.freeze(Object.keys(distance)),
      paths: Object.freeze(distance),
    });
  }

  /**
   * Fuerza de relación indirecta entre dos nodos: el máximo de los productos de fuerzas a lo
   * largo de caminos de hasta `maxHops`. 0 si no hay conexión.
   */
  relationStrength(from: string, to: string, maxHops = 3): number {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return 0;
    if (from === to) return 1;
    let best = 0;
    const walk = (node: string, visited: Set<string>, acc: number, depth: number): void => {
      if (depth > maxHops) return;
      for (const edge of this.neighbors(node)) {
        const next = edge.from === node ? edge.to : edge.from;
        if (visited.has(next)) continue;
        const score = acc * edge.strength;
        if (next === to) {
          if (score > best) best = score;
          continue;
        }
        visited.add(next);
        walk(next, visited, score, depth + 1);
        visited.delete(next);
      }
    };
    walk(from, new Set([from]), 1, 1);
    return best;
  }

  /** Huecos: nodos sin ninguna arista (aislados) o con aristas de fuerza < `minStrength`. */
  detectGaps(minStrength = 0): readonly MeshGap[] {
    const gaps: MeshGap[] = [];
    for (const id of this.nodes.keys()) {
      const incident = this.neighbors(id);
      if (incident.length === 0) {
        gaps.push(Object.freeze({ nodeId: id, reason: 'isolated_node' }));
      } else if (incident.every((e) => e.strength < minStrength)) {
        gaps.push(Object.freeze({ nodeId: id, reason: 'weak_links_only' }));
      }
    }
    return Object.freeze(gaps);
  }
}
