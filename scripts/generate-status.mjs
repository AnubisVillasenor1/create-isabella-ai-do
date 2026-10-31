#!/usr/bin/env node
/**
 * generate-status.mjs (state: engine-generated)
 * Writes docs/STATUS.md from facts read out of the repository, so the status cannot drift from the config:
 * which source areas are excluded from the main typecheck/lint, and the
 * SECURITY.md limitations that must not be contradicted. `--check` fails if the committed file is stale.
 */
import fs from "node:fs";
import crypto from "node:crypto";

const read = (p) => fs.readFileSync(p, "utf8");
const tsconfig = JSON.parse(read("tsconfig.json"));
const layers = fs.existsSync("tsconfig.layers.json") ? JSON.parse(read("tsconfig.layers.json")) : { include: [] };
const excluded = (tsconfig.exclude ?? []).filter((e) => e.startsWith("src/")).sort();
const inLayers = new Set(layers.include ?? []);
const security = read("SECURITY.md");
const limits = security.split(/\r?\n/).filter((l) => /^- .*(volatile|not configured|not durable)/i.test(l));

const body = [
  "---",
  "state: engine-generated",
  "generator: scripts/generate-status.mjs",
  "---",
  "# Estado verificable (generado)",
  "",
  "No editar a mano: `node scripts/generate-status.mjs` regenera este archivo y `--check` lo valida en CI.",
  "",
  `- Áreas de \`src/\` excluidas del typecheck principal: ${excluded.length}`,
  "",
  "## Áreas fuera del typecheck principal",
  "",
  "| Área | Cubierta por `tsconfig.layers.json` |",
  "| --- | --- |",
  ...excluded.map((e) => `| \`${e}\` | ${inLayers.has(e) ? "sí" : "no"} |`),
  "",
  "Una capa excluida del typecheck principal **no puede declararse lista para producción** (CAPABILITY ≠ PRODUCTION).",
  "",
  "## Limitaciones declaradas en SECURITY.md",
  "",
  ...limits,
  "",
].join("\n");

if (process.argv.includes("--check")) {
  const cur = fs.existsSync("docs/STATUS.md") ? read("docs/STATUS.md") : "";
  const h = (t) => crypto.createHash("sha256").update(t).digest("hex");
  if (h(cur) !== h(body)) { console.error("STATUS_STALE: run `pnpm status:generate` and commit docs/STATUS.md"); process.exit(1); }
  console.log("STATUS_OK");
} else {
  fs.writeFileSync("docs/STATUS.md", body);
  console.log("docs/STATUS.md written");
}
