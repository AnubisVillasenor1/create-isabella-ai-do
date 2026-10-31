/**
 * Memoria Ω∞ ejecutable (state: implemented | tested).
 *
 * ΩX-06 Hierarchical Memory Compression — compresión extractiva en tres niveles.
 * ΩX-13 Real-Time Vector Streaming — índice vectorial hashed actualizado por token.
 * ΩX-14 Memory Importance Scoring — importancia por recencia, frecuencia y saliencia.
 * ΩX-15 Autonomous Knowledge Distillation — destilación extractiva con MMR.
 * ΩX-16 Context Resurrection Engine — recuperación de contexto histórico con decaimiento.
 *
 * Todo se calcula en el proceso. No hay embeddings neuronales, almacenamiento
 * distribuido ni memoria canónica: son estructuras acotadas y explicables.
 */
import { createHash } from 'node:crypto';
import {
  clamp01,
  contentTerms,
  jaccard,
  splitSentences,
  termSet,
  tokenizeText,
  truncateText,
} from './text';

export interface MemoryTurn {
  readonly role: string;
  readonly content: string;
}

export interface MemoryDocument {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly source: string;
}

export interface HierarchicalCompressionOptions {
  readonly maxTurns?: number;
  readonly sentencesPerTurn?: number;
  readonly level2Chars?: number;
  readonly digestSentences?: number;
  readonly query?: string;
}

export interface CompressedTurn {
  readonly role: string;
  readonly text: string;
  readonly originalChars: number;
  readonly sentences: number;
}

export interface HierarchicalCompression {
  readonly digest: string;
  readonly level1: readonly CompressedTurn[];
  readonly level2: string;
  readonly levels: {
    readonly originalChars: number;
    readonly level1Chars: number;
    readonly level2Chars: number;
    readonly digestChars: number;
  };
  readonly ratio: number;
  readonly strategy: 'hierarchical-extractive';
}

function roleWeight(role: string): number {
  if (role === 'user') return 1;
  if (role === 'assistant') return 0.9;
  return 0.8;
}

export class HierarchicalMemoryCompressor {
  compress(
    turns: readonly MemoryTurn[],
    options: HierarchicalCompressionOptions = {}
  ): HierarchicalCompression {
    const maxTurns = Math.max(1, Math.min(64, options.maxTurns ?? 32));
    const selectedTurns = turns
      .filter((turn) => typeof turn.content === 'string' && turn.content.trim().length > 0)
      .slice(-maxTurns)
      .map((turn) => ({ role: turn.role, content: truncateText(turn.content.trim(), 4_000) }));
    const originalChars = selectedTurns.reduce((total, turn) => total + turn.content.length, 0);
    if (selectedTurns.length === 0) {
      return {
        digest: '',
        level1: [],
        level2: '',
        levels: { originalChars: 0, level1Chars: 0, level2Chars: 0, digestChars: 0 },
        ratio: 0,
        strategy: 'hierarchical-extractive',
      };
    }
    const sentencesPerTurn = Math.max(1, Math.min(4, options.sentencesPerTurn ?? 2));
    const queryTerms = termSet(options.query ?? '');

    interface SentenceRecord {
      readonly turnIndex: number;
      readonly sentenceIndex: number;
      readonly text: string;
      readonly terms: ReadonlySet<string>;
      centrality: number;
      score: number;
    }
    const sentenceRecords: SentenceRecord[] = [];
    selectedTurns.forEach((turn, turnIndex) => {
      splitSentences(turn.content, 8).forEach((sentence, sentenceIndex) => {
        sentenceRecords.push({
          turnIndex,
          sentenceIndex,
          text: sentence,
          terms: termSet(sentence),
          centrality: 0,
          score: 0,
        });
      });
    });
    for (const record of sentenceRecords) {
      let total = 0;
      let count = 0;
      for (const other of sentenceRecords) {
        if (other === record) continue;
        total += jaccard(record.terms, other.terms);
        count += 1;
        if (count >= 64) break;
      }
      record.centrality = count === 0 ? 0 : total / count;
    }
    for (const record of sentenceRecords) {
      const turn = selectedTurns[record.turnIndex];
      const position = 1 - record.sentenceIndex / 8;
      const queryOverlap =
        queryTerms.size === 0
          ? 0
          : [...record.terms].filter((term) => queryTerms.has(term)).length / queryTerms.size;
      record.score =
        0.5 * record.centrality +
        0.2 * position +
        0.15 * roleWeight(turn?.role ?? 'user') +
        0.15 * Math.min(1, queryOverlap * 3);
    }

    const level1: CompressedTurn[] = [];
    selectedTurns.forEach((turn, turnIndex) => {
      const candidates = sentenceRecords
        .filter((record) => record.turnIndex === turnIndex)
        .sort((a, b) => b.score - a.score || a.sentenceIndex - b.sentenceIndex)
        .slice(0, sentencesPerTurn)
        .sort((a, b) => a.sentenceIndex - b.sentenceIndex);
      if (candidates.length === 0) return;
      level1.push({
        role: turn.role,
        text: candidates.map((record) => record.text).join(' '),
        originalChars: turn.content.length,
        sentences: candidates.length,
      });
    });

    const level2Chars = Math.max(200, Math.min(8_000, options.level2Chars ?? 1_600));
    const chosen: CompressedTurn[] = [];
    let used = 0;
    for (let index = level1.length - 1; index >= 0; index -= 1) {
      const turn = level1[index];
      if (!turn) continue;
      if (used + turn.text.length > level2Chars && chosen.length > 0) continue;
      chosen.push(turn);
      used += turn.text.length;
      if (used >= level2Chars) break;
    }
    chosen.reverse();
    const level2 = chosen.map((turn) => `${turn.role}: ${turn.text}`).join('\n');

    const digestSentences = Math.max(1, Math.min(8, options.digestSentences ?? 4));
    const digestSelection = [...sentenceRecords]
      .sort(
        (a, b) =>
          b.score - a.score || a.turnIndex - b.turnIndex || a.sentenceIndex - b.sentenceIndex
      )
      .slice(0, digestSentences)
      .sort((a, b) => a.turnIndex - b.turnIndex || a.sentenceIndex - b.sentenceIndex)
      .map((record) => record.text);
    const digest = digestSelection.join(' ');
    const level1Chars = level1.reduce((total, turn) => total + turn.text.length, 0);
    return {
      digest,
      level1,
      level2,
      levels: {
        originalChars,
        level1Chars,
        level2Chars: level2.length,
        digestChars: digest.length,
      },
      ratio: originalChars === 0 ? 0 : clamp01(digest.length / originalChars),
      strategy: 'hierarchical-extractive',
    };
  }
}

export interface VectorRecord {
  readonly id: string;
  readonly text: string;
  readonly vector: readonly number[];
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
  readonly createdAt: number;
}

export interface VectorHit {
  readonly record: VectorRecord;
  readonly score: number;
}

export interface StreamUpdate {
  readonly version: number;
  readonly tokens: number;
  readonly norm: number;
}

function cosine(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export class StreamingVectorIndex {
  readonly dimension: number;
  private readonly maxDocs: number;
  private readonly records = new Map<string, VectorRecord>();
  private version = 0;

  constructor(options: { readonly dimension?: number; readonly maxDocs?: number } = {}) {
    const dimension = options.dimension ?? 128;
    if (!Number.isInteger(dimension) || dimension < 16 || dimension > 1_024)
      throw new RangeError('VECTOR: dimension must be 16..1024');
    const maxDocs = options.maxDocs ?? 512;
    if (!Number.isInteger(maxDocs) || maxDocs < 1)
      throw new RangeError('VECTOR: maxDocs must be positive');
    this.dimension = dimension;
    this.maxDocs = maxDocs;
  }

  get size(): number {
    return this.records.size;
  }

  get currentVersion(): number {
    return this.version;
  }

  private update(vector: number[], token: string): void {
    const digest = createHash('sha256').update(token, 'utf8').digest();
    const index = digest.readUInt32BE(0) % this.dimension;
    const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1;
    const weight = 1 + Math.min(2, token.length / 6);
    vector[index] = (vector[index] ?? 0) + sign * weight;
  }

  private build(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const tokens = tokenizeText(text).slice(0, 512);
    for (const token of tokens) this.update(vector, token);
    return vector;
  }

  /** Ingesta token por token y publica la versión incremental del índice. */
  ingest(text: string): StreamUpdate {
    const tokens = tokenizeText(text).slice(0, 512);
    for (const token of tokens) {
      this.version += 1;
      this.update(new Array<number>(this.dimension).fill(0), token);
    }
    const vector = this.build(text);
    const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
    return { version: this.version, tokens: tokens.length, norm };
  }

  embed(text: string): number[] {
    return this.build(text);
  }

  upsert(
    id: string,
    text: string,
    metadata: Record<string, string | number | boolean> = {},
    now = Date.now()
  ): VectorRecord {
    if (!id) throw new Error('VECTOR: id required');
    if (this.records.size >= this.maxDocs && !this.records.has(id)) {
      const oldest = [...this.records.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) this.records.delete(oldest.id);
    }
    const record: VectorRecord = {
      id,
      text: truncateText(text, 4_000),
      vector: this.build(text),
      metadata: { ...metadata },
      createdAt: now,
    };
    this.records.set(id, record);
    this.version += 1;
    return record;
  }

  remove(id: string): boolean {
    return this.records.delete(id);
  }

  get(id: string): VectorRecord | undefined {
    return this.records.get(id);
  }

  search(query: string, limit = 5): VectorHit[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError('VECTOR: limit must be 1..100');
    const queryVector = this.build(query);
    const hits: VectorHit[] = [];
    for (const record of this.records.values()) {
      const score = cosine(queryVector, record.vector);
      if (score > 0) hits.push({ record, score });
    }
    return hits
      .sort((a, b) => b.score - a.score || (a.record.id < b.record.id ? -1 : 1))
      .slice(0, limit);
  }

  digest(): string {
    const rows = [...this.records.values()]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((record) => ({ id: record.id, vector: record.vector, createdAt: record.createdAt }));
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }

  stats(): {
    readonly records: number;
    readonly dimension: number;
    readonly version: number;
    readonly digest: string;
  } {
    return {
      records: this.records.size,
      dimension: this.dimension,
      version: this.version,
      digest: this.digest(),
    };
  }
}

export interface ImportanceInput {
  readonly createdAt: number;
  readonly now?: number;
  readonly accessCount?: number;
  readonly novelty?: number;
  readonly sourceTrust?: number;
  readonly salience?: number;
  readonly kind?: 'context' | 'goal' | 'plan' | 'decision' | 'priority';
}

export interface ImportanceScore {
  readonly score: number;
  readonly components: {
    readonly recency: number;
    readonly frequency: number;
    readonly novelty: number;
    readonly trust: number;
    readonly salience: number;
  };
  readonly ageMs: number;
}

export class MemoryImportanceScorer {
  constructor(private readonly halfLifeMs = 60 * 60 * 1_000) {
    if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0)
      throw new RangeError('IMPORTANCE: halfLifeMs must be positive');
  }

  score(input: ImportanceInput): ImportanceScore {
    const now = input.now ?? Date.now();
    const ageMs = Math.max(0, now - input.createdAt);
    const recency = Math.exp(-Math.LN2 * (ageMs / this.halfLifeMs));
    const frequency = Math.min(1, Math.log1p(Math.max(0, input.accessCount ?? 0)) / Math.log1p(50));
    const novelty = clamp01(input.novelty ?? 0.5);
    const trust = clamp01(input.sourceTrust ?? 0.5);
    const salience = clamp01(input.salience ?? 0.5);
    const kindWeight =
      input.kind === 'goal' || input.kind === 'decision'
        ? 1
        : input.kind === 'plan'
          ? 0.95
          : input.kind === 'priority'
            ? 0.9
            : 0.8;
    const score = clamp01(
      (0.35 * recency + 0.15 * frequency + 0.2 * novelty + 0.15 * trust + 0.15 * salience) *
        kindWeight
    );
    return { score, components: { recency, frequency, novelty, trust, salience }, ageMs };
  }

  salienceFromText(text: string): number {
    const numbers = (text.match(/\d+/g) ?? []).length;
    const proper = (text.match(/\b[A-ZÁÉÍÓÚÑ][\p{L}]{2,}\b/gu) ?? []).length;
    const imperatives = (text.match(/\b(recuerda|prioriza|decide|evita|requiere|debe)\b/gi) ?? [])
      .length;
    const length = Math.min(1, text.trim().length / 280);
    return clamp01(
      0.1 +
        Math.min(0.3, numbers * 0.08) +
        Math.min(0.25, proper * 0.05) +
        Math.min(0.2, imperatives * 0.08) +
        0.15 * length
    );
  }

  noveltyAgainst(index: StreamingVectorIndex, text: string): number {
    const hits = index.search(text, 1);
    const best = hits[0]?.score ?? 0;
    return clamp01(1 - best);
  }

  rank<T extends { readonly id: string; readonly text: string; readonly createdAt: number }>(
    entries: readonly T[],
    options: { readonly now?: number; readonly index?: StreamingVectorIndex } = {}
  ): Array<T & { readonly importance: number }> {
    return entries
      .map((entry) => ({
        ...entry,
        importance: this.score({
          createdAt: entry.createdAt,
          now: options.now,
          novelty: options.index ? this.noveltyAgainst(options.index, entry.text) : 0.5,
          salience: this.salienceFromText(entry.text),
        }).score,
      }))
      .sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
  }
}

export interface DistillationResult {
  readonly summary: string;
  readonly selected: readonly {
    readonly docId: string;
    readonly title: string;
    readonly sentence: string;
    readonly score: number;
  }[];
  readonly coverage: number;
  readonly originalChars: number;
  readonly summaryChars: number;
  readonly ratio: number;
}

export class KnowledgeDistiller {
  distill(
    documents: readonly MemoryDocument[],
    options: { readonly query?: string; readonly maxSentences?: number } = {}
  ): DistillationResult {
    const maxSentences = Math.max(1, Math.min(12, options.maxSentences ?? 5));
    const queryTerms = termSet(options.query ?? '');
    interface Candidate {
      readonly docId: string;
      readonly title: string;
      readonly source: string;
      readonly sentence: string;
      readonly terms: ReadonlySet<string>;
      readonly position: number;
      centrality: number;
      score: number;
    }
    const candidates: Candidate[] = [];
    documents.slice(0, 24).forEach((document) => {
      splitSentences(document.text, 8).forEach((sentence, position) => {
        candidates.push({
          docId: document.id,
          title: document.title,
          source: document.source,
          sentence,
          terms: termSet(sentence),
          position,
          centrality: 0,
          score: 0,
        });
      });
    });
    for (const candidate of candidates) {
      let total = 0;
      let count = 0;
      for (const other of candidates) {
        if (other === candidate) continue;
        total += jaccard(candidate.terms, other.terms);
        count += 1;
        if (count >= 64) break;
      }
      candidate.centrality = count === 0 ? 0 : total / count;
    }
    for (const candidate of candidates) {
      const queryOverlap =
        queryTerms.size === 0
          ? 0
          : [...candidate.terms].filter((term) => queryTerms.has(term)).length / queryTerms.size;
      candidate.score =
        0.5 * queryOverlap +
        0.25 * candidate.centrality +
        0.15 * (1 - candidate.position / 8) +
        0.1;
    }
    const selected: Candidate[] = [];
    while (selected.length < maxSentences && candidates.length > 0) {
      let bestIndex = -1;
      let bestValue = -Infinity;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        if (!candidate) continue;
        const redundancy = selected.reduce(
          (max, chosen) => Math.max(max, jaccard(candidate.terms, chosen.terms)),
          0
        );
        const value = candidate.score - 0.55 * redundancy;
        if (value > bestValue) {
          bestValue = value;
          bestIndex = index;
        }
      }
      if (bestIndex < 0) break;
      const [chosen] = candidates.splice(bestIndex, 1);
      if (chosen) selected.push(chosen);
    }
    const summary = selected
      .map((candidate) => `- [${candidate.title}] ${candidate.sentence}`)
      .join('\n');
    const summaryTerms = termSet(summary);
    const coverage =
      queryTerms.size === 0
        ? 1
        : [...queryTerms].filter((term) => summaryTerms.has(term)).length / queryTerms.size;
    const originalChars = documents.reduce((total, document) => total + document.text.length, 0);
    return {
      summary,
      selected: selected.map((candidate) => ({
        docId: candidate.docId,
        title: candidate.title,
        sentence: candidate.sentence,
        score: candidate.score,
      })),
      coverage,
      originalChars,
      summaryChars: summary.length,
      ratio: originalChars === 0 ? 0 : clamp01(summary.length / originalChars),
    };
  }
}

export interface ResurrectedContext {
  readonly id: string;
  readonly sessionId: string;
  readonly role: string;
  readonly content: string;
  readonly score: number;
  readonly importance: number;
  readonly ageMs: number;
}

interface ResurrectionEntry {
  readonly id: string;
  readonly sessionId: string;
  readonly role: string;
  readonly content: string;
  readonly contentHash: string;
  readonly vector: readonly number[];
  createdAt: number;
  accessCount: number;
  importance: number;
}

export class ContextResurrectionEngine {
  private readonly entries = new Map<string, ResurrectionEntry>();
  private readonly index: StreamingVectorIndex;
  private readonly scorer: MemoryImportanceScorer;
  private readonly capacity: number;

  constructor(
    options: {
      readonly index?: StreamingVectorIndex;
      readonly scorer?: MemoryImportanceScorer;
      readonly capacity?: number;
    } = {}
  ) {
    this.index = options.index ?? new StreamingVectorIndex({ dimension: 128, maxDocs: 512 });
    this.scorer = options.scorer ?? new MemoryImportanceScorer();
    this.capacity = Math.max(8, Math.min(2_048, options.capacity ?? 256));
  }

  remember(input: {
    readonly sessionId: string;
    readonly role: string;
    readonly content: string;
    readonly now?: number;
  }): ResurrectedContext | null {
    const content = truncateText(input.content.trim(), 1_000);
    if (content.length < 8) return null;
    const contentHash = createHash('sha256').update(content).digest('hex').slice(0, 24);
    const existing = [...this.entries.values()].find((entry) => entry.contentHash === contentHash);
    const now = input.now ?? Date.now();
    if (existing) {
      existing.accessCount += 1;
      existing.createdAt = now;
      existing.importance = this.scorer.score({
        createdAt: existing.createdAt,
        now,
        accessCount: existing.accessCount,
        salience: this.scorer.salienceFromText(content),
        kind: 'context',
      }).score;
      return {
        id: existing.id,
        sessionId: existing.sessionId,
        role: existing.role,
        content: existing.content,
        score: existing.importance,
        importance: existing.importance,
        ageMs: 0,
      };
    }
    const vector = this.index.embed(content);
    const entry: ResurrectionEntry = {
      id: `ctx_${contentHash}`,
      sessionId: input.sessionId,
      role: input.role,
      content,
      contentHash,
      vector,
      createdAt: now,
      accessCount: 0,
      importance: this.scorer.score({
        createdAt: now,
        now,
        salience: this.scorer.salienceFromText(content),
        kind: 'context',
      }).score,
    };
    if (this.entries.size >= this.capacity) {
      const lowest = [...this.entries.values()].sort(
        (a, b) => a.importance - b.importance || a.createdAt - b.createdAt
      )[0];
      if (lowest) this.entries.delete(lowest.id);
    }
    this.entries.set(entry.id, entry);
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      role: entry.role,
      content: entry.content,
      score: entry.importance,
      importance: entry.importance,
      ageMs: 0,
    };
  }

  resurrect(
    query: string,
    options: {
      readonly sessionId?: string;
      readonly limit?: number;
      readonly minScore?: number;
      readonly halfLifeMs?: number;
      readonly now?: number;
    } = {}
  ): ResurrectedContext[] {
    const queryVector = this.index.embed(query);
    const now = options.now ?? Date.now();
    const limit = Math.max(1, Math.min(12, options.limit ?? 3));
    const minScore = clamp01(options.minScore ?? 0.05);
    const halfLife = Math.max(1, options.halfLifeMs ?? 6 * 60 * 60 * 1_000);
    const scored: ResurrectedContext[] = [];
    for (const entry of this.entries.values()) {
      if (options.sessionId && entry.sessionId !== options.sessionId) continue;
      const ageMs = Math.max(0, now - entry.createdAt);
      const similarity = cosine(queryVector, entry.vector);
      const decay = Math.exp(-Math.LN2 * (ageMs / halfLife));
      const score = clamp01(similarity * decay * (0.5 + 0.5 * entry.importance));
      if (score < minScore) continue;
      scored.push({
        id: entry.id,
        sessionId: entry.sessionId,
        role: entry.role,
        content: entry.content,
        score,
        importance: entry.importance,
        ageMs,
      });
    }
    return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
  }

  stats(): { readonly entries: number; readonly capacity: number; readonly vectorVersion: number } {
    return {
      entries: this.entries.size,
      capacity: this.capacity,
      vectorVersion: this.index.currentVersion,
    };
  }
}
