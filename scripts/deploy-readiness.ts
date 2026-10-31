// Pre-release gate: usage `pnpm deploy:readiness [path/to/.env.production]`.
// Reads KEY=VALUE pairs from the file (if given) on top of the process environment, never prints values,
// and exits non-zero when any blocking (ERROR) finding exists.
import { existsSync, readFileSync } from "node:fs";
import { runDeployReadiness } from "../src/health/deploy-readiness";

const file = process.argv[2];
const env: Record<string, string | undefined> = { ...process.env };
if (file) {
  if (!existsSync(file)) {
    console.error(`DEPLOY_READINESS_FAILED: file not found: ${file}`);
    process.exit(2);
  }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && !line.trimStart().startsWith("#")) env[m[1] as string] = (m[2] as string).replace(/^["']|["']$/g, "");
  }
}

const report = runDeployReadiness(env);
for (const f of report.findings) console.log(`[${f.severity}] ${f.id} — ${f.message}`);
console.log(`DEPLOY_READINESS_${report.status}`);
process.exit(report.status === "BLOCKED" ? 1 : 0);
