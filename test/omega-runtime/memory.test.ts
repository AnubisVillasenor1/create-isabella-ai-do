import { describe, expect, it } from "vitest";
import {
  ContextResurrectionEngine,
  HierarchicalMemoryCompressor,
  KnowledgeDistiller,
  MemoryImportanceScorer,
  StreamingVectorIndex,
} from "../../src/omega-runtime/memory";

describe("ΩX-06 hierarchical memory compression", () => {
  const compressor = new HierarchicalMemoryCompressor();

  it("compresses conversation turns into bounded extractive levels", () => {
    const turns = [
      { role: "user", content: "Necesito entender la gobernanza de la memoria local. ¿Cómo se conserva la evidencia?" },
      { role: "assistant", content: "La memoria local conserva evidencia bajo gobernanza. Cada decisión deja una traza auditable." },
      { role: "user", content: "¿Y qué ocurre cuando el nodo se reinicia?" },
      { role: "assistant", content: "La sesión se reconstruye desde el almacenamiento local. No se inventan recuerdos ausentes." },
    ];
    const result = compressor.compress(turns, { maxTurns: 4, sentencesPerTurn: 1, digestSentences: 2 });
    expect(result.level1).toHaveLength(4);
    expect(result.digest.length).toBeGreaterThan(0);
    expect(result.level2).toContain("user:");
    expect(result.levels.originalChars).toBeGreaterThan(result.levels.digestChars);
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThanOrEqual(1);
  });

  it("returns an empty structure for no turns", () => {
    const result = compressor.compress([]);
    expect(result.digest).toBe("");
    expect(result.level1).toEqual([]);
    expect(result.ratio).toBe(0);
  });
});

describe("ΩX-13 real-time vector streaming", () => {
  it("indexes documents and retrieves the most similar one", () => {
    const index = new StreamingVectorIndex({ dimension: 128, maxDocs: 16 });
    index.upsert("plans", "Planes, precios, pagos y suscripciones con Stripe");
    index.upsert("privacy", "Privacidad del historial y datos de la conversación");
    const hits = index.search("precios y pagos con Stripe", 2);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.record.id).toBe("plans");
    expect(hits[0]?.score).toBeGreaterThan(0);
    expect(index.currentVersion).toBeGreaterThanOrEqual(2);
    expect(index.stats()).toMatchObject({ records: 2, dimension: 128 });
  });

  it("evicts the oldest record when capacity is reached", () => {
    const index = new StreamingVectorIndex({ dimension: 32, maxDocs: 2 });
    index.upsert("a", "memoria", {}, 1);
    index.upsert("b", "gobernanza", {}, 2);
    index.upsert("c", "evidencia", {}, 3);
    expect(index.size).toBe(2);
    expect(index.get("a")).toBeUndefined();
    expect(index.get("c")).toBeDefined();
  });
});

describe("ΩX-14 memory importance scoring", () => {
  it("rewards recency, access frequency and salience", () => {
    const scorer = new MemoryImportanceScorer(60_000);
    const fresh = scorer.score({
      createdAt: 200_000,
      now: 200_000,
      accessCount: 20,
      novelty: 0.9,
      sourceTrust: 0.9,
      salience: 0.9,
      kind: "decision",
    });
    const stale = scorer.score({
      createdAt: 0,
      now: 200_000,
      accessCount: 0,
      novelty: 0.1,
      sourceTrust: 0.1,
      salience: 0.1,
      kind: "context",
    });
    expect(fresh.score).toBeGreaterThan(stale.score);
    expect(fresh.components.recency).toBe(1);
    expect(stale.components.recency).toBeLessThan(0.3);
  });

  it("turns numbers, proper nouns and imperatives into salience", () => {
    const scorer = new MemoryImportanceScorer();
    const low = scorer.salienceFromText("texto general sin marcas");
    const high = scorer.salienceFromText("Recuerda que Isabella debe priorizar 3 objetivos en Madrid.");
    expect(high).toBeGreaterThan(low);
  });
});

describe("ΩX-15 autonomous knowledge distillation", () => {
  it("selects query-relevant, non-redundant sentences", () => {
    const distiller = new KnowledgeDistiller();
    const result = distiller.distill(
      [
        {
          id: "plans",
          title: "Planes",
          text: "Los planes usan Stripe para pagos y suscripciones. La facturación se registra por separado.",
          source: "docs/plans",
        },
        {
          id: "privacy",
          title: "Privacidad",
          text: "El historial permanece en el navegador. No se indexan archivos personales.",
          source: "docs/privacy",
        },
      ],
      { query: "stripe pagos", maxSentences: 2 },
    );
    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.selected[0]?.sentence).toMatch(/Stripe|pagos|suscripciones/i);
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.summaryChars).toBeLessThan(result.originalChars);
  });
});

describe("ΩX-16 context resurrection", () => {
  it("remembers and resurrects relevant context with decay", () => {
    const engine = new ContextResurrectionEngine({ capacity: 8 });
    const remembered = engine.remember({
      sessionId: "s1",
      role: "assistant",
      content: "La memoria ejecutiva conserva decisiones y prioridades con una cadena de hashes.",
      now: 1_000,
    });
    expect(remembered).not.toBeNull();
    const hits = engine.resurrect("decisiones y prioridades de la memoria", {
      sessionId: "s1",
      now: 2_000,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.content).toContain("memoria ejecutiva");
    expect(hits[0]?.score).toBeGreaterThan(0);
    expect(engine.resurrect("decisiones", { sessionId: "other", now: 2_000 })).toEqual([]);
  });

  it("deduplicates identical content and tracks access", () => {
    const engine = new ContextResurrectionEngine({ capacity: 8 });
    const input = { sessionId: "s1", role: "user", content: "Recuerda la política de evidencia local." };
    const first = engine.remember({ ...input, now: 1_000 });
    const second = engine.remember({ ...input, now: 2_000 });
    expect(second?.id).toBe(first?.id);
    expect(engine.stats().entries).toBe(1);
  });
});
