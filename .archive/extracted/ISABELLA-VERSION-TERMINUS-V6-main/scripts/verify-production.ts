// End-to-end production verification (no Docker required).
//
// Boots the REAL production entrypoint (`node dist/server.js`) on an ephemeral
// port, waits for liveness, runs the deployment smoke against it, prints the
// result and tears the process down. Exits non-zero on any failure.
//
// Usage: pnpm run build:dist && pnpm run verify:production
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verifyDeployment, type DeploymentSmokeResult } from "../src/deployment/production-smoke";

export interface ProductionVerificationResult {
  ok: boolean;
  exitCode: number;
  baseUrl: string;
  smoke: DeploymentSmokeResult;
}

/** Polls GET /health until it answers 200, or the deadline elapses. */
export async function waitForHealth(
  baseUrl: string,
  timeoutMs = 20_000,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 200) return true;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function resolveEntrypoint(): string {
  return fileURLToPath(new URL("../dist/server.js", import.meta.url));
}

export async function verifyProduction(entrypoint = resolveEntrypoint(), port = 0): Promise<ProductionVerificationResult> {
  if (!existsSync(entrypoint)) {
    throw new Error(`production entrypoint not found: ${entrypoint} (run \`pnpm run build:dist\` first)`);
  }
  const listenPort = port > 0 ? port : 3000 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${listenPort}`;

  const child = spawn(process.execPath, [entrypoint], {
    env: { ...process.env, PORT: String(listenPort), VERCEL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderr: string[] = [];
  child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));
  let spawnFailed: string | undefined;
  child.once("error", (error) => {
    spawnFailed = error.message;
  });

  try {
    const alive = await waitForHealth(baseUrl);
    if (!alive) {
      const detail = spawnFailed ?? stderr.join("").trim().slice(0, 600) ?? "";
      throw new Error(`production entrypoint did not become healthy at ${baseUrl}. ${detail}`);
    }
    const smoke = await verifyDeployment(baseUrl);
    return { ok: smoke.ok, exitCode: smoke.ok ? 0 : 1, baseUrl, smoke };
  } finally {
    child.kill("SIGTERM");
    // Give the process a moment to release the port; do not block forever.
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    const result = await verifyProduction();
    for (const check of result.smoke.checks) {
      const status = check.status === 0 ? "-" : String(check.status);
      console.log(`[${check.ok ? "PASS" : "FAIL"}] ${check.name} (HTTP ${status}) — ${check.detail}`);
    }
    console.log(result.ok ? `PRODUCTION_VERIFY_OK baseUrl=${result.baseUrl}` : `PRODUCTION_VERIFY_FAILED baseUrl=${result.baseUrl}`);
    process.exit(result.exitCode);
  } catch (error) {
    console.error(`PRODUCTION_VERIFY_ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
