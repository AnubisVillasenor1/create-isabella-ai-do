import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** state: draft | engine-generated. Toda variable de entorno leída por src/ debe estar en .env.example. */
const root = fileURLToPath(new URL("../../", import.meta.url));
const src = readdirSync(path.join(root, "src"), { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".ts"))
  .map((f) => readFileSync(path.join(root, "src", f), "utf8"))
  .join("\n");
const example = readFileSync(path.join(root, ".env.example"), "utf8");

describe("environment variable documentation", () => {
  it("documents every variable read through process.env or authorizeApiToken", () => {
    const names = new Set<string>();
    for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) names.add(m[1] ?? "");
    for (const m of src.matchAll(/process\.env\[\s*"([A-Z][A-Z0-9_]{2,})"\s*\]/g)) names.add(m[1] ?? "");
    for (const m of src.matchAll(/authorizeApiToken\([^,]+,[^,]+,\s*"([A-Z][A-Z0-9_]{2,})"/g)) names.add(m[1] ?? "");
    names.delete("");
    const undocumented = [...names].filter((n) => !example.includes(n)).sort();
    expect(undocumented).toEqual([]);
  });
});
