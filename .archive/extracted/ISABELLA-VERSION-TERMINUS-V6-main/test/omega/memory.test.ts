import { describe, expect, it } from "vitest";
import { OmniMemory } from "../../src/omega/memory";

describe("Ω∞-18 OmniMemory", () => {
  it("almacena y recupera un registro", () => {
    const memory = new OmniMemory(() => "2026-01-01T00:00:00.000Z");
    const stored = memory.store({ id: "m1", layer: "semantic", content: "hecho", importance: 0.5 });
    expect(stored.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(memory.get("m1")).toEqual(stored);
    expect(memory.size()).toBe(1);
  });

  it("rechaza identificadores duplicados", () => {
    const memory = new OmniMemory();
    memory.store({ id: "m1", layer: "episodic", content: "a", importance: 0.2 });
    expect(() => memory.store({ id: "m1", layer: "episodic", content: "b", importance: 0.3 })).toThrow("MEMORY_DUPLICATE_ID");
  });

  it("rechaza capas inválidas", () => {
    const memory = new OmniMemory();
    expect(() => memory.store({ id: "x", layer: "bad" as never, content: "a", importance: 0.1 })).toThrow("MEMORY_LAYER_INVALID");
  });

  it("rechaza importancias fuera de rango", () => {
    const memory = new OmniMemory();
    expect(() => memory.store({ id: "m1", layer: "episodic", content: "a", importance: 2 })).toThrow("MEMORY_IMPORTANCE_OUT_OF_RANGE");
    expect(() => memory.store({ id: "m2", layer: "episodic", content: "a", importance: -0.1 })).toThrow("MEMORY_IMPORTANCE_OUT_OF_RANGE");
  });

  it("filtra por capa", () => {
    const memory = new OmniMemory();
    memory.store({ id: "a", layer: "episodic", content: "x", importance: 0.5 });
    memory.store({ id: "b", layer: "semantic", content: "y", importance: 0.5 });
    expect(memory.query({ layers: ["semantic"] }).map((r) => r.id)).toEqual(["b"]);
  });

  it("filtra por importancia mínima", () => {
    const memory = new OmniMemory();
    memory.store({ id: "low", layer: "episodic", content: "a", importance: 0.1 });
    memory.store({ id: "high", layer: "episodic", content: "b", importance: 0.9 });
    expect(memory.query({ minImportance: 0.5 }).map((r) => r.id)).toEqual(["high"]);
  });

  it("filtra por texto sin distinguir mayúsculas y ordena por importancia", () => {
    const memory = new OmniMemory();
    memory.store({ id: "a", layer: "episodic", content: "Alpha", importance: 0.3 });
    memory.store({ id: "b", layer: "semantic", content: "ALPHABET", importance: 0.8 });
    memory.store({ id: "c", layer: "semantic", content: "otro", importance: 1 });
    expect(memory.query({ text: "alpha" }).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("aplica límite y lo valida", () => {
    const memory = new OmniMemory();
    memory.store({ id: "a", layer: "episodic", content: "x", importance: 0.9 });
    memory.store({ id: "b", layer: "episodic", content: "y", importance: 0.8 });
    expect(memory.query({ limit: 1 }).map((r) => r.id)).toEqual(["a"]);
    expect(() => memory.query({ limit: -1 })).toThrow("MEMORY_LIMIT_INVALID");
  });

  it("olvida un registro", () => {
    const memory = new OmniMemory();
    memory.store({ id: "m1", layer: "episodic", content: "x", importance: 0.5 });
    expect(memory.forget("m1")).toBe(true);
    expect(memory.forget("m1")).toBe(false);
    expect(memory.size()).toBe(0);
  });
});
