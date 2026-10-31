import { describe, expect, it } from "vitest";
import { LatinoGenesis, SEED_LATAM, SpanishNormalizer } from "../../src/linguistics";

describe("Latino Genesis linguistic core", () => {
  it("normalizes Spanish text without losing accents", () => {
    const normalizer = new SpanishNormalizer();
    expect(normalizer.clean("  ¡Ahorita   sí! ")).toBe("¡ahorita sí!");
    expect(normalizer.stripAccents("México canción")).toBe("Mexico cancion");
  });

  it("searches curated terms and detects context", () => {
    const genesis = new LatinoGenesis(SEED_LATAM);
    expect(genesis.search("CHAMBA")[0]?.country).toBe("MX");
    const result = genesis.analyze("Aguas con la chamba y la lana");
    expect(result.count).toBe(3);
    expect(result.contexts).toEqual(expect.arrayContaining(["warning", "work", "money"]));
  });

  it("deduplicates entries and rejects incomplete records", () => {
    const genesis = new LatinoGenesis();
    expect(genesis.ingest([{ term: "foo", meaning: "bar" }, { term: "foo", meaning: "bar" }])).toBe(2);
    expect(genesis.stats().totalTerms).toBe(1);
    expect(genesis.addTerm({ term: "sin significado" })).toBeNull();
  });

  it("keeps adult terms out of public search while retaining metadata", () => {
    const genesis = new LatinoGenesis([{ term: "contenido", meaning: "material explícito", category: "expresion" }]);
    expect(genesis.search("contenido")).toHaveLength(0);
    expect(genesis.stats().totalTerms).toBe(1);
  });
});
