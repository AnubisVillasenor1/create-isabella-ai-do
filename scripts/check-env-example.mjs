#!/usr/bin/env node
/**
 * check-env-example.mjs — guard for `.env.example` (state: engine-generated).
 * Fails on: duplicated keys, keys that look like real secrets, and variables read in src/ that are not
 * documented (allow-list for platform-provided variables). Zero dependencies.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const text = fs.readFileSync(path.join(root, ".env.example"), "utf8");
const problems = [];
const seen = new Map();
text.split(/\r?\n/).forEach((line, i) => {
  const m = /^\s*(?:#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
  if (!m || line.trimStart().startsWith("##")) return;
  const [, key, value] = m;
  if (!line.trimStart().startsWith("#")) {
    if (seen.has(key)) problems.push(`duplicated key ${key} (lines ${seen.get(key)} and ${i + 1})`);
    seen.set(key, i + 1);
    if (/^(sk_live_|sk-or-|hf_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|whsec_[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{20,})/.test(value.trim())) {
      problems.push(`${key} looks like a real secret (line ${i + 1})`);
    }
  }
});

const PLATFORM = new Set(["VERCEL", "VERCEL_OIDC_TOKEN", "VITEST", "NODE_ENV", "CI", "HOME", "PATH", "TMPDIR", "npm_package_version"]);
const used = new Set();
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", "dist", "hypercore-runtime"].includes(e.name)) walk(p); }
    else if (/\.(ts|js|mjs)$/.test(e.name)) {
      for (const m of fs.readFileSync(p, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) used.add(m[1]);
    }
  }
};
walk(path.join(root, "src"));
const documented = new Set([...seen.keys(), ...[...text.matchAll(/^\s*#\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1])]);
const undocumented = [...used].filter((k) => !documented.has(k) && !PLATFORM.has(k)).sort();
if (undocumented.length) problems.push(`undocumented variables read in src/: ${undocumented.join(", ")}`);

if (problems.length) { console.error("ENV_EXAMPLE_FAILED\n - " + problems.join("\n - ")); process.exit(1); }
console.log(`ENV_EXAMPLE_OK keys=${seen.size} read_in_src=${used.size}`);
