// state: draft | engine-generated
//
// ML provenance ledger. The blueprint requires every training/aggregation event
// to be recorded and tamper-evident, but native ML only emitted transient
// provenanceId strings with no append-only record or inclusion proof. This
// closes that gap by reusing the real BookPI Merkle engine (./merkle via
// ../../bookpi/merkle) rather than inventing a second one: events are chained,
// a Merkle root anchors the log, and any single event can be proven included.
// A verified ledger proves integrity of the record, not correctness of the
// model nor authority to act on it (AGENTS.md §1).

import { createHash } from 'node:crypto';
import {
  buildMerkleTree,
  generateMerkleProof,
  verifyChunkProof,
  type ChunkProof,
} from '../../bookpi/merkle';

export type MlEventType =
  'training' | 'evaluation' | 'federated_round' | 'promotion' | 'rollback' | 'drift_alert';

export interface MlProvenanceEvent {
  seq: number;
  type: MlEventType;
  subjectId: string;
  actor: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

type MlEventDraft = Omit<MlProvenanceEvent, 'hash'>;

export interface MlInclusionProof {
  eventId: number;
  leafHash: string;
  root: string;
  leafCount: number;
  proofPath: ChunkProof['proofPath'];
}

/**
 * Append-only, hash-chained ML provenance log with a Merkle anchor. `record`
 * returns the sealed event; nothing can be mutated or removed once appended.
 */
export class MlProvenanceLedger {
  private readonly events: MlProvenanceEvent[] = [];

  private computeHash(draft: MlEventDraft): string {
    return sha256({
      seq: draft.seq,
      type: draft.type,
      subjectId: draft.subjectId,
      actor: draft.actor,
      timestamp: draft.timestamp,
      metadata: draft.metadata,
      prevHash: draft.prevHash,
    });
  }

  record(
    input: {
      type: MlEventType;
      subjectId: string;
      actor: string;
      metadata?: Record<string, unknown>;
    },
    clock: () => string = () => new Date().toISOString()
  ): MlProvenanceEvent {
    if (!input.subjectId) throw new Error('provenance_subject_required');
    if (!input.actor) throw new Error('provenance_actor_required');
    const seq = this.events.length;
    const prevHash = seq === 0 ? '0'.repeat(64) : this.events[seq - 1]!.hash;
    const draft: MlEventDraft = {
      seq,
      type: input.type,
      subjectId: input.subjectId,
      actor: input.actor,
      timestamp: clock(),
      metadata: input.metadata ?? {},
      prevHash,
    };
    const event: MlProvenanceEvent = Object.freeze({ ...draft, hash: this.computeHash(draft) });
    this.events.push(event);
    return event;
  }

  leafHashes(): string[] {
    return this.events.map((e) => e.hash);
  }

  root(): string | null {
    if (this.events.length === 0) return null;
    return buildMerkleTree(this.leafHashes()).root;
  }

  size(): number {
    return this.events.length;
  }

  /** Detect any tampering of the chain (broken prev-hash linkage). */
  verifyChain(): boolean {
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i]!;
      const expectedPrev = i === 0 ? '0'.repeat(64) : this.events[i - 1]!.hash;
      if (e.prevHash !== expectedPrev) return false;
      const { hash: _ignored, ...rest } = e;
      void _ignored;
      if (this.computeHash(rest) !== e.hash) return false;
    }
    return true;
  }

  proveInclusion(seq: number): MlInclusionProof {
    if (!Number.isInteger(seq) || seq < 0 || seq >= this.events.length)
      throw new Error('provenance_seq_out_of_range');
    const leaves = this.leafHashes();
    const proof = generateMerkleProof(leaves, seq);
    return {
      eventId: seq,
      leafHash: leaves[seq]!,
      root: proof.root,
      leafCount: leaves.length,
      proofPath: proof.proofPath,
    };
  }

  verifyInclusion(proof: MlInclusionProof): boolean {
    if (proof.leafCount !== this.events.length) return false;
    if (this.root() !== proof.root) return false;
    return verifyChunkProof({
      chunkIndex: proof.eventId,
      chunkHash: proof.leafHash,
      proofPath: proof.proofPath,
      root: proof.root,
    });
  }

  snapshot(): MlProvenanceEvent[] {
    return this.events.slice();
  }
}

/**
 * Port interface so the native routes / BookPI runtime can inject a durable
 * sink without native-ml importing the (excluded) src/bookpi/ledger runtime.
 */
export interface MlProvenancePort {
  emit(event: MlProvenanceEvent): void | Promise<void>;
}
