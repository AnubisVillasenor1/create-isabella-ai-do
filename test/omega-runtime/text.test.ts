import { describe, expect, it } from "vitest";
import {
  clamp,
  clamp01,
  contentTerms,
  hashId,
  jaccard,
  normalizeText,
  splitSentences,
  stripDiacritics,
  termSet,
  tokenizeText,
  truncateText,
  unique,
} from "../../src/omega-runtime/text";

describe("Ω∞ deterministic text substrate", () => {
  it("removes diacritics and normalizes whitespace without changing meaning", () => {
    expect(stripDiacritics("Génesis Ω∞ cognición")).toBe("Genesis Ω∞ cognicion");
    expect(normalizeText("  La   MEMORIA   ejecutiva  ")).toBe("la memoria ejecutiva");
  });

  it("tokenizes Spanish text, drops stopwords and lightly singularizes plurals", () => {
    expect(tokenizeText("Las memorias de Isabella son seguras")).toEqual(["memoria", "isabella", "segura"]);
    expect(tokenizeText("memoria del sistema")).toEqual(["memoria", "sistema"]);
  });

  it("returns unique content terms with a hard limit", () => {
    const terms = contentTerms("memoria memoria gobernanza evidencia plataforma", 3);
    expect(terms).toEqual(["memoria", "gobernanza", "evidencia"]);
    expect(contentTerms("", 5)).toEqual([]);
  });

  it("splits sentences and keeps terminal punctuation", () => {
    expect(splitSentences("Primera frase. ¿Segunda frase? Tercera")).toEqual([
      "Primera frase.",
      "¿Segunda frase?",
      "Tercera",
    ]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("computes bounded Jaccard similarity", () => {
    const left = termSet("memoria gobernanza evidencia");
    const right = termSet("memoria gobernanza auditoria");
    expect(jaccard(left, right)).toBeCloseTo(0.5, 5);
    expect(jaccard(left, new Set())).toBe(0);
    expect(jaccard(left, left)).toBe(1);
  });

  it("produces deterministic identifiers with a bounded length", () => {
    expect(hashId("isabella", 16)).toBe(hashId("isabella", 16));
    expect(hashId("isabella", 16)).not.toBe(hashId("isabella-2", 16));
    expect(hashId("isabella", 16)).toMatch(/^[0-9a-f]{16}$/);
    expect(hashId("isabella", 2)).toHaveLength(8);
    expect(hashId("isabella", 99)).toHaveLength(32);
  });

  it("clamps numbers and truncates text without exceeding the limit", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(truncateText("abcdefghij", 5)).toBe("abcd…");
    expect(truncateText("abc", 5)).toBe("abc");
    expect(truncateText("abc", 0)).toBe("");
    expect(unique(["a", "b", "a"])).toEqual(["a", "b"]);
  });
});
