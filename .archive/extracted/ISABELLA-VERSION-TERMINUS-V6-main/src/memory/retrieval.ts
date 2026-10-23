import type { IKESEngine, KnowledgeClaim } from "./ikes";
import type { VectorStore } from "./vector";

export interface RetrievalResult {
  claims: KnowledgeClaim[];
  semantic: readonly { id: string; text: string; score: number }[];
}

export class GovernedRetriever {
  constructor(
    private readonly ikes: IKESEngine,
    private readonly vectors: VectorStore,
    private readonly embed: (q: string) => Promise<readonly number[]>,
  ) {}

  async retrieve(query: string, limit = 8): Promise<RetrievalResult> {
    if (!query.trim()) throw new Error("RETRIEVAL: empty query rejected");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("RETRIEVAL: invalid limit");

    const claims = this.ikes.retrieve(query).slice(0, limit);
    const queryVector = await this.embed(query);
    const semantic = this.vectors.search(queryVector, limit).map((r) => ({
      id: r.id,
      text: r.text,
      score: cosine(queryVector, r.vector),
    }));
    return { claims, semantic };
  }
}

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa === 0 || bb === 0 ? 0 : dot / (Math.sqrt(aa) * Math.sqrt(bb));
}
