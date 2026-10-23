import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * state: draft | engine-generated.
 * Los grupos de rutas aceptan `authorizeAdmin` como OPCIONAL (abierto en desarrollo). Para que una
 * futura omisión no deje una superficie abierta en producción, TODO registro en server.ts debe
 * cablear explícitamente una compuerta de autorización.
 */
const server = readFileSync(new URL("../../src/server.ts", import.meta.url), "utf8");

function registerBlocks(source: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /\b(register[A-Za-z]+Routes)\(\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      i += 1;
    }
    out.push({ name: m[1] ?? "", body: source.slice(re.lastIndex, i) });
  }
  return out;
}

describe("route group gate wiring", () => {
  const blocks = registerBlocks(server);
  it("finds the registered route groups", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(15);
  });
  it("every route group wires an explicit authorization gate", () => {
    const ungated = blocks.filter((b) => !/\bauthorizeAdmin\b|\bauthorizeApiToken\b/.test(b.body)).map((b) => b.name);
    expect(ungated).toEqual([]);
  });
});
