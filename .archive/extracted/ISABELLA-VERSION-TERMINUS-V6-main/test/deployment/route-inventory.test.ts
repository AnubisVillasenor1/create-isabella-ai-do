import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// TD-01 regression guard: the HTTP surface of the runtime is a contract. Before
// extracting route groups out of src/server.ts, the full route inventory is
// frozen here so a refactor cannot silently drop or rename an endpoint. The list
// is regenerated deliberately (see the audit) when a route is intentionally added.

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const srcDir = path.join(repoRoot, "src");

function collectSource(dir: string): string {
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => path.join(dir, entry));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

export function extractRoutes(source: string): string[] {
  const re = /app\.(get|post|put|delete|patch)\(\s*(["'`])([^"'`]*)\2/g;
  const routes: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) routes.push(`${(match[1] ?? "").toUpperCase()} ${match[3]}`);
  return routes.sort();
}

const expected = JSON.parse(
  readFileSync(new URL("./route-inventory.json", import.meta.url), "utf8"),
) as string[];

describe("route inventory contract (TD-01)", () => {
  it("matches the frozen HTTP surface exactly", () => {
    const actual = extractRoutes(collectSource(srcDir));
    expect(actual).toEqual([...expected].sort());
  });

  it("keeps the extracted HyperCore group wired", () => {
    const routes = new Set(extractRoutes(collectSource(srcDir)));
    for (const route of [
      "GET /api/v1/hypercore/modes",
      "POST /api/v1/hypercore/run",
      "POST /api/v1/hypercore/predict",
      "GET /api/v1/hypercore/skills",
      "POST /api/v1/hypercore/skills/execute",
      "POST /api/v1/mcp",
    ]) {
      expect(routes.has(route)).toBe(true);
    }
  });

  it("no route literal is registered across more than one module", () => {
    const files = readdirSync(srcDir, { recursive: true, encoding: "utf8" }).filter((e) => e.endsWith(".ts"));
    const owners = new Map<string, Set<string>>();
    for (const rel of files) {
      for (const route of extractRoutes(readFileSync(path.join(srcDir, rel), "utf8"))) {
        const set = owners.get(route) ?? new Set<string>();
        set.add(rel);
        owners.set(route, set);
      }
    }
    const duplicated = [...owners.entries()].filter(([, set]) => set.size > 1).map(([route, set]) => [route, [...set]]);
    expect(duplicated, `route literal registered in multiple modules: ${JSON.stringify(duplicated)}`).toEqual([]);
  });

});
