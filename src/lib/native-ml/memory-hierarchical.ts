// state: draft | engine-generated
//
// Governed hierarchical memory facade (blueprint §6): composes the HDC/VSA
// core (memory-core.ts) with territory chunk metadata (§6.2), the append-only
// ML provenance ledger (provenance.ts) and the injected CROWN-style hooks
// (types.ts NativeMLHooks). Before this module the KNOWLEDGE plane had the
// algebra but no governed store: chunks had no trust level, reads had no
// policy gate and writes left no evidence.
//
// Honesty boundaries (AGENTS.md §1): recall similarity is a capability, not a
// decision. Sensitive chunks never surface their text or source URI through
// read(). Nothing here executes a side effect, and a green test is not
// production readiness — this surface stays `state: draft` until human review.

import { createHash } from 'node:crypto';
import { IsabellaMemoryCore, type HyperVector } from './memory-core';
import { MlProvenanceLedger } from './provenance';
import { serializeToText, deserialize } from './serde';
import type { NativeMLHooks } from './types';

export type MemorySensitivity = 'public' | 'internal' | 'sensitive';
export type MemoryAuthority = 'institutional' | 'verified' | 'community' | 'unverified';

export const MEMORY_LEVELS = [
  'episodic',
  'semantic',
  'procedural',
  'governance',
  'learning',
] as const;
export type MemoryLevel = (typeof MEMORY_LEVELS)[number];

const AUTHORITIES: readonly MemoryAuthority[] = [
  'institutional',
  'verified',
  'community',
  'unverified',
];
const SENSITIVITIES: readonly MemorySensitivity[] = ['public', 'internal', 'sensitive'];

export interface MemoryChunk {
  chunkId: string;
  documentId: string;
  territoryId: string;
  text: string;
  sourceUri?: string;
  authority: MemoryAuthority;
  sensitivity: MemorySensitivity;
  language: string;
  level: MemoryLevel;
  validFrom?: string;
  validUntil?: string;
}

export interface ChunkMetadata {
  readonly chunkId: string;
  readonly documentId: string;
  readonly territoryId: string;
  readonly sourceUri?: string;
  readonly authority: MemoryAuthority;
  readonly sensitivity: MemorySensitivity;
  readonly language: string;
  readonly level: MemoryLevel;
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly textHash: string;
}

export interface StoredChunkRecord {
  readonly chunk: ChunkMetadata;
  readonly vector: HyperVector;
  readonly vectorHash: string;
  readonly embeddedBy: 'native-hdc-v1';
  readonly writtenAt: string;
  readonly provenanceSeq: number;
}

export interface MemoryRecallMatch {
  readonly chunkId: string;
  readonly documentId: string;
  readonly territoryId: string;
  readonly level: MemoryLevel;
  readonly authority: MemoryAuthority;
  readonly sensitivity: MemorySensitivity;
  readonly score: number;
  /** Present only for public chunks; sensitive content is never disclosed on recall. */
  readonly sourceUri?: string;
}

interface SnapshotEntry {
  readonly chunkId: string;
  readonly documentId: string;
  readonly territoryId: string;
  readonly textHash: string;
  readonly authority: MemoryAuthority;
  readonly sensitivity: MemorySensitivity;
  readonly language: string;
  readonly level: MemoryLevel;
  readonly vectorHex: string;
  readonly vectorHash: string;
  readonly writtenAt: string;
  readonly sourceUri?: string;
}

export interface MemoryCoreSnapshot {
  readonly format: 'isabella.native-memory.v1';
  readonly seedLabel: string;
  readonly dimension: number;
  readonly records: readonly SnapshotEntry[];
}

const MAX_CHUNK_CHARS = 4_096;
const MIN_TRUST_SCORE = 0.05;
const DEFAULT_TERRITORY = 'rdm-real-del-monte';
const DEFAULT_SEED = 'isabella-hdc-default';
const DEFAULT_DIM = 1024;

function assertEnum<T extends string>(value: string, allowed: readonly T[], code: string): T {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(code);
  return value as T;
}

/**
 * Territory-scoped, policy-gated hypervector memory with provenance. Writes
 * seal evidence; reads consult the injected authorization hook; recall ranks
 * by HDC similarity within a territory.
 */
export class HierarchicalMemoryCore {
  readonly ledger = new MlProvenanceLedger();
  private readonly records = new Map<string, StoredChunkRecord>();

  constructor(
    private readonly memory: IsabellaMemoryCore = new IsabellaMemoryCore({ seed: DEFAULT_SEED }),
    private readonly territoryId: string = DEFAULT_TERRITORY,
    private readonly hooks: NativeMLHooks = {}
  ) {
    if (!territoryId) throw new Error('memory_territory_required');
  }

  size(): number {
    return this.records.size;
  }

  /** Encode and store one territorial chunk; seals a provenance event. */
  write(input: MemoryChunk): StoredChunkRecord {
    if (input.territoryId !== this.territoryId) throw new Error('memory_territory_mismatch');
    if (!input.chunkId || !input.documentId) throw new Error('memory_identity_required');
    if (typeof input.text !== 'string' || input.text.trim().length === 0)
      throw new Error('memory_chunk_text_required');
    if (input.text.length > MAX_CHUNK_CHARS) throw new Error('memory_chunk_too_large');
    if (this.records.has(input.chunkId)) throw new Error('memory_chunk_exists');
    const authority = assertEnum(input.authority, AUTHORITIES, 'memory_authority_invalid');
    const sensitivity = assertEnum(input.sensitivity, SENSITIVITIES, 'memory_sensitivity_invalid');
    const level = assertEnum(input.level, MEMORY_LEVELS, 'memory_level_invalid');
    if (!input.language || !/^[a-zA-Z0-9-]{2,35}$/.test(input.language))
      throw new Error('memory_language_invalid');

    const vector = this.memory.encode(input.text);
    return this.seal(
      {
        chunkId: input.chunkId,
        documentId: input.documentId,
        territoryId: input.territoryId,
        sourceUri: input.sourceUri,
        authority,
        sensitivity,
        language: input.language,
        level,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        textHash: createHash('sha256').update(input.text, 'utf8').digest('hex'),
      },
      vector,
      new Date().toISOString()
    );
  }

  /**
   * Policy-gated recall: the authorization hook runs first (fail-closed),
   * then top-k HDC similarity within the territory. Expired chunks are skipped
   * and sensitive sources are honestly withheld from the returned metadata.
   */
  async read(
    query: string,
    options: { k?: number; minScore?: number; level?: MemoryLevel; actor?: string } = {}
  ): Promise<MemoryRecallMatch[]> {
    const k = options.k ?? 5;
    if (!Number.isSafeInteger(k) || k < 1 || k > 64) throw new Error('memory_recall_k_invalid');
    const minScore = options.minScore ?? MIN_TRUST_SCORE;
    if (options.level !== undefined)
      assertEnum(options.level, MEMORY_LEVELS, 'memory_level_invalid');
    if (!query || query.length > MAX_CHUNK_CHARS) throw new Error('memory_query_invalid');

    const decision = await this.hooks.authorize?.({
      action: 'native_ml.memory_read',
      territoryId: this.territoryId,
    });
    if (decision && decision.decision !== 'ALLOW')
      throw new Error(`memory_read_${decision.decision.toLowerCase()}`);

    const probe = this.memory.encode(query);
    const now = new Date().toISOString();
    const matches: MemoryRecallMatch[] = [];
    for (const record of this.records.values()) {
      const c = record.chunk;
      if (c.territoryId !== this.territoryId) continue;
      if (options.level && c.level !== options.level) continue;
      if (c.validUntil && c.validUntil < now) continue;
      if (c.validFrom && c.validFrom > now) continue;
      const score = this.memory.similarity(probe, record.vector);
      if (score < minScore) continue;
      const match: MemoryRecallMatch = {
        chunkId: c.chunkId,
        documentId: c.documentId,
        territoryId: c.territoryId,
        level: c.level,
        authority: c.authority,
        sensitivity: c.sensitivity,
        score,
        ...(c.sensitivity === 'public' && c.sourceUri ? { sourceUri: c.sourceUri } : {}),
      };
      matches.push(match);
    }
    matches.sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));
    const top = matches.slice(0, k);
    void this.hooks.audit?.('native_ml.memory_read', {
      actor: options.actor ?? 'anonymous',
      queryHash: createHash('sha256').update(query, 'utf8').digest('hex'),
      results: top.map((m) => ({ chunkId: m.chunkId, score: m.score })),
    });
    return top;
  }

  /**
   * Associative composite memory (blueprint §6.3): bind a query vector to a
   * stored chunk so the association itself is auditable and re-readable.
   */
  associate(query: string, subjectChunkId: string): { composite: HyperVector; hash: string } {
    const record = this.records.get(subjectChunkId);
    if (!record) throw new Error('memory_chunk_not_found');
    if (!query || query.length > MAX_CHUNK_CHARS) throw new Error('memory_query_invalid');
    const composite = this.memory.bind(this.memory.encode(query), record.vector);
    const hash = this.memory.hashVector(composite);
    const event = this.ledger.record({
      type: 'evaluation',
      subjectId: subjectChunkId,
      actor: this.territoryId,
      metadata: { kind: 'memory_association', compositeHash: hash },
    });
    void this.hooks.audit?.('native_ml.memory_associate', {
      subjectChunkId,
      compositeHash: hash,
      provenanceSeq: event.seq,
    });
    return { composite, hash };
  }

  /** Resolve an association: unbind the query used at bind time to recover the chunk vector. */
  dissociate(query: string, composite: HyperVector): HyperVector {
    if (!query || query.length > MAX_CHUNK_CHARS) throw new Error('memory_query_invalid');
    return this.memory.unbind(this.memory.encode(query), composite);
  }

  /** Canonical, checksummed snapshot for persistence or transport (no plaintext). */
  exportState(): string {
    const snapshot: MemoryCoreSnapshot = {
      format: 'isabella.native-memory.v1',
      seedLabel: this.memory.seedLabel,
      dimension: this.memory.dimension,
      records: [...this.records.values()].map((r) => ({
        chunkId: r.chunk.chunkId,
        documentId: r.chunk.documentId,
        territoryId: r.chunk.territoryId,
        textHash: r.chunk.textHash,
        authority: r.chunk.authority,
        sensitivity: r.chunk.sensitivity,
        language: r.chunk.language,
        level: r.chunk.level,
        vectorHex: this.memory.vectorsToHex([r.vector]),
        vectorHash: r.vectorHash,
        writtenAt: r.writtenAt,
        sourceUri: r.chunk.sourceUri,
      })),
    };
    return serializeToText(snapshot);
  }

  /**
   * Load a snapshot into a fresh core. Vectors are re-verified against their
   * stored hashes; a tampered or foreign record is refused, never trusted.
   * The ledger is re-sealed so imported state still carries local provenance.
   */
  static importState(
    text: string,
    options: {
      territoryId?: string;
      seed?: string;
      dimension?: number;
      hooks?: NativeMLHooks;
    } = {}
  ): { memory: HierarchicalMemoryCore; imported: number; skipped: number } {
    const territoryId = options.territoryId ?? DEFAULT_TERRITORY;
    const seed = options.seed ?? DEFAULT_SEED;
    const dimension = options.dimension ?? DEFAULT_DIM;
    const snapshot = deserialize<MemoryCoreSnapshot>(text);
    if (snapshot.format !== 'isabella.native-memory.v1')
      throw new Error('memory_format_unsupported');
    if (snapshot.seedLabel !== seed) throw new Error('memory_seed_mismatch');
    if (snapshot.dimension !== dimension) throw new Error('memory_dimension_mismatch');

    const core = new IsabellaMemoryCore({ dimension, seed });
    const memory = new HierarchicalMemoryCore(core, territoryId, options.hooks ?? {});
    let imported = 0;
    let skipped = 0;
    for (const entry of snapshot.records ?? []) {
      // Never import a foreign territory's records into this instance.
      if (entry.territoryId !== territoryId) {
        skipped += 1;
        continue;
      }
      const [vector] = core.hexToVectors(entry.vectorHex);
      if (!vector) throw new Error('memory_vector_missing');
      if (core.hashVector(vector) !== entry.vectorHash) throw new Error('memory_vector_tampered');
      memory.seal(
        {
          chunkId: entry.chunkId,
          documentId: entry.documentId,
          territoryId: entry.territoryId,
          sourceUri: entry.sourceUri,
          authority: entry.authority,
          sensitivity: entry.sensitivity,
          language: entry.language,
          level: entry.level,
          textHash: entry.textHash,
        },
        vector,
        entry.writtenAt
      );
      imported += 1;
    }
    return { memory, imported, skipped };
  }

  /** Shared write path: freezes the record, seals provenance, fires the audit hook. */
  private seal(chunk: ChunkMetadata, vector: HyperVector, writtenAt: string): StoredChunkRecord {
    const vectorHash = this.memory.hashVector(vector);
    const event = this.ledger.record({
      type: 'evaluation',
      subjectId: chunk.chunkId,
      actor: this.territoryId,
      metadata: {
        kind: 'memory_write',
        documentId: chunk.documentId,
        textHash: chunk.textHash,
        vectorHash,
        authority: chunk.authority,
        sensitivity: chunk.sensitivity,
        level: chunk.level,
      },
    });
    const record: StoredChunkRecord = Object.freeze({
      chunk: Object.freeze({ ...chunk }),
      vector,
      vectorHash,
      embeddedBy: 'native-hdc-v1' as const,
      writtenAt,
      provenanceSeq: event.seq,
    });
    this.records.set(chunk.chunkId, record);
    void this.hooks.audit?.('native_ml.memory_write', {
      chunkId: chunk.chunkId,
      vectorHash,
      provenanceSeq: event.seq,
    });
    return record;
  }
}
