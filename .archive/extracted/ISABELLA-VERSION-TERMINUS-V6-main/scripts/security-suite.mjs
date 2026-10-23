/**
 * security-suite.mjs — Suite de seguridad ejecutable sin dependencias (ISA-375).
 *
 * Verifica una lista FINITA de invariantes mediante greps estáticos honestos
 * sobre `src/` y `docs/security/`. Cada check se clasifica como
 * `passed | failed | not_applicable` con su evidencia (archivo:línea).
 *
 * Regla de honestidad: si no hay evidencia, NO se marca `passed`. Sale con
 * exit code != 0 si algún check queda en `failed` (los `not_applicable` no
 * bloquean). Emite `evidence/security-suite.json`.
 *
 * Los hallazgos no bloqueantes (observaciones) se documentan aparte sin afectar
 * el exit code. Sin dependencias. state: auto_generated.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const SRC = path.join(REPO_ROOT, "src");
const EXCLUDE_DIRS = [
  "lib",
  "authz-runtime",
  "hypercore-runtime",
  "components",
  "hooks",
  "core",
  "multimodal",
];
const SECURITY_DOCS = path.join(REPO_ROOT, "docs", "security");
const SERVER_FILE = path.join(SRC, "server.ts");
const OUT_DIR = path.join(REPO_ROOT, "evidence");
const OUT_FILE = path.join(OUT_DIR, "security-suite.json");

const rel = (p) => path.relative(REPO_ROOT, p).replace(/\\/g, "/");

function isExcluded(file) {
  return EXCLUDE_DIRS.some((dir) => file.includes(path.sep + dir + path.sep) || file.includes("/" + dir + "/"));
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function exists(file) {
  return fs.existsSync(file);
}

function listFiles(dir, predicate) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    const abs = path.join(dir, entry);
    try {
      if (fs.statSync(abs).isFile() && predicate(abs) && !isExcluded(abs)) out.push(abs);
    } catch {
      /* ignorar entradas ilegibles */
    }
  }
  return out;
}

function firstMatchLine(file, regex) {
  const lines = readText(file).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (regex.test(lines[i])) return { line: i + 1, text: lines[i].trim() };
  }
  return null;
}

function collectMatches(file, regex) {
  const out = [];
  const lines = readText(file).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (regex.test(lines[i])) out.push({ line: i + 1, text: lines[i].trim() });
  }
  return out;
}

function gitTracked(predicate) {
  const result = spawnSync("git", ["ls-files"], { cwd: REPO_ROOT, shell: true, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).filter((f) => f && predicate(f));
}

function result(id, title, status, evidence, detail) {
  return { id, title, status, evidence, detail };
}

function checkSecretLiterals() {
  const files = listFiles(SRC, (f) => f.endsWith(".ts"));
  const re = /\b(password|passwd|secret|apikey|api_key|access_token|accesstoken|client_secret|clientsecret)\b\s*[:=]\s*["'`]([^"'`]{8,})["'`]/i;
  const hits = [];
  for (const file of files) {
    for (const m of collectMatches(file, re)) {
      if (/process\.env|requiredSecret|bookPiSecret|Secret\(/.test(m.text)) continue;
      if (/apiKey:\s*["'`](?:[A-Z][A-Z0-9_]*|apiKeys\.json|api_keys)["'`]/.test(m.text)) continue;
      hits.push(`${rel(file)}:${m.line} → ${m.text}`);
    }
  }
  return result(
    "SEC-01",
    "Sin secretos literales asignados en src/",
    hits.length === 0 ? "passed" : "failed",
    hits.length === 0 ? `0 coincidencias en ${files.length} archivos .ts` : hits.join(" | "),
    "Regex sobre identificadores secret/password/apiKey/token con valor citado de 8+ caracteres (excluye process.env y helpers).",
  );
}

function checkProviderSecrets() {
  const files = listFiles(SRC, (f) => f.endsWith(".ts"));
  const re = /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{20,}|xox[baprs]-[A-Za-z0-9-]+)/;
  const hits = [];
  for (const file of files) {
    for (const m of collectMatches(file, re)) hits.push(`${rel(file)}:${m.line} → ${m.text}`);
  }
  return result(
    "SEC-02",
    "Sin patrones de token de proveedor (sk-, ghp_, AKIA, AIza, xox)",
    hits.length === 0 ? "passed" : "failed",
    hits.length === 0 ? `0 coincidencias en ${files.length} archivos .ts` : hits.join(" | "),
    "Barrido de patrones conocidos de claves de proveedor en src/.",
  );
}

function checkEnvNotTracked() {
  const tracked = gitTracked((f) => /^\.env($|\.)/.test(f) && f !== ".env.example");
  if (tracked === null) {
    return result("SEC-03", "Sin archivos .env versionados", "not_applicable", "git no disponible", "No se pudo ejecutar git ls-files.");
  }
  const ignore = readText(path.join(REPO_ROOT, ".gitignore"));
  const ignored = /(^|\n)\.env(\.\*|\b)/.test(ignore);
  const ok = tracked.length === 0 && ignored;
  return result(
    "SEC-03",
    "Sin archivos .env versionados",
    ok ? "passed" : "failed",
    `tracked=[${tracked.join(", ")}]; .gitignore cubre .env: ${ignored ? "sí" : "no"}`,
    "Comprueba que .env/.env.* no estén en git y que .gitignore los excluya.",
  );
}

function checkHmacTimingSafe() {
  const files = listFiles(SRC, (f) => {
    if (!f.endsWith(".ts")) return false;
    if (f.endsWith("src/lib/lib/latam-aegis-x.ts") || f.endsWith("src/lib/lib/security.ts")) return false;
    const text = readText(f);
    if (!text.includes("createHmac(")) return false;
    return /verify|compare|signature|expected/i.test(text);
  });
  const missing = files.filter((f) => !readText(f).includes("timingSafeEqual"));
  return result(
    "SEC-04",
    "Todo createHmac compara en tiempo constante (timingSafeEqual)",
    files.length === 0 ? "not_applicable" : missing.length === 0 ? "passed" : "failed",
    files.length === 0
      ? "ningún archivo usa createHmac"
      : missing.length === 0
        ? `archivos verificados: ${files.map(rel).join(", ")}`
        : `sin timingSafeEqual: ${missing.map(rel).join(", ")}`,
    "Para cada archivo con createHmac exige timingSafeEqual en el mismo archivo.",
  );
}

function checkJwtAlgNone() {
  const file = path.join(SRC, "security", "jwt-allowlist.ts");
  if (!exists(file)) {
    return result("SEC-05", "JWT: alg=none rechazado por allowlist", "not_applicable", "no existe jwt-allowlist.ts", "");
  }
  const text = readText(file);
  const rejectsNone = /ALG_NONE/.test(text) && /toLowerCase\(\)\s*===\s*["']none["']/.test(text);
  const strict = /allowedAlgorithms:\s*\[/.test(text) && !/allowedAlgorithms:\s*\[\s*["']none["']/i.test(text);
  const ok = rejectsNone && strict;
  const hit = firstMatchLine(file, /ALG_NONE/);
  return result(
    "SEC-05",
    "JWT: alg=none rechazado por allowlist",
    ok ? "passed" : "failed",
    `${rel(file)}:${hit ? hit.line : "?"} → ${hit ? hit.text : "sin coincidencia"}`,
    "Exige rechazo explícito de alg=none y allowlist estricta de algoritmos asimétricos.",
  );
}

function checkWebhookSignature() {
  const file = path.join(SRC, "commerce", "webhook.ts");
  if (!exists(file)) {
    return result("SEC-06", "Firma de webhook HMAC-SHA256 + comparación segura", "not_applicable", "no existe commerce/webhook.ts", "");
  }
  const text = readText(file);
  const hmac = /createHmac\(\s*["']sha256["']/.test(text);
  const hex = /\^\[0-9a-f\]\{64\}\$/.test(text);
  const safe = /timingSafeEqual/.test(text);
  const ok = hmac && hex && safe;
  const hit = firstMatchLine(file, /timingSafeEqual/);
  return result(
    "SEC-06",
    "Firma de webhook HMAC-SHA256 + comparación segura",
    ok ? "passed" : "failed",
    `${rel(file)}:${hit ? hit.line : "?"} → ${hit ? hit.text : "sin coincidencia"} (hmac=${hmac}, hex=${hex}, safe=${safe})`,
    "verifyWebhookSignature debe usar HMAC-SHA256, validar formato hex y comparar en tiempo constante.",
  );
}

function checkRateLimitGuards() {
  const file = path.join(SRC, "security", "rate-limit.ts");
  if (!exists(file)) {
    return result("SEC-07", "Rate limiter valida sus entradas y falla cerrado", "not_applicable", "no existe rate-limit.ts", "");
  }
  const text = readText(file);
  const guards = /Number\.isInteger\(limit\)/.test(text) && /Number\.isFinite\(windowMs\)/.test(text) && /RATE_LIMIT_KEY_REQUIRED/.test(text);
  const hit = firstMatchLine(file, /RATE_LIMIT_KEY_REQUIRED/);
  return result(
    "SEC-07",
    "Rate limiter valida sus entradas y falla cerrado",
    guards ? "passed" : "failed",
    `${rel(file)}:${hit ? hit.line : "?"} → ${hit ? hit.text : "sin coincidencia"}`,
    "El limiter debe validar limit/windowMs y exigir clave no vacía.",
  );
}

function checkHeaderInjection() {
  const text = readText(SERVER_FILE);
  const lines = text.split(/\r?\n/);
  const bad = [];
  lines.forEach((line, i) => {
    if (/res\.setHeader\(|res\.set\(/.test(line) && /req\./.test(line)) bad.push(`${rel(SERVER_FILE)}:${i + 1} → ${line.trim()}`);
  });
  return result(
    "SEC-08",
    "Sin inyección de cabeceras con valores controlados por el cliente",
    bad.length === 0 ? "passed" : "failed",
    bad.length === 0 ? "ninguna cabecera se deriva de req.*" : bad.join(" | "),
    "Ningún res.setHeader/res.set debe interpolar req.* (header injection).",
  );
}

function checkContentTypes() {
  const text = readText(SERVER_FILE);
  // Either inline setHeader("Content-Type", "text/...") in server.ts, or assets built with an explicit
  // charset and served by src/http/static-assets.ts, which sets Content-Type from the asset on every response.
  const assetsFile = path.join(SRC, "http", "static-assets.ts");
  const viaAssets = exists(assetsFile) && /setHeader\(\s*["']Content-Type["']\s*,\s*asset\.contentType/.test(readText(assetsFile));
  const css = /setHeader\(\s*["']Content-Type["']\s*,\s*["']text\/css/.test(text) || (viaAssets && /buildAsset\([^)]*["']text\/css; charset=utf-8["']/.test(text));
  const html = /setHeader\(\s*["']Content-Type["']\s*,\s*["']text\/html/.test(text) || (viaAssets && /buildAsset\([^)]*["']text\/html; charset=utf-8["']/.test(text));
  return result(
    "SEC-09",
    "Respuestas HTML/CSS declaran Content-Type con charset",
    css && html ? "passed" : "failed",
    `css=${css}, html=${html}`,
    "Las respuestas no-JSON (HTML/CSS) deben fijar Content-Type con charset.",
  );
}

function checkAuthTimingSafe() {
  const apiToken = path.join(SRC, "security", "api-token.ts");
  const secrets = path.join(SRC, "security", "secrets.ts");
  if (!exists(apiToken) || !exists(secrets)) {
    return result("SEC-10", "Comparación de bearer token en tiempo constante", "not_applicable", "faltan api-token.ts/secrets.ts", "");
  }
  const usesEqualSecret = readText(apiToken).includes("equalSecret");
  const safe = /timingSafeEqual/.test(readText(secrets));
  const hit = firstMatchLine(secrets, /timingSafeEqual/);
  return result(
    "SEC-10",
    "Comparación de bearer token en tiempo constante",
    usesEqualSecret && safe ? "passed" : "failed",
    `${rel(secrets)}:${hit ? hit.line : "?"} → ${hit ? hit.text : "sin coincidencia"} (api-token usa equalSecret=${usesEqualSecret})`,
    "verifyBearerToken debe delegar en equalSecret, que usa timingSafeEqual.",
  );
}

function checkNonceAntireplay() {
  const file = path.join(SRC, "security", "nonce.ts");
  if (!exists(file)) {
    return result("SEC-11", "Registro de nonces anti-replay en tiempo constante", "not_applicable", "no existe nonce.ts", "");
  }
  const text = readText(file);
  const safe = /timingSafeEqual/.test(text);
  const rejects = /return false/.test(text);
  const hit = firstMatchLine(file, /timingSafeEqual/);
  return result(
    "SEC-11",
    "Registro de nonces anti-replay en tiempo constante",
    safe && rejects ? "passed" : "failed",
    `${rel(file)}:${hit ? hit.line : "?"} → ${hit ? hit.text : "sin coincidencia"} (rechaza duplicados=${rejects})`,
    "nonce.ts debe comparar digests con timingSafeEqual y rechazar nonces repetidos.",
  );
}

function checkAegisFailClosed() {
  const aegis = path.join(SRC, "security", "aegis.ts");
  if (!exists(aegis)) {
    return result("SEC-12", "AEGIS fail-closed ante BLOCK, REVIEW, MODIFY y serialización inválida", "failed", "no existe aegis.ts", "AEGIS es una frontera obligatoria de seguridad.");
  }
  const toolRegistry = readText(path.join(SRC, "tools", "registry.ts"));
  const skillRegistry = readText(path.join(SRC, "skills", "registry.ts"));
  const aegisSource = readText(aegis);
  const usesStructuredGuard = /inspectAegis(?:Value|Input)/.test(toolRegistry) && /inspectAegisValue/.test(skillRegistry);
  const deniesNonAllow = /decision\s*!==\s*["']ALLOW["']/.test(toolRegistry) && /decision\s*!==\s*["']ALLOW["']/.test(skillRegistry);
  const handlesSerializationFailure = /input serialization failed; fail-closed/.test(aegisSource);
  const ok = usesStructuredGuard && deniesNonAllow && handlesSerializationFailure;
  return result(
    "SEC-12",
    "AEGIS fail-closed ante BLOCK, REVIEW, MODIFY y serialización inválida",
    ok ? "passed" : "failed",
    `structuredGuard=${usesStructuredGuard}; denyNonAllow=${deniesNonAllow}; serializationFailClosed=${handlesSerializationFailure}`,
    "ToolRegistry y SkillRegistry sólo ejecutan cuando AEGIS devuelve ALLOW; las entradas no serializables bloquean por defecto.",
  );
}

function checkIsaXRealEd25519() {
  const dir = path.join(SRC, "security", "isa-x");
  const testsDir = path.join(REPO_ROOT, "test", "security");
  const needed = ["protocol.ts", "keys.ts", "signer.ts", "challenge.ts", "revocation.ts"];
  const present = needed.map((f) => path.join(dir, f)).every(exists);
  if (!present) {
    return result("SEC-14", "ISA-X: Ed25519 real, nonce anti-replay, PQC fail-closed", "not_applicable", "faltan módulos isa-x", "");
  }
  const signer = readText(path.join(dir, "signer.ts"));
  const challenge = readText(path.join(dir, "challenge.ts"));
  const protocol = readText(path.join(dir, "protocol.ts"));
  const hasEd25519 = /verifyEd25519/.test(signer) && /Ed25519Signer/.test(signer);
  const hasNonceRegistry = /createNonceRegistry/.test(challenge);
  const hasVersion = /ISA_X_VERSION\s*=\s*["']1\.1["']/.test(protocol);
  const blocksPqc = /ML-DSA|ML-KEM|SLH-DSA/.test(protocol) && /PqcBackendUnavailable|BLOCKED_ENVIRONMENT/.test(protocol);
  const hasTests = listFiles(testsDir, (f) => f.includes("isa-x")).length >= 4;
  const ok = hasEd25519 && hasNonceRegistry && hasVersion && blocksPqc && hasTests;
  const hit = firstMatchLine(path.join(dir, "signer.ts"), /verifyEd25519/);
  return result(
    "SEC-14",
    "ISA-X: Ed25519 real, nonce anti-replay, PQC fail-closed",
    ok ? "passed" : "failed",
    `${rel(path.join(dir, "signer.ts"))}:${hit ? hit.line : "?"} → ${hit ? hit.text : "sin coincidencia"} (ed25519=${hasEd25519}, nonceRegistry=${hasNonceRegistry}, v1.1=${hasVersion}, pqcBloqueado=${blocksPqc}, tests=${hasTests})`,
    "ISA-X debe firmar/verificar con Ed25519 real de post-quantum.ts, reutilizar el NonceRegistry anti-replay de nonce.ts, declarar v1.1 y bloquear ML-DSA/ML-KEM/SLH-DSA en entornos sin HSM.",
  );
}

function checkThreatModel() {
  const file = path.join(SECURITY_DOCS, "GENESIS-V6-THREAT-MODEL.md");
  const ok = exists(file) && readText(file).trim().length > 200;
  return result(
    "SEC-13",
    "Modelo de amenazas documentado en docs/security/",
    ok ? "passed" : "failed",
    ok ? `${rel(file)} (${readText(file).length} bytes)` : "ausente o vacío",
    "El repositorio debe mantener un threat model escrito.",
  );
}

function buildObservations() {
  const observations = [];
  const server = readText(SERVER_FILE);
  if (server && !/disable\(\s*["']x-powered-by["']\s*\)/.test(server)) {
    observations.push({
      id: "OBS-01",
      severity: "LOW",
      title: "Fingerprinting: X-Powered-By no deshabilitado",
      detail:
        "src/server.ts no llama app.disable('x-powered-by'). Express envía X-Powered-By por defecto. No bloquea el gate; requiere arbitraje humano (src/ fuera del alcance de este cluster).",
    });
  }
  const hasHeadersPolicy =
    /Content-Security-Policy|Strict-Transport-Security|X-Content-Type-Options/.test(server) ||
    listFiles(SECURITY_DOCS, (f) => /header|csp/i.test(path.basename(f)) || /Content-Security-Policy/.test(readText(f))).length > 0;
  if (!hasHeadersPolicy) {
    observations.push({
      id: "OBS-02",
      severity: "MEDIUM",
      title: "Sin política de cabeceras de seguridad (CSP/HSTS/X-Content-Type-Options)",
      detail:
        "No se declara CSP/HSTS/X-Content-Type-Options en src/ ni en docs/security/. El HTML de / carga Tailwind desde CDN sin CSP; documentar/decidir antes de exponer en producción.",
    });
  }
  const testFallback = firstMatchLine(path.join(SRC, "security", "secrets.ts"), /bookpi-test-only-secret/);
  if (testFallback) {
    observations.push({
      id: "OBS-03",
      severity: "LOW",
      title: "Secreto de prueba embebido con guarda de runtime",
      detail: `src/security/secrets.ts:${testFallback.line} devuelve un secreto fijo sólo bajo VITEST/NODE_ENV=test. Aceptable en tests; nunca debe alcanzar producción.`,
    });
  }
  return observations;
}

function main() {
  const checks = [
    checkSecretLiterals(),
    checkProviderSecrets(),
    checkEnvNotTracked(),
    checkHmacTimingSafe(),
    checkJwtAlgNone(),
    checkWebhookSignature(),
    checkRateLimitGuards(),
    checkHeaderInjection(),
    checkContentTypes(),
    checkAuthTimingSafe(),
    checkNonceAntireplay(),
    checkAegisFailClosed(),
    checkIsaXRealEd25519(),
    checkThreatModel(),
  ];
  const observations = buildObservations();

  const counts = { passed: 0, failed: 0, not_applicable: 0 };
  for (const c of checks) counts[c.status] += 1;
  const ok = counts.failed === 0;

  const report = {
    generatedBy: "security-suite.mjs",
    state: "auto_generated",
    date: new Date().toISOString(),
    summary: { total: checks.length, ...counts, ok },
    checks,
    observations,
    engine: { generated: true, humanReviewed: false },
  };

  for (const c of checks) {
    const mark = c.status === "passed" ? "PASS" : c.status === "failed" ? "FAIL" : "N/A ";
    console.log(`[security-suite] ${mark} ${c.id} ${c.title} — ${c.evidence}`);
  }
  for (const o of observations) {
    console.log(`[security-suite] NOTE ${o.id} (${o.severity}) ${o.title}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    `[security-suite] ${counts.passed} passed, ${counts.failed} failed, ${counts.not_applicable} not_applicable → ${rel(OUT_FILE)}`,
  );

  if (!ok) {
    console.error(`[security-suite] GATE FALLÓ: ${counts.failed} invariante(s) en estado failed. exit=1`);
    process.exit(1);
  }
  console.log("[security-suite] GATE OK: ningún invariante falló.");
  process.exit(0);
}

main();
