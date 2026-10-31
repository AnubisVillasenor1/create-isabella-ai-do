/**
 * Índice léxico BM25 + fusión de rankings RRF (state: draft | engine-generated).
 *
 * Recuperación determinista y auditable, sin embeddings ni red: tokenización en español/inglés (minúsculas,
 * sin diacríticos, stopwords, singularización ligera), BM25 (k1=1.5, b=0.75) y Reciprocal Rank Fusion para
 * combinar con otros rankers. Acotado: máximo de documentos y de tokens por documento.
 */
const STOPWORDS = new Set(
  (
    'a al algo ante con contra cual cuando de del desde donde durante e el ella ellos en entre era es esta este esto ' +
    'fue ha han hasta la las le les lo los me mi mis muy ni no nos o para pero por que se si sin sobre su sus te tu un una uno y ya ' +
    'the and for are but not you all any can had her was one our out has have this that with from they will what when your'
  ).split(' ')
);

export function tokenize(text: string): string[] {
  const norm = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const out: string[] = [];
  for (const raw of norm.split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    // singularización ligera: "reglas"→"regla", "acciones"→"accion"
    const t =
      raw.length > 4 && raw.endsWith('es')
        ? raw.slice(0, -2)
        : raw.length > 3 && raw.endsWith('s')
          ? raw.slice(0, -1)
          : raw;
    out.push(t);
  }
  return out;
}

export interface Bm25Hit {
  readonly id: string;
  readonly score: number;
}

export class Bm25Index {
  private readonly postings = new Map<string, Map<string, number>>();
  private readonly lengths = new Map<string, number>();
  private totalLength = 0;

  constructor(
    private readonly maxDocs = 100_000,
    private readonly maxTokensPerDoc = 20_000,
    private readonly k1 = 1.5,
    private readonly b = 0.75
  ) {
    if (
      !Number.isInteger(maxDocs) ||
      maxDocs < 1 ||
      !Number.isInteger(maxTokensPerDoc) ||
      maxTokensPerDoc < 1
    )
      throw new RangeError('BM25: invalid bounds');
  }

  get size(): number {
    return this.lengths.size;
  }

  add(id: string, text: string): void {
    if (typeof id !== 'string' || id.length === 0) throw new RangeError('BM25: id required');
    if (this.lengths.has(id)) this.remove(id);
    else if (this.lengths.size >= this.maxDocs) throw new RangeError('BM25: index is full');
    const tokens = tokenize(text).slice(0, this.maxTokensPerDoc);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      let p = this.postings.get(t);
      if (p === undefined) {
        p = new Map();
        this.postings.set(t, p);
      }
      p.set(id, n);
    }
    this.lengths.set(id, tokens.length);
    this.totalLength += tokens.length;
  }

  remove(id: string): boolean {
    const len = this.lengths.get(id);
    if (len === undefined) return false;
    for (const [t, p] of this.postings) {
      if (p.delete(id) && p.size === 0) this.postings.delete(t);
    }
    this.lengths.delete(id);
    this.totalLength -= len;
    return true;
  }

  search(query: string, k = 10): Bm25Hit[] {
    if (!Number.isInteger(k) || k < 1 || k > 1000) throw new RangeError('BM25: k must be 1..1000');
    const n = this.lengths.size;
    if (n === 0) return [];
    const avg = this.totalLength / n || 1;
    const scores = new Map<string, number>();
    for (const term of new Set(tokenize(query))) {
      const p = this.postings.get(term);
      if (p === undefined) continue;
      const idf = Math.log(1 + (n - p.size + 0.5) / (p.size + 0.5));
      for (const [id, tf] of p) {
        const len = this.lengths.get(id) ?? 0;
        scores.set(
          id,
          (scores.get(id) ?? 0) +
            idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + (this.b * len) / avg)))
        );
      }
    }
    return [...scores]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
      .slice(0, k);
  }
}

/** Reciprocal Rank Fusion (Cormack et al., 2009): score = Σ 1/(k + rank). Determinista ante empates. */
export function reciprocalRankFusion(rankings: readonly (readonly string[])[], k = 60): Bm25Hit[] {
  if (!(k > 0)) throw new RangeError('RRF: k must be positive');
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    const seen = new Set<string>();
    ranking.forEach((id, i) => {
      if (seen.has(id)) return;
      seen.add(id);
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}
