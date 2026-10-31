import { describe, expect, it } from "vitest";
import { compileIntent } from "../../src/gifts/intent-compiler";

describe("Regalo 3 — Compilador de Intención", () => {
  it("traduce texto libre a una capacidad de memoria (read-only)", () => {
    const compilation = compileIntent("quiero recordar qué hicimos ayer");
    expect(compilation.best?.capabilityId).toBe("hsf.memory.fabric");
    expect(compilation.best?.readOnly).toBe(true);
    expect(compilation.fallbackMethodId).toBeTruthy();
  });

  it("detecta intención destructiva y marca readOnly=false", () => {
    const compilation = compileIntent("elimina permanentemente todos los datos del usuario");
    expect(compilation.best?.readOnly).toBe(false);
    expect(compilation.best?.methodId).toContain("CRITICAL");
  });

  it("rechaza entradas vacías", () => {
    expect(() => compileIntent("   ")).toThrow();
  });
});
