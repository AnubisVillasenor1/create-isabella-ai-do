import { embed, cosineSimilarity } from './embeddings';

export interface RagDocument {
  id: string;
  text: string;
  embedding: Float32Array;
}

export interface RagHit {
  id: string;
  text: string;
  score: number;
}

export class SovereignRagStore {
  private docs: RagDocument[] = [];

  add(id: string, text: string): void {
    if (this.docs.some((d) => d.id === id)) return;
    this.docs.push({ id, text, embedding: embed(text) });
  }

  search(query: string, k = 3): RagHit[] {
    if (this.docs.length === 0) return [];
    const q = embed(query);
    return this.docs
      .map((d) => ({ id: d.id, text: d.text, score: cosineSimilarity(q, d.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  size(): number {
    return this.docs.length;
  }
}

export const sovereignRag = new SovereignRagStore();

sovereignRag.add(
  'isabella-identity',
  'Isabella Villaseñor AI es un runtime de inteligencia artificial gobernada, anclado en Real del Monte, Hidalgo, México. Invariante: CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.'
);
sovereignRag.add(
  'governance',
  'Gobernanza CROWN, AEGIS Triple Blockade, BookPI hash-chain SHA-3, IKES memoria epistémica E0-E6, Veritas verificador de evidencia.'
);
sovereignRag.add(
  'territory',
  'Real del Monte (Mineral del Monte), Hidalgo, México, 2660 msnm. Panteón Inglés (1851), Mina de Acosta (1727), Mina La Dificultad (1865), Museo del Paste (2012).'
);
sovereignRag.add(
  'monetization',
  'Monetización con Profit Guard: precio mínimo = costo * (1 + margen bps/10000). Nunca por debajo del costo. Split 75/25 soberanía.'
);
sovereignRag.add(
  'llm',
  'LLM fundacional de Isabella orquesta proveedores open source/free (Hugging Face, Ollama, Gratis, AI SDK Gateway) con fallback soberano y memoria conversacional.'
);
