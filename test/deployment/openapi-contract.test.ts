import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** state: draft | engine-generated. Guards: el OpenAPI no puede documentar rutas que no existen. */
const root = new URL("../../", import.meta.url);
const spec = readFileSync(new URL("docs/api/openapi.yaml", root), "utf8");
const inventory = JSON.parse(readFileSync(new URL("docs/api/route-inventory.json", root), "utf8")) as { route: string; method: string }[];

function documented(): Set<string> {
  const out = new Set<string>();
  let path: string | null = null;
  let inPaths = false;
  for (const line of spec.split("\n")) {
    if (/^paths:/.test(line)) { inPaths = true; continue; }
    if (/^\S/.test(line) && !/^paths:/.test(line)) inPaths = false;
    if (!inPaths) continue;
    const p = /^  (\/\S*):\s*$/.exec(line);
    if (p) { path = (p[1] ?? "").replace(/\{(\w+)\}/g, ":$1"); continue; }
    const m = /^    (get|post|put|delete|patch):\s*$/.exec(line);
    if (m && path !== null) out.add(`${(m[1] ?? "").toUpperCase()} ${path}`);
  }
  return out;
}

describe("OpenAPI ↔ route inventory", () => {
  const real = new Set(inventory.map((r) => `${r.method} ${r.route}`));
  it("every documented operation exists in the server", () => {
    const phantom = [...documented()].filter((op) => !real.has(op));
    expect(phantom).toEqual([]);
  });
  it("coverage ratchet: documented operations never drop below the current floor", () => {
    expect(documented().size).toBeGreaterThanOrEqual(26);
  });
});
