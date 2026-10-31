#!/usr/bin/env node
/**
 * Isabella Genesis repository assurance audit.
 * Dependency-free, read-only structural checks. This is not a penetration test,
 * cryptographic validation, production health check, or compliance certification.
 */
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const checks = [];
const add = (id, severity, ok, detail, evidence = []) =>
  checks.push({ id, severity, status: ok ? "PASS" : severity === "BLOCKER" ? "FAIL" : "WARN", detail, evidence });

async function read(relative) {
  try { return await readFile(path.join(root, relative), "utf8"); }
  catch { return null; }
}
async function exists(relative) {
  try { await access(path.join(root, relative)); return true; }
  catch { return false; }
}
const pkgText = await read("package.json");
let pkg = null;
try { pkg = pkgText ? JSON.parse(pkgText) : null; } catch {}
add("RA-001", "BLOCKER", !!pkg, "package.json existe y es JSON válido.", ["package.json"]);
if (pkg) {
  add("RA-002", "BLOCKER", typeof pkg.scripts?.typecheck === "string", "Existe un script de typecheck ejecutable.", ["package.json:scripts.typecheck"]);
  add("RA-003", "BLOCKER", typeof pkg.scripts?.test === "string", "Existe un script de pruebas.", ["package.json:scripts.test"]);
  add("RA-004", "BLOCKER", typeof pkg.scripts?.build === "string", "Existe un script de build.", ["package.json:scripts.build"]);
  add("RA-005", "WARN", !!pkg.packageManager, "packageManager fija explícitamente el gestor y su versión.", ["package.json:packageManager"]);
  add("RA-006", "WARN", !!pkg.engines?.node, "La versión mínima de Node está declarada.", ["package.json:engines.node"]);
}
const lock = await exists("pnpm-lock.yaml");
const npmLock = await exists("package-lock.json");
const yarnLock = await exists("yarn.lock");
add("RA-007", "BLOCKER", Number(lock) + Number(npmLock) + Number(yarnLock) === 1,
  "Existe exactamente un lockfile principal para instalaciones reproducibles.",
  ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);
const ci = await read(".github/workflows/ci.yml");
add("RA-008", "WARN", !!ci, "Existe workflow CI principal.", [".github/workflows/ci.yml"]);
if (ci) {
  add("RA-009", "BLOCKER", /pull_request:/.test(ci), "El CI se activa en pull requests.", [".github/workflows/ci.yml"]);
  add("RA-010", "BLOCKER", /--frozen-lockfile/.test(ci), "El CI instala dependencias con lockfile congelado.", [".github/workflows/ci.yml"]);
  add("RA-011", "WARN", /typecheck/.test(ci) && /test/.test(ci) && /build/.test(ci),
    "El CI menciona typecheck, pruebas y build.", [".github/workflows/ci.yml"]);
}
for (const [id, file, description] of [
  ["RA-012", "SECURITY.md", "Política de reporte y respuesta de seguridad."],
  ["RA-013", "docs/ESTADO-REAL-ACTUAL.md", "Registro de estado real y limitaciones."],
  ["RA-014", "scripts/security-suite.mjs", "Suite de invariantes de seguridad."],
  ["RA-015", "scripts/production-evidence.mjs", "Generador de evidencia del gate productivo."],
]) {
  add(id, "WARN", await exists(file), description, [file]);
}
const readme = await read("README.md");
add("RA-016", "WARN",
  !!readme &&
    /SPECIFIED\s*≠\s*IMPLEMENTED\s*≠\s*TESTED/i.test(readme) &&
    /pnpm install --frozen-lockfile/i.test(readme) &&
    /Gates pendientes para liberar/i.test(readme),
  "README documenta el contrato de evidencia, instalación reproducible y gates de liberación actuales.",
  ["README.md"]);
const server = await read("src/server.ts");
add("RA-017", "BLOCKER",
  !!server && /\/api\/v1\/readyz/.test(server) && /currentOpsState/.test(server) && /readinessEvidence/.test(server),
  "Readiness HTTP se vincula a estado operativo evaluado y evidencia explícita.",
  ["src/server.ts"]);
const productionOps = await read("src/deployment/production-ops.ts");
add("RA-018", "BLOCKER",
  !!productionOps && /dependencies:not-configured/.test(productionOps) && /invalid-health-record/.test(productionOps),
  "Readiness rechaza ausencia de dependencias y registros de salud inválidos.",
  ["src/deployment/production-ops.ts"]);
const genesisModule = await read("src/cognition/genesis-moe.ts");
const genesisTests = await read("test/cognition/genesis-moe.test.ts");
const chunkModule = await read("src/cognition/genesis-chunk.ts");
const chunkTests = await read("test/cognition/genesis-chunk.test.ts");
add("RA-019", "BLOCKER",
  !!genesisModule && !!genesisTests && !!chunkModule && !!chunkTests,
  "Los contratos Genesis/IGE y sus archivos de prueba existen en el árbol.",
  ["src/cognition/genesis-moe.ts", "test/cognition/genesis-moe.test.ts", "src/cognition/genesis-chunk.ts", "test/cognition/genesis-chunk.test.ts"]);
const latencyModule = await read("src/deployment/latency-metrics.ts");
const latencyTests = await read("test/deployment/latency-metrics.test.ts");
const perfTests = await read("test/performance/critical-latency.test.ts");
add("RA-020", "BLOCKER",
  !!latencyModule && !!latencyTests && !!perfTests,
  "Bounded latency telemetry and CPU-only critical-path percentile benchmarks exist.",
  ["src/deployment/latency-metrics.ts", "test/deployment/latency-metrics.test.ts", "test/performance/critical-latency.test.ts"]);
add("RA-021", "BLOCKER",
  !!server && /\/api\/v1\/ops\/latency/.test(server) && /OPS_API_TOKEN/.test(server) && /latencyRegistry\.record/.test(server),
  "Route latency endpoint is instrumented and token-gated.",
  ["src/server.ts"]);
add("RA-022", "BLOCKER",
  !!server && !/src-tamv-001|src-rdm-002|src-agents-003|src-zenodo-004/.test(server),
  "Startup does not seed IKES with the audited placeholder source IDs/hashes.",
  ["src/server.ts"]);
add("RA-023", "BLOCKER",
  !!server &&
  /\(req\.url \?\? ['"]['"]\)\.split\(['"]\?['"]\)\[0\]/.test(server) &&
  /pathname === ['"]\/api\/v1\/connectors\/ingest['"]/.test(server) &&
  /pathname\??\.startsWith\(['"]\/api\/v1\/federation\/webhooks\/['"]\)/.test(server),
  "Raw webhook bodies are retained only for the signed connector-ingestion and federation webhook routes (never globally).",
  ["src/server.ts"]);
add("RA-024", "WARN",
  !!server && /coordinates: null/.test(server) && /coordinatesStatus: ['"]UNVERIFIED['"]/.test(server),
  "Territorial skill does not present unverified coordinates as established facts.",
  ["src/server.ts"]);
const rustLock = await exists("ige-omega/Cargo.lock");
add("RA-025", "BLOCKER", rustLock,
  "IGE-Ω commits Cargo.lock so Rust dependencies are reproducible and --locked builds are enforceable.",
  ["ige-omega/Cargo.lock"]);
add("RA-026", "BLOCKER",
  !!ci && /rust-verify/.test(ci) && /cargo fmt --all -- --check/.test(ci) &&
    /cargo clippy --workspace --all-targets --locked/.test(ci) &&
    /cargo test --workspace --locked/.test(ci) &&
    /cargo build --release -p gateway --locked/.test(ci),
  "CI contains locked formatting, Clippy, workspace-test and release-build gates for IGE-Ω.",
  [".github/workflows/ci.yml"]);
const uiHtml = await read("src/ui/index.html");
const uiCss = await read("src/ui/cinematic.css");
const uiJs = await read("src/ui/app.js");
const uiIds = uiHtml ? [...uiHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]) : [];
add("RA-027", "BLOCKER",
  !!uiHtml && new Set(uiIds).size === uiIds.length,
  "HTML identifiers are unique so navigation and ARIA references stay deterministic.",
  ["src/ui/index.html"]);
add("RA-028", "WARN",
  !!uiJs && /(cinematicDisabled|reducedMotion)/.test(uiJs) && /copyLastAssistant/.test(uiJs),
  "The workspace is immediately accessible and assistant replies expose a copy action.",
  ["src/ui/app.js"]);
add("RA-029", "WARN",
  !!uiCss && !/hebbkx1anhila5yf/.test(uiCss),
  "The interface does not depend on the retired external cinematic background asset.",
  ["src/ui/cinematic.css"]);
add("RA-030", "BLOCKER",
  !!server && !/process\.env\.ISABELLA_KEYLESS_FREE_PROVIDER\s*=\s*["']pollinations["']/.test(server),
  "External keyless inference remains disabled unless the operator explicitly opts in.",
  ["src/server.ts"]);

const atlasMigration = await read("supabase/migrations/20261017000000_atlas-store-core.sql");
add("RA-031", "BLOCKER",
  !!atlasMigration &&
    /create table if not exists public\.atlas_users/i.test(atlasMigration) &&
    /alter table public\.atlas_users enable row level security/i.test(atlasMigration) &&
    /revoke all on table[\s\S]*from anon, authenticated/i.test(atlasMigration) &&
    /to service_role/i.test(atlasMigration),
  "AtlasStore migration includes the health-probe table and denies direct browser-role access.",
  ["supabase/migrations/20261017000000_atlas-store-core.sql"]);

const bookPiRuntime = await read("src/bookpi/runtime-storage.ts");
const bookPiPostgres = await read("src/bookpi/storage-postgres.ts");
const pipelineRoute = await read("src/routes/pipeline.ts");
add("RA-032", "BLOCKER",
  !!server && /createRuntimeBookPiStorage\(process\.env\)/.test(server) &&
    /bookpi: pipelineBookPi\.storage/.test(server) &&
    !!bookPiRuntime && /createPostgresStorage\(pool, ['"]bookpi_events['"]/.test(bookPiRuntime) &&
    /POSTGRES_URL/.test(bookPiRuntime) &&
    /BOOKPI_INTEGRITY_SECRET/.test(bookPiRuntime) &&
    /integritySecret\.length < 32/.test(bookPiRuntime) &&
    /VOLATILE_MEMORY/.test(bookPiRuntime) &&
    !!bookPiPostgres && /pg_advisory_xact_lock/.test(bookPiPostgres) &&
    /BOOKPI_ACTOR_SCOPE_MISMATCH/.test(bookPiPostgres) &&
    /Number\(row\.sequence\)/.test(bookPiPostgres) &&
    !!pipelineRoute && /await resolveStorage\(\)/.test(pipelineRoute),
  "The governed pipeline uses the environment-selected BookPI adapter; Postgres append is transactional and actor-scoped, while volatile fallback stays explicitly degraded.",
  ["src/server.ts", "src/bookpi/runtime-storage.ts", "src/bookpi/storage-postgres.ts", "src/routes/pipeline.ts"]);

const ikesAdapter = await read("src/memory/ikes-supabase.ts");
const ikesEngine = await read("src/memory/ikes.ts");
const ikesMigration = await read("supabase/migrations/20261017000001_ikes-memory.sql");
const ikesTests = await read("test/memory/ikes-persistence.test.ts");
add("RA-033", "BLOCKER",
  !!server && /createSupabaseIkesPersistence\(process\.env\)/.test(server) &&
    /runtime\.memory\.flushPersistence\(\)/.test(server) &&
    !!ikesEngine && /initPersistence\(\)/.test(ikesEngine) &&
    /IKES_PERSISTENCE_NOT_INITIALIZED/.test(ikesEngine) &&
    /IKES_PERSISTENCE_WRITE_FAILED/.test(ikesEngine) &&
    !!ikesAdapter && /atlas_knowledge_sources/.test(ikesAdapter) &&
    /atlas_knowledge_claims/.test(ikesAdapter) &&
    !!ikesMigration && /enable row level security/i.test(ikesMigration) &&
    /revoke all on table[\s\S]*from anon, authenticated/i.test(ikesMigration) &&
    !!ikesTests && /hydrates integrity-valid records/.test(ikesTests),
  "IKES hydrates and persists hash-validated claims through server-only Supabase tables; reads fail closed during hydration and write errors remain visible.",
  ["src/server.ts", "src/genesis/runtime.ts", "src/memory/ikes.ts", "src/memory/ikes-supabase.ts", "supabase/migrations/20261017000001_ikes-memory.sql", "test/memory/ikes-persistence.test.ts"]);

add("RA-034", "BLOCKER",
  !!server && /\/api\/v1\/integrations\/graph/.test(server) &&
    /authorizeApiToken\(req, res, ['"]GENESIS_ADMIN_API_TOKEN['"]\)/.test(server) &&
    /readinessEvidence/.test(server) &&
    /legacy ledger; not yet unified/.test(server) &&
    /WIRED describes a code path/.test(server),
  "An authenticated operations endpoint exposes registered modules and distinguishes wiring from actual dependency health.",
  ["src/server.ts"]);

const pipelineConductor = await read("src/pipeline/conductor.ts");
const pipelineTests = await read("test/routes/pipeline.test.ts");
add("RA-035", "BLOCKER",
  !!pipelineRoute && /ledgerOnlyFailure/.test(pipelineRoute) &&
    /PIPELINE_EVIDENCE_STORAGE_UNAVAILABLE/.test(pipelineRoute) &&
    /ledgerOnlyFailure \? 503 : 403/.test(pipelineRoute) &&
    !!pipelineConductor && /secreto de integridad no configurado/.test(pipelineConductor) &&
    !!pipelineTests && /evidence-store outage as 503/.test(pipelineTests),
  "The pipeline reports evidence-store failures as service-unavailable, sanitizes storage errors and has a regression test for the distinction from policy denials.",
  ["src/routes/pipeline.ts", "src/pipeline/conductor.ts", "test/routes/pipeline.test.ts"]);

const bookPiMigration = await read("infra/db/migrations/001_create_bookpi_events.sql");
const bookPiHardeningMigration = await read("infra/db/migrations/002_bookpi_canonical_immutability.sql");
const bookPiPostgresTests = await read("test/bookpi/postgres-migration.test.ts");
add("RA-036", "BLOCKER",
  !!bookPiMigration &&
    /CREATE TABLE IF NOT EXISTS bookpi_events/i.test(bookPiMigration) &&
    /sequence BIGINT NOT NULL UNIQUE/i.test(bookPiMigration) &&
    !!bookPiHardeningMigration &&
    /ENABLE ROW LEVEL SECURITY/i.test(bookPiHardeningMigration) &&
    /REVOKE UPDATE, DELETE, TRUNCATE ON bookpi_events FROM PUBLIC/i.test(bookPiMigration) &&
    /CREATE TRIGGER trg_bookpi_require_canonical/i.test(bookPiHardeningMigration) &&
    !!bookPiPostgresTests && /BookPI PostgreSQL migration contract/.test(bookPiPostgresTests),
  "The existing BookPI migration pair defines the runtime schema, row-level actor scoping, canonical-on-insert and mutation restrictions, with regression tests.",
  ["infra/db/migrations/001_create_bookpi_events.sql", "infra/db/migrations/002_bookpi_canonical_immutability.sql", "test/bookpi/postgres-migration.test.ts"]);

const legacyBookPiReadiness = await read("src/bookpi/readiness.ts");
const legacyBookPiReadinessTests = await read("test/bookpi/readiness.test.ts");
add("RA-037", "BLOCKER",
  !!server &&
    /inspectLegacyBookPiLedger\(\(\) => bookPiLedger\.verify\(\)\)/.test(server) &&
    /status: legacyLedgerStatus/.test(server) &&
    !/name: "bookpi-ledger", status: "degraded" as const/.test(server) &&
    !!legacyBookPiReadiness && /result\.durable/.test(legacyBookPiReadiness) &&
    !!legacyBookPiReadinessTests && /does not treat a valid in-memory chain as production-ready/.test(legacyBookPiReadinessTests),
  "Readiness evaluates the actual legacy BookPI verification result and has regression tests for volatile, durable, corrupt and recovery states.",
  ["src/server.ts", "src/bookpi/readiness.ts", "test/bookpi/readiness.test.ts"]);

const bookPiPostgresAdapter = await read("src/bookpi/storage-postgres.ts");
const bookPiPostgresAdapterTests = await read("test/bookpi/storage-postgres.test.ts");
add("RA-038", "BLOCKER",
  !!bookPiPostgresAdapter &&
    /row\.timestamp instanceof Date/.test(bookPiPostgresAdapter) &&
    /BOOKPI_POSTGRES_TIMESTAMP_INVALID/.test(bookPiPostgresAdapter) &&
    /Number\(row\.sequence\)/.test(bookPiPostgresAdapter) &&
    !!bookPiPostgresAdapterTests &&
    /TIMESTAMPTZ Date values before canonical chain verification/.test(bookPiPostgresAdapterTests),
  "PostgreSQL TIMESTAMPTZ values are normalized to canonical ISO strings before hashing; invalid timestamps fail closed with regression coverage.",
  ["src/bookpi/storage-postgres.ts", "test/bookpi/storage-postgres.test.ts"]);

const ikesConcurrencyMigration = await read("supabase/migrations/20261017000001_ikes-memory.sql");
const ikesConcurrencyTests = await read("test/memory/ikes-migration.test.ts");
add("RA-039", "BLOCKER",
  !!ikesConcurrencyMigration &&
    /atlas_knowledge_guard_source_identity/.test(ikesConcurrencyMigration) &&
    /IKES_SOURCE_IDENTITY_IMMUTABLE/.test(ikesConcurrencyMigration) &&
    /atlas_knowledge_guard_claim_version/.test(ikesConcurrencyMigration) &&
    /IKES_CLAIM_VERSION_CONFLICT/.test(ikesConcurrencyMigration) &&
    /IKES_CLAIM_SAME_VERSION_MUTATION/.test(ikesConcurrencyMigration) &&
    !!ikesConcurrencyTests && /IKES migration concurrency contract/.test(ikesConcurrencyTests),
  "IKES migrations protect source identity and reject stale or conflicting claim writes across replicas, with regression tests.",
  ["supabase/migrations/20261017000001_ikes-memory.sql", "test/memory/ikes-migration.test.ts"]);

const integrationGraphTests = await read("test/deployment/integration-graph.test.ts");
add("RA-040", "BLOCKER",
  !!server &&
    /\/api\/v1\/integrations\/graph/.test(server) &&
    /authorizeApiToken\(req, res, ['"]GENESIS_ADMIN_API_TOKEN['"]\)/.test(server) &&
    /const igeOmegaProbe = await probeIgeOmegaGateway\(process\.env\)/.test(server) &&
    /id: ['"]ige-omega-rust['"],\s*state: igeOmegaProbe\.status/.test(server) &&
    /to: ['"]ige-omega-rust['"],\s*state: igeOmegaProbe\.status/.test(server) &&
    !!integrationGraphTests && /runtime integration graph contract/.test(integrationGraphTests),
  "The authenticated integration graph enumerates connected route surfaces and explicitly labels the Rust workspace as not runtime-linked.",
  ["src/server.ts", "test/deployment/integration-graph.test.ts"]);

const graphSourceTests = await read("test/deployment/integration-graph.test.ts");
add("RA-041", "BLOCKER",
  !!server &&
    /const legacyBookpiEvidence = evidenceByName\.get\(['"]bookpi-ledger['"]\)/.test(server) &&
    /id: ['"]bookpi-legacy['"],\s*state: legacyBookpiEvidence\?\.status/.test(server) &&
    /to: ['"]bookpi-legacy['"],\s*state: legacyBookpiEvidence\?\.status\?\.toUpperCase/.test(server) &&
    !!graphSourceTests && /uses dependency evidence in edges without leaking out-of-scope state/.test(graphSourceTests),
  "The legacy BookPI node and edge consume the legacy ledger's own readiness evidence, not the pipeline adapter's state.",
  ["src/server.ts", "test/deployment/integration-graph.test.ts"]);

const igeOmegaGatewayProbe = await read("src/ige-omega/gateway-probe.ts");
const igeOmegaGatewayProbeTests = await read("test/ige-omega/gateway-probe.test.ts");
add("RA-042", "BLOCKER",
  !!igeOmegaGatewayProbe &&
    /IGE_OMEGA_GATEWAY_URL/.test(igeOmegaGatewayProbe) &&
    /new URL\(['"]health['"], baseUrl\)/.test(igeOmegaGatewayProbe) &&
    /new URL\(['"]ready['"], baseUrl\)/.test(igeOmegaGatewayProbe) &&
    /health-readiness-probe-only/.test(igeOmegaGatewayProbe) &&
    !!igeOmegaGatewayProbeTests && /requires both the public health contract and database readiness/.test(igeOmegaGatewayProbeTests) &&
    /rejects insecure non-local HTTP URLs in production/.test(igeOmegaGatewayProbeTests),
  "IGE-OMEGA has a bounded, URL-validated HTTP health/readiness bridge; the graph reports real probe state without claiming authenticated inference is wired.",
  ["src/ige-omega/gateway-probe.ts", "test/ige-omega/gateway-probe.test.ts", "src/server.ts"]);

const nestedPackageManagerScripts = Object.entries(pkg?.scripts ?? {})
  .filter(([, command]) => typeof command === "string")
  .filter(([, command]) => command.replaceAll("corepack pnpm run", "").includes("pnpm run"))
  .map(([name]) => name);
add("RA-043", "BLOCKER",
  !!pkg && nestedPackageManagerScripts.length === 0,
  nestedPackageManagerScripts.length === 0
    ? "All nested pnpm run invocations explicitly use Corepack and the packageManager-pinned version."
    : `Unpinned nested pnpm invocations remain in scripts: ${nestedPackageManagerScripts.join(", ")}.`,
  ["package.json"]);

add("RA-044", "BLOCKER",
  !!igeOmegaGatewayProbe &&
    /MAX_PROBE_BODY_BYTES = 2_048/.test(igeOmegaGatewayProbe) &&
    /readProbeJson\(response: Response\)/.test(igeOmegaGatewayProbe) &&
    /IGE_OMEGA_PROBE_BODY_TOO_LARGE/.test(igeOmegaGatewayProbe) &&
    /IGE_OMEGA_PROBE_INVALID_JSON/.test(igeOmegaGatewayProbe) &&
    !!igeOmegaGatewayProbeTests &&
    /exceeds the byte budget/.test(igeOmegaGatewayProbeTests) &&
    /malformed health JSON/.test(igeOmegaGatewayProbeTests),
  "The optional IGE-OMEGA probe bounds response bodies and fails closed on oversized or malformed JSON, with regression tests.",
  ["src/ige-omega/gateway-probe.ts", "test/ige-omega/gateway-probe.test.ts"]);

const report = {
  schemaVersion: "1.0.0",
  audit: "isabella-genesis-repository-assurance",
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null,
  branch: process.env.GITHUB_REF_NAME || process.env.VERCEL_GIT_COMMIT_REF || null,
  scope: "read-only structural repository checks",
  disclaimer: "PASS means only that the named structural check passed; it does not prove runtime behavior, security, integration, deployment, or compliance.",
  summary: {
    total: checks.length,
    passed: checks.filter(x => x.status === "PASS").length,
    failed: checks.filter(x => x.status === "FAIL").length,
    warnings: checks.filter(x => x.status === "WARN").length,
    blockers: checks.filter(x => x.severity === "BLOCKER" && x.status !== "PASS").length,
    ok: checks.every(x => x.severity !== "BLOCKER" || x.status === "PASS"),
  },
  checks,
};
const outDir = path.join(root, "artifacts", "assurance");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "repository-assurance.json"), JSON.stringify(report, null, 2) + "\n");
const md = [
  "# Repository assurance audit",
  "",
  `- Commit: ${report.commit || "unknown"}`,
  `- Branch: ${report.branch || "unknown"}`,
  `- Generated: ${report.generatedAt}`,
  `- Result: ${report.summary.ok ? "PASS (structural blockers clear)" : "FAIL (structural blockers found)"}`,
  `- Checks: ${report.summary.passed}/${report.summary.total} pass; ${report.summary.failed} fail; ${report.summary.warnings} warnings`,
  "",
  "> This report checks repository structure only. It is not proof of production readiness, runtime correctness, or security certification.",
  "",
  "| ID | Severity | Status | Detail |",
  "|---|---|---|---|",
  ...checks.map(c => `| ${c.id} | ${c.severity} | ${c.status} | ${c.detail.replaceAll("|", "\\|")} |`),
  "",
].join("\n");
await writeFile(path.join(outDir, "repository-assurance.md"), md);
console.log(md);
if (!report.summary.ok) process.exitCode = 1;
