/**
 * Civilizational Evidence Graph (CEG) — evolución de BookPI (state: draft | engine-generated).
 *
 * Unifica ledger + audit + evidence + lineage (conocimiento, decisión, económico, agente) en un grafo
 * de evidencia civilizatoria append-only y verificable offline. Cada nodo registra actor, acción,
 * política, motivo, evidencia, impacto y consecuencia. Hash-chained (SHA-256) con secuencia monótona.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
import { createHash } from 'node:crypto';

export type EvidenceLineage =
  'knowledge' | 'decision' | 'economic' | 'agent' | 'governance' | 'security';

export interface EvidenceNode {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly policy: string;
  readonly reason: string;
  readonly evidenceHash: string;
  readonly impact: string;
  readonly consequence: string;
  readonly lineage: readonly EvidenceLineage[];
  readonly previousHash: string;
  readonly sequence: number;
  readonly hash: string;
}

export interface EvidenceVerification {
  readonly valid: boolean;
  readonly reasons: readonly string[];
  readonly nodeCount: number;
  readonly head: string | null;
}

function nodeHash(n: Omit<EvidenceNode, 'hash'>): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: n.id,
        timestamp: n.timestamp,
        actor: n.actor,
        action: n.action,
        policy: n.policy,
        reason: n.reason,
        evidenceHash: n.evidenceHash,
        impact: n.impact,
        consequence: n.consequence,
        lineage: n.lineage,
        previousHash: n.previousHash,
        sequence: n.sequence,
      })
    )
    .digest('hex');
}

export const CEG_GENESIS = '0'.repeat(64);

export class CivilizationalEvidenceGraph {
  private readonly nodes: EvidenceNode[] = [];
  private seq = 0;

  get size(): number {
    return this.nodes.length;
  }
  get head(): string | null {
    return this.nodes.length > 0 ? (this.nodes[this.nodes.length - 1] as EvidenceNode).hash : null;
  }

  append(input: {
    id: string;
    timestamp?: string;
    actor: string;
    action: string;
    policy: string;
    reason: string;
    evidenceHash?: string;
    impact?: string;
    consequence?: string;
    lineage?: readonly EvidenceLineage[];
  }): EvidenceNode {
    if (typeof input.id !== 'string' || input.id.length === 0)
      throw new RangeError('CEG: id required');
    if (typeof input.actor !== 'string' || input.actor.length === 0)
      throw new RangeError('CEG: actor required');
    if (typeof input.action !== 'string' || input.action.length === 0)
      throw new RangeError('CEG: action required');
    if (this.nodes.some((n) => n.id === input.id)) throw new RangeError('CEG: duplicate id');
    const ts = input.timestamp ?? new Date().toISOString();
    const prev =
      this.nodes.length > 0
        ? (this.nodes[this.nodes.length - 1] as EvidenceNode).hash
        : CEG_GENESIS;
    const base = {
      id: input.id,
      timestamp: ts,
      actor: input.actor,
      action: input.action,
      policy: input.policy ?? 'UNSPECIFIED',
      reason: input.reason ?? '',
      evidenceHash: input.evidenceHash ?? createHash('sha256').update(input.id).digest('hex'),
      impact: input.impact ?? 'unspecified',
      consequence: input.consequence ?? 'recorded',
      lineage: [...(input.lineage ?? ['governance'])],
      previousHash: prev,
      sequence: (this.seq += 1),
    };
    const node: EvidenceNode = { ...base, hash: nodeHash(base) };
    this.nodes.push(node);
    return node;
  }

  list(limit?: number): readonly EvidenceNode[] {
    if (limit === undefined) return [...this.nodes];
    if (!Number.isInteger(limit) || limit < 1)
      throw new RangeError('CEG: limit must be positive integer');
    return this.nodes.slice(-limit);
  }

  get(id: string): EvidenceNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  byActor(actor: string): readonly EvidenceNode[] {
    return this.nodes.filter((n) => n.actor === actor);
  }
  byAction(action: string): readonly EvidenceNode[] {
    return this.nodes.filter((n) => n.action === action);
  }
  byLineage(lineage: EvidenceLineage): readonly EvidenceNode[] {
    return this.nodes.filter((n) => n.lineage.includes(lineage));
  }

  verify(): EvidenceVerification {
    const reasons: string[] = [];
    let prev = CEG_GENESIS;
    let expectedSeq = 1;
    this.nodes.forEach((n, i) => {
      if (n.previousHash !== prev) reasons.push(`BROKEN_LINK@${i}`);
      if (nodeHash(n) !== n.hash) reasons.push(`HASH_MISMATCH@${i}`);
      if (n.sequence !== expectedSeq) reasons.push(`SEQUENCE_GAP@${i}`);
      expectedSeq += 1;
      prev = n.hash;
    });
    const head = this.head;
    return { valid: reasons.length === 0, reasons, nodeCount: this.nodes.length, head };
  }

  lineageTrail(id: string): readonly EvidenceNode[] {
    const node = this.get(id);
    if (node === undefined) return [];
    const trail: EvidenceNode[] = [];
    let cur: EvidenceNode | undefined = node;
    const seen = new Set<string>();
    while (cur !== undefined && !seen.has(cur.id)) {
      seen.add(cur.id);
      trail.unshift(cur);
      cur = this.nodes.find((n) => n.hash === cur!.previousHash);
    }
    return trail;
  }

  exportSnapshot(): {
    readonly version: string;
    readonly count: number;
    readonly head: string | null;
    readonly nodes: readonly EvidenceNode[];
  } {
    return {
      version: 'CEG-1.0',
      count: this.nodes.length,
      head: this.head,
      nodes: [...this.nodes],
    };
  }
}
