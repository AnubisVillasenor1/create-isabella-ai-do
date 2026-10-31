// state: draft | engine-generated
//
// Retrieval ranking. There is a graphRAG helper but no classical lexical ranker,
// so simple "which documents match this query" needs had no native answer. This
// is TF-IDF with cosine similarity and a stable top-K, using the smooth/standard
// IDF formulation. Ranking quality is measured, not asserted; relevance is not
// truth, and provenance still governs what a cited passage may be used for.

export interface TfidfIndex {
  readonly vocab: readonly string[];
  readonly vectors: readonly (readonly number[])[];
  readonly idf: readonly number[];
  readonly docIds: readonly string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9áéíóúüñ]+/u)
    .filter((t) => t.length > 1);
}

function termFreq(tokens: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Build a TF-IDF index over (docId, text) pairs. Vocab is lexicographic. */
export function buildTfidfIndex(docs: readonly { id: string; text: string }[]): TfidfIndex {
  if (docs.length === 0) throw new Error('empty_corpus');
  const tokenized = docs.map((d) => termFreq(tokenize(d.text)));
  const vocabSet = new Set<string>();
  for (const tf of tokenized) for (const term of tf.keys()) vocabSet.add(term);
  const vocab = [...vocabSet].sort();
  const index = new Map<string, number>();
  vocab.forEach((t, i) => index.set(t, i));
  // Standard smoothed IDF: ln(N / df) + 1.
  const idf = vocab.map(() => 0);
  for (let j = 0; j < vocab.length; j++) {
    let df = 0;
    for (const tf of tokenized) if (tf.has(vocab[j]!)) df++;
    idf[j] = Math.log(docs.length / Math.max(1, df)) + 1;
  }
  const vectors = tokenized.map((tf) => {
    const vec = new Array<number>(vocab.length).fill(0);
    for (const [term, count] of tf.entries()) {
      const j = index.get(term)!;
      vec[j] = (1 + Math.log(count)) * idf[j]!;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  });
  return { vocab, vectors, idf, docIds: docs.map((d) => d.id) };
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot; // vectors are unit-normalized
}

export interface RankedDoc {
  id: string;
  score: number;
}

/** Rank corpus documents against a query, returning the top K by score. */
export function rankQuery(index: TfidfIndex, query: string, k = 5): RankedDoc[] {
  if (!Number.isInteger(k) || k < 1) throw new Error('invalid_k');
  const tf = termFreq(tokenize(query));
  const vec = new Array<number>(index.vocab.length).fill(0);
  for (const [term, count] of tf.entries()) {
    const j = index.vocab.indexOf(term);
    if (j >= 0) vec[j] = (1 + Math.log(count)) * index.idf[j]!;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return [];
  const q = vec.map((v) => v / norm);
  const scored = index.vectors
    .map((dv, i) => ({ id: index.docIds[i]!, score: cosine(q, dv) }))
    .filter((d) => d.score > 0)
    // Deterministic: score desc, then id asc to break ties stably.
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return scored.slice(0, k);
}
