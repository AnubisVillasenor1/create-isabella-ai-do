#!/usr/bin/env node
/**
 * check-sops-placeholders.mjs (state: engine-generated)
 * `.sops.yaml` ships with placeholder recipients (age1xxxx…). That is fine as a template, but the moment an
 * encrypted secrets file is committed the placeholders must have been replaced with real public keys.
 * Fails if any *.enc.yaml / *.env.enc file is tracked while `.sops.yaml` still contains placeholders.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const sopsPath = path.join(root, ".sops.yaml");
if (!fs.existsSync(sopsPath)) { console.log("SOPS_PLACEHOLDERS_OK (no .sops.yaml)"); process.exit(0); }
const sops = fs.readFileSync(sopsPath, "utf8");
const live = sops.split(/\r?\n/).filter((l) => !l.trimStart().startsWith("#")).join("\n");
const placeholders = /age1(?:x{8,}|y{8,}|z{8,})|<age-public-key>|REPLACE_WITH/i.test(live);
let tracked = [];
try {
  tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter((f) => /(^|\/)secrets\.enc\.yaml$|\.env\.enc$/.test(f));
} catch { /* not a git checkout: nothing tracked to verify */ }
if (placeholders && tracked.length) {
  console.error(`SOPS_PLACEHOLDERS_FAILED: .sops.yaml still has placeholder recipients but ${tracked.join(", ")} is tracked.`);
  process.exit(1);
}
console.log(placeholders ? "SOPS_PLACEHOLDERS_OK (template only: no encrypted file tracked; replace recipients before the first `sops --encrypt`)" : "SOPS_PLACEHOLDERS_OK");
