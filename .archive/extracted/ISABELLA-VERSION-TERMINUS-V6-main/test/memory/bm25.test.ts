import { describe, expect, it } from "vitest";
import { Bm25Index, reciprocalRankFusion, tokenize } from "../../src/memory/bm25";

/** state: draft | engine-generated */
describe("tokenize", () => {
  it("normalizes accents, case, stopwords and plurals", () => {
    expect(tokenize("Las Acciones de Gobernanza, ¡ÁNGEL!")).toEqual(["accion", "gobernanza", "angel"]);
    expect(tokenize("a el la")).toEqual([]);
    expect(tokenize("x 12 ab")).toEqual(["12", "ab"]);
  });
});

describe("Bm25Index", () => {
  const idx = new Bm25Index();
  idx.add("d1", "La gobernanza territorial de Real del Monte exige consentimiento");
  idx.add("d2", "Receta de pastes: papa, carne y chile; tradición minera de Hidalgo");
  idx.add("d3", "Gobernanza gobernanza gobernanza sin contexto");
  idx.add("d4", "Auditoría de seguridad y registro de evidencia");

  it("ranks by relevance and is deterministic", () => {
    const hits = idx.search("pastes mineros tradición");
    expect(hits[0]?.id).toBe("d2");
    expect(idx.search("gobernanza territorial real")[0]?.id).toBe("d1");
    expect(idx.search("gobernanza territorial real")).toEqual(idx.search("gobernanza territorial real"));
  });
  it("returns [] for unknown terms/empty index and respects k", () => {
    expect(idx.search("zzzzqq")).toEqual([]);
    expect(new Bm25Index().search("x")).toEqual([]);
    expect(idx.search("gobernanza", 1)).toHaveLength(1);
    expect(() => idx.search("x", 0)).toThrow();
  });
  it("updates and removes documents consistently", () => {
    const i = new Bm25Index();
    i.add("a", "alpha beta");
    i.add("b", "beta gamma");
    i.add("a", "delta epsilon");
    expect(i.search("alpha")).toEqual([]);
    expect(i.search("delta")[0]?.id).toBe("a");
    expect(i.remove("b")).toBe(true);
    expect(i.remove("b")).toBe(false);
    expect(i.search("gamma")).toEqual([]);
    expect(i.size).toBe(1);
  });
  it("enforces bounds", () => {
    const i = new Bm25Index(2, 3);
    i.add("a", "uno dos tres cuatro cinco");
    i.add("b", "x1 x2");
    expect(() => i.add("c", "otro")).toThrow("full");
    expect(i.search("cinco")).toEqual([]); // truncado a 3 tokens
    expect(() => new Bm25Index(0)).toThrow();
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards agreement across rankers and is tie-stable", () => {
    const fused = reciprocalRankFusion([["a", "b", "c"], ["b", "a", "d"]]);
    expect(fused.map((h) => h.id).slice(0, 2)).toEqual(["a", "b"]);
    expect(fused).toHaveLength(4);
    expect(reciprocalRankFusion([["x", "x", "y"]]).map((h) => h.id)).toEqual(["x", "y"]);
    expect(() => reciprocalRankFusion([], 0)).toThrow();
  });
});
