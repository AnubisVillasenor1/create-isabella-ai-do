/**
 * production-evidence.mjs — Evidencia de producción con outputs reales (ISA-336).
 *
 * Ejecuta el typecheck (`pnpm typecheck`) y la suite unitaria
 * (`pnpm exec vitest run`) y colecciona el resultado en
 * `evidence/production-evidence.json`.
 *
 * Es un GATE: si typecheck o tests fallan, escribe la evidencia con el resultado
 * real e **inmediatamente** sale con exit code != 0. Nunca inventa un "passed":
 * typecheckOk y los contadores salen de la ejecución observada.
 *
 * Los artefactos se emiten bajo `evidence/` (gitignored: `evidence/*.json`);
 * la evidencia misma se adjunta en CI ligada al SHA del commit (ISA-325/ISA-337).
 *
 * Sin dependencias. state: auto_generated.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const OUT_DIR = path.join(REPO_ROOT, "evidence");
const OUT_FILE = path.join(OUT_DIR, "production-evidence.json");

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function run(command, args, timeoutMs = 600_000) {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, shell: true, encoding: "utf8", timeout: timeoutMs });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function commandAvailable(name) {
  const probe = spawnSync(name, ["--version"], { shell: true, encoding: "utf8", timeout: 15_000 });
  return probe.status === 0;
}

function packageManager() {
  return commandAvailable("pnpm") ? "pnpm" : "npm";
}

function vcsInfo() {
  const head = run("git", ["rev-parse", "HEAD"]);
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  return {
    headCommit: head.status === 0 ? head.stdout.trim() : "UNKNOWN",
    branch: branch.status === 0 ? branch.stdout.trim() : "UNKNOWN",
  };
}

function runTypecheck(pkg) {
  const cmd = pkg === "pnpm" ? ["typecheck"] : ["run", "typecheck"];
  const result = run(pkg, cmd);
  return {
    typecheckOk: result.status === 0,
    exitCode: result.status,
    log: (result.stdout + result.stderr).trim().slice(0, 20_000),
  };
}

const VITEST_REPORT_FILE = path.join(REPO_ROOT, "evidence", ".vitest-report.json");

function parseVitestReport(report, summary) {
  try {
    const json = typeof report === "string" ? JSON.parse(report) : report;
    if (json && typeof json === "object" && "numTotalTests" in json) {
      summary.parsed = true;
      summary.success = json.success === true;
      summary.testsTotal = Number.isFinite(json.numTotalTests) ? json.numTotalTests : 0;
      summary.testsPassed = Number.isFinite(json.numPassedTests) ? json.numPassedTests : 0;
      summary.testsFailed = Number.isFinite(json.numFailedTests) ? json.numFailedTests : 0;
      summary.testsSkipped = Number.isFinite(json.numPendingTests) ? json.numPendingTests : 0;
      summary.files = (json.testResults ?? []).map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean);
      if (summary.testsTotal === 0) {
        summary.parseError = "vitest reportó 0 tests ejecutados; posible fallo de arranque.";
      }
      return true;
    }
  } catch (error) {
    summary.parseError = `no se pudo parsear el reporte JSON de vitest: ${error.message}`;
  }
  return false;
}

function runTests(pkg) {
  if (fs.existsSync(VITEST_REPORT_FILE)) fs.rmSync(VITEST_REPORT_FILE, { force: true });
  const outputFileArg = VITEST_REPORT_FILE.replace(/\\/g, "/");
  const cmd = ["exec", "vitest", "run", "--reporter=json", `--outputFile=${outputFileArg}`];
  const result = run(pkg, cmd);
  const output = (result.stdout + result.stderr).trim();
  const summary = {
    success: false,
    parsed: false,
    testsTotal: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
    files: [],
    parseError: null,
  };

  if (fs.existsSync(VITEST_REPORT_FILE)) {
    if (!parseVitestReport(readText(VITEST_REPORT_FILE), summary)) {
      summary.parseError ||= "el archivo de reporte no contenía un objeto vitest reconocible.";
    }
  } else {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start !== -1 && end > start) {
      parseVitestReport(output.slice(start, end + 1), summary);
    }
    summary.parseError ||= "no se encontró el reporte JSON de vitest.";
  }
  summary.log = output.slice(0, 8_000);
  return summary;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pkg = packageManager();
  const { headCommit, branch } = vcsInfo();

  console.log(`[production-evidence] package manager: ${pkg}`);
  console.log(`[production-evidence] head: ${headCommit} (${branch})`);

  const typecheckResult = runTypecheck(pkg);
  console.log(`[production-evidence] typecheck ${typecheckResult.typecheckOk ? "OK" : "FALLÓ"} (exit ${typecheckResult.exitCode})`);

  const tests = runTests(pkg);
  console.log(
    `[production-evidence] tests: ${tests.testsPassed}/${tests.testsTotal} passed, ${tests.testsFailed} failed`,
  );

  const testsOk = tests.parsed && tests.success && tests.testsFailed === 0 && !tests.parseError;
  const gateOk = typecheckResult.typecheckOk && testsOk;

  const evidence = {
    generatedBy: "production-evidence.mjs",
    state: "auto_generated",
    headCommit,
    branch,
    date: new Date().toISOString(),
    tooling: { node: process.version, packageManager: pkg },
    typecheck: { ok: typecheckResult.typecheckOk, exitCode: typecheckResult.exitCode },
    tests: {
      total: tests.testsTotal,
      passed: tests.testsPassed,
      failed: tests.testsFailed,
      skipped: tests.testsSkipped,
      success: tests.success,
      parsed: tests.parsed,
      files: tests.files,
    },
    gate: { ok: gateOk, note: gateOk ? "" : "GATE fallido: typecheck y/o suite unitaria reportan fallo." },
    engine: {
      generated: true,
      humanReviewed: false,
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`[production-evidence] Escrito: ${path.relative(REPO_ROOT, OUT_FILE).replace(/\\/g, "/")}`);

  if (tests.parseError || tests.log) {
    const tail = (tests.log || typecheckResult.log).split("\n").filter(Boolean).slice(-12).join("\n");
    console.log(`--- salida (final) ---\n${tail}`);
  }

  if (!gateOk) {
    console.error("[production-evidence] GATE DE PRODUCCIÓN FALLÓ (typecheck y/o tests en rojo). exit=1");
    process.exit(1);
  }
  console.log("[production-evidence] GATE OK: typecheck y suite unitaria en verde.");
  process.exit(0);
}

main();