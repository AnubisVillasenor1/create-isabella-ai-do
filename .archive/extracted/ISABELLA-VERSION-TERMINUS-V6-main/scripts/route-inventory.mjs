/**
 * route-inventory.mjs — Inventario estático de rutas HTTP (ISA-482 / ISA-451..458).
 *
 * Parsea `src/server.ts` (sin ejecutarlo), extrae cada `app.<method>(<path>, ...)`,
 * resume los controles observados (auth / rate-limit / validación) y cruza cada
 * ruta contra los contratos de tipo (`src/inference/types.ts`), la documentación
 * (`docs/spec/BLUEPRINT-API-v4.2.0.md`) y las pruebas que citan la ruta.
 *
 * Emite:
 *   - docs/api/route-inventory.json  (array de {route, method, handler, verified, ...})
 *   - docs/api/README.md             (tabla + instrucciones + "UI/API truthfulness")
 *
 * Sin dependencias. Ejecutable con: `node scripts/route-inventory.mjs`.
 * state: auto_generated (requiere revisión humana para pasar a `verified`).
 */
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SRC_DIR = path.join(REPO_ROOT, "src");
const SERVER_FILE = path.join(REPO_ROOT, "src", "server.ts");
const TYPES_FILE = path.join(REPO_ROOT, "src", "inference", "types.ts");
const API_BLUEPRINT = path.join(REPO_ROOT, "docs", "spec", "BLUEPRINT-API-v4.2.0.md");
const TEST_DIR = path.join(REPO_ROOT, "test");
const OUT_DIR = path.join(REPO_ROOT, "docs", "api");
const OUT_JSON = path.join(OUT_DIR, "route-inventory.json");
const OUT_MD = path.join(OUT_DIR, "README.md");

const SENSITIVE_TOKENS = [
  "admin", "ingest", "resolve", "security", "governance", "execute", "invoke",
  "act", "attest", "verify", "harden", "admit", "scan", "route", "mediate",
  "entropy", "generate", "deployment", "quality-gates", "verify-agent-app",
  "lifecycle-plan", "diff", "sanitization", "knowledge", "triangulate", "pipeline",
  "readiness", "cognition", "cognitive",
];

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function extractServerRoutes(source, relFile = "src/server.ts") {
  const routeRe = /app\.(get|post|put|patch|delete)\(\s*(["'])([^"']+)\2\s*,/g;
  const raw = [];
  let match;
  while ((match = routeRe.exec(source)) !== null) {
    raw.push({
      method: match[1].toUpperCase(),
      route: match[3],
      index: match.index,
      bodyStart: routeRe.lastIndex,
    });
  }
  return raw.map((entry, i) => {
    const bodyEnd = i + 1 < raw.length ? raw[i + 1].index : source.length;
    const segment = source.slice(entry.bodyStart, bodyEnd);
    const arrow = segment.match(/^\s*(?:async\s*)?\(([^)]*)\)\s*=>/);
    const named = segment.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*[,)]/);
    const line = lineOf(source, entry.index);
    return {
      method: entry.method,
      route: entry.route,
      line,
      params: arrow ? arrow[1].replace(/\s+/g, " ").trim() : "",
      handler: named && !arrow ? `${named[1]}@${relFile}:${line}` : `inline@${relFile}:${line}`,
      segment,
    };
  });
}

/**
 * Walks every `.ts` module under `src/` and collects route registrations. Route
 * groups extracted out of the monolith (e.g. `src/routes/hypercore.ts`) are
 * inventoried exactly like the ones still in `src/server.ts`.
 */
function collectAllRoutes() {
  const routes = [];
  if (!fs.existsSync(SRC_DIR)) return routes;
  for (const rel of fs.readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" })) {
    if (!rel.endsWith(".ts")) continue;
    const abs = path.join(SRC_DIR, rel);
    const relFile = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
    routes.push(...extractServerRoutes(readText(abs), relFile));
  }
  return routes;
}

function extractTypeContracts() {
  const source = readText(TYPES_FILE);
  const names = new Set();
  for (const m of source.matchAll(/\b(?:interface|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
    names.add(m[1]);
  }
  return [...names];
}

function listFiles(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const rel of fs.readdirSync(dir, { recursive: true })) {
    const abs = path.join(dir, rel);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.isFile() && predicate(abs)) out.push(abs);
  }
  return out;
}

function collectRouteReferences() {
  const references = new Map();
  const record = (routePath, basis) => {
    if (!references.has(routePath)) references.set(routePath, []);
    references.get(routePath).push(basis);
  };

  // Pruebas que citan literalmente la ruta.
  for (const file of listFiles(TEST_DIR, (f) => /\.(test|spec)\.(ts|mjs|js)$/.test(f))) {
    const text = readText(file);
    for (const m of text.matchAll(/["'`](\/api\/v1\/[^"'`\s]+)["'`]/g)) {
      record(m[1], `test:${path.relative(REPO_ROOT, file).replace(/\\/g, "/")}`);
    }
  }

  // Documentación de API (blueprint canónico).
  if (fs.existsSync(API_BLUEPRINT)) {
    const text = readText(API_BLUEPRINT);
    for (const m of text.matchAll(/`(?:GET|POST|PUT|PATCH|DELETE)\s+(\/api\/v1\/[^`\s]+)`/g)) {
      record(m[1], `docs:${path.relative(REPO_ROOT, API_BLUEPRINT).replace(/\\/g, "/")}`);
    }
  }

  return references;
}

function domainToken(routePath) {
  const parts = routePath.split("/").filter((p) => p && p !== "api" && p !== "v1" && !p.startsWith(":"));
  return parts[0] ?? "";
}

function controlsFor(segment) {
  const auth = /authorizeApiToken\s*\(|verifyBearerToken\s*\(|assertBalancedAuthority\s*\(/.test(segment);
  const rateLimit = /enforceRateLimit\s*\(/.test(segment);
  const touchesInput = /req\.(body|params|query)/.test(segment);
  const validates =
    touchesInput &&
    /(throw new Error|\.status\(4\d\d\)|INVALID_|must be|typeof |Array\.isArray|\.trim\(\)|JSON\.stringify\()/.test(segment);
  return { auth, rateLimit, inputValidation: validates };
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`[route-inventory] No existe ${path.relative(REPO_ROOT, SRC_DIR)}. Nada que inventariar.`);
    process.exit(1);
  }

  const entries = collectAllRoutes();
  const typeContracts = extractTypeContracts();
  const references = collectRouteReferences();

  const routes = entries.map((entry) => {
    const sensitive =
      entry.method !== "GET" || SENSITIVE_TOKENS.some((token) => entry.route.toLowerCase().includes(token));
    const controls = controlsFor(entry.segment);

    const bases = [];
    for (const [refPath, why] of references.entries()) {
      if (
        refPath === entry.route ||
        (refPath.includes(":") && entry.route.startsWith(refPath.split(":")[0]))
      ) {
        bases.push(...why);
      }
    }
    const token = domainToken(entry.route).toLowerCase();
    const matchingContract = token
      ? typeContracts.find((name) => name.toLowerCase().includes(token))
      : undefined;
    if (matchingContract) {
      bases.push(`types:src/inference/types.ts:${matchingContract}`);
    }

    const verified = bases.length > 0;
    return {
      route: entry.route,
      method: entry.method,
      handler: entry.handler,
      verified,
      line: entry.line,
      sensitive,
      controls,
      verificationBasis: bases.length > 0 ? [...new Set(bases)].join(", ") : "sin contrato de tipo, doc o prueba que lo ejercite",
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(routes, null, 2)}\n`, "utf8");
  fs.writeFileSync(OUT_MD, renderMarkdown(routes, typeContracts), "utf8");

  const verifiedCount = routes.filter((r) => r.verified).length;
  const sensitiveCount = routes.filter((r) => r.sensitive).length;
  console.log(
    `[route-inventory] ${routes.length} rutas extra��das de src/ ` +
      `(${sensitiveCount} sensibles, ${verifiedCount} con contrato verificado).`,
  );
  console.log(`[route-inventory] Escrito: ${path.relative(REPO_ROOT, OUT_JSON).replace(/\\/g, "/")}`);
  console.log(`[route-inventory] Escrito: ${path.relative(REPO_ROOT, OUT_MD).replace(/\\/g, "/")}`);
  if (routes.length === 0) {
    console.warn("[route-inventory] AVISO: no se detectaron rutas parseables en src/.");
  }
}

function renderMarkdown(routes, typeContracts) {
  const verifiedCount = routes.filter((r) => r.verified).length;
  const sensitiveCount = routes.filter((r) => r.sensitive).length;
  const generatedAt = new Date().toISOString();

  const rows = routes
    .map((r) => {
      const check = (v) => (v ? "sí" : "no");
      const handlerLabel = r.handler;
      return `| \`${r.method}\` | \`${r.route}\` | \`${handlerLabel}\` | ${check(r.sensitive)} | ${check(
        r.controls.auth,
      )} | ${check(r.controls.rateLimit)} | ${check(r.controls.inputValidation)} | ${check(r.verified)} |`;
    })
    .join("\n");

  const unverified = routes.filter((r) => !r.verified);

  return `# Inventario de rutas de API — Isabella Genesis V6

> Archivo **generado automáticamente** por \`scripts/route-inventory.mjs\`.
> \`state: auto_generated\` — no editar a mano; requiere revisión humana para ser
> evidencia (*CAPABILITY ≠ AUTHORITY ≠ EVIDENCE*, AGENTS.md).

- **Generado:** ${generatedAt}
- **Fuente:** \`src/server.ts\` (parseo estático, sin ejecutar el servidor)
- **Rutas totales:** ${routes.length} · **Sensibles:** ${sensitiveCount} · **Con contrato verificado:** ${verifiedCount}
- **Contratos de tipo considerados:** ${typeContracts.map((c) => `\`${c}\``).join(", ") || "ninguno"}

## Tabla de rutas

| Método | Ruta | Handler | Sensible | Auth | Rate-limit | Validación | Verificado |
|---|---|---|---|---|---|---|---|
${rows || "| — | _sin rutas parseables_ | — | — | — | — | — | — |"}

> Las columnas **Auth**, **Rate-limit** y **Validación** son heurísticas de análisis
> estático sobre el cuerpo del handler (presencia de \`authorizeApiToken\` /
> \`verifyBearerToken\` / \`assertBalancedAuthority\`, \`enforceRateLimit\` y guardas de
> entrada). No son una prueba en ejecución.

## Cómo regenerar

\`\`\`bash
node scripts/route-inventory.mjs
\`\`\`

El script reescribe por completo \`docs/api/route-inventory.json\` y este README.
No requiere dependencias ni red. Si \`src/server.ts\` no tiene rutas parseables,
reporta la verdad: lista vacía + aviso en consola.

## Semántica de \`verified\`

\`verified: true\` **no** significa "la ruta funciona". Significa que existe al menos
una referencia externa al contrato de la ruta:

1. una **prueba** que cita la ruta (\`test:...\`), o
2. la **documentación** canónica (\`docs:docs/spec/BLUEPRINT-API-v4.2.0.md\`), o
3. un **contrato de tipo** cuyo nombre comparte el dominio de la ruta
   (\`types:src/inference/types.ts:...\`).

Ser simplemente un handler de Express tipado por inferencia **no** cuenta como
verificado. Hoy la mayoría de rutas queda con \`verified: false\` (${unverified.length} de ${routes.length});
eso es el estado real del repositorio, no un defecto del script.

## UI/API truthfulness (ISA-451..458)

Este inventario es la **base de veracidad** para cualquier superficie de UI o
catálogo de API:

- **ISA-451 (MoE UI truth):** si el catálogo etiqueta una ruta como "DeepSeek-V3"
  o "MoE", debe apuntar a una fila con \`verified: true\` y con un contrato
  respaldado; si no, la UI debe rotularla como heurística/simulación.
- **ISA-452/453 (CoT/Swarm UI truth):** las trazas de razonamiento y las
  estrategias de enjambre deben declarse simuladas salvo que mapeen a una ruta
  verificada de este inventario.
- **ISA-454 (RAG UI truth):** la presentación de RAG debe ligarse a la ruta de
  memoria/retrieval realmente inventariada, no a datos de ejemplo.
- **ISA-455..458 (simulador / tenant / actor):** toda acción privilegiada del
  simulador debe corresponder a una ruta sensible con \`Auth: sí\`; la UI nunca
  debe enviar \`tenantId\`/\`actorId\` como autoridad — el servidor debe derivarlos.
  Las rutas sensibles **sin** auth/rate-limit/validación son deuda explícita
  visible en la tabla.
- **ISA-475 (claim-to-code map):** este archivo es el mapa "claim → ruta
  ejecutable" que exige el checklist.

## Evidencia y \`.gitignore\`

Los artefactos en \`evidence/*.json\` (p. ej. \`production-evidence.json\`,
\`security-suite.json\`) **no** se versionan: la línea \`evidence/*.json\` se añade al
\`.gitignore\` del repositorio por el ensamblador. La evidencia misma se adjunta
como artefacto de CI ligado al SHA exacto (ISA-325 / ISA-336 / ISA-337).
`;
}

main();
