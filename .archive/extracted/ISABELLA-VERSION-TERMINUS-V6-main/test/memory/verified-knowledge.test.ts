import { describe, expect, it } from "vitest";
import { InMemoryVerifiedKnowledgeBackend, VerifiedKnowledgeStore, type ConfidenceLevel, formatVerifiedKnowledgeContext } from "../../src/memory/verified-knowledge";

describe("verified knowledge store", () => {
  it("stores and retrieves an admitted entry by id", async () => {
    const store = new VerifiedKnowledgeStore(new InMemoryVerifiedKnowledgeBackend());
    const entry = await store.addVerifiedKnowledge({
      content: "Real del Monte (Mineral del Monte) está a 2,660 msnm.",
      source: "INEGI",
      confidenceLevel: "E2",
    });
    expect(entry.id).toMatch(/^vkn-[a-f0-9]{12}$/);
    const found = await store.getVerifiedKnowledge(entry.id);
    expect(found?.source).toBe("INEGI");
    expect(found?.confidenceLevel).toBe("E2");
  });

  it("rejects invalid admission inputs", async () => {
    const store = new VerifiedKnowledgeStore(new InMemoryVerifiedKnowledgeBackend());
    await expect(store.addVerifiedKnowledge({ content: "   ", source: "s", confidenceLevel: "E0" }))
      .rejects.toThrow("content required");
    await expect(store.addVerifiedKnowledge({ content: "c", source: " ", confidenceLevel: "E0" }))
      .rejects.toThrow("source required");
    await expect(store.addVerifiedKnowledge({ content: "c", source: "s", confidenceLevel: "E9" as ConfidenceLevel }))
      .rejects.toThrow("confidenceLevel must be E0-E6");
  });

  it("ranks search hits by token coverage and filters by minConfidence", async () => {
    const store = new VerifiedKnowledgeStore(new InMemoryVerifiedKnowledgeBackend());
    await store.addVerifiedKnowledge({ content: "El Panteón Inglés de Real del Monte fue fundado en 1851.", source: "archivo", confidenceLevel: "E1" });
    await store.addVerifiedKnowledge({ content: "El paste es patrimonio gastronómico de Real del Monte.", source: "museo", confidenceLevel: "E4" });

    const hits = await store.searchVerifiedKnowledge("paste Real del Monte", { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.entry.confidenceLevel).toBe("E4");

    const filtered = await store.searchVerifiedKnowledge("paste Real del Monte", { minConfidence: "E3" });
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.entry.source).toBe("museo");
  });

  it("returns no hits for unrelated queries and validates the limit", async () => {
    const store = new VerifiedKnowledgeStore(new InMemoryVerifiedKnowledgeBackend());
    await store.addVerifiedKnowledge({ content: "Memoria epistemológica IKES.", source: "spec", confidenceLevel: "E0" });
    expect(await store.searchVerifiedKnowledge("zzzznoexist")) .toEqual([]);
    await expect(store.searchVerifiedKnowledge("memoria", { limit: 0 })).rejects.toThrow("limit");
  });

  it("formats context only when hits exist and truncates long excerpts", () => {
    expect(formatVerifiedKnowledgeContext([])).toBe("");
    const long = "x".repeat(600);
    const out = formatVerifiedKnowledgeContext([{ entry: { id: "vkn-1", content: long, source: "s", verifiedAt: "2026-01-01T00:00:00.000Z", confidenceLevel: "E5" }, score: 0.9 }]);
    expect(out).toContain("[E5 · s · 2026-01-01T00:00:00.000Z]");
    expect(out.slice(-1)).toBe("…");
  });
});