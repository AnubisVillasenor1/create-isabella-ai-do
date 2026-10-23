#!/usr/bin/env node
/**
 * generate-native-keys.mjs — emite las claves NATIVAS del proyecto.
 *
 * "Nativas" = las que la propia plataforma genera y consume (secretos simétricos,
 * tokens bearer y el par de firma Ed25519 de aprobación humana). NO genera claves
 * de proveedores externos (OPENROUTER_API_KEY, HF_TOKEN, SUPABASE_*, POSTGRES_*):
 * esas pertenecen a cuentas del humano y se configuran aparte.
 *
 * state: generated | local-only. El archivo de salida (`.env.native` por defecto)
 * está cubierto por la regla .gitignore `.env.*` y NO debe versionarse. Nunca se
 * imprimen los valores secretos en la consola; solo el nombre y una huella corta.
 *
 * Uso:
 *   node scripts/generate-native-keys.mjs [--force] [--out=.env.native]
 *                                         [--approver=<id-humano>]
 */
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const outArg = argv.find((a) => a.startsWith("--out="));
const approverArg = argv.find((a) => a.startsWith("--approver="));
const OUT = path.resolve(outArg ? outArg.slice("--out=".length) : ".env.native");
const APPROVER = (approverArg ? approverArg.slice("--approver=".length) : "edwin.oswaldo.castillo.trejo").trim();

const secret = () => randomBytes(48).toString("base64url");
const token = () => randomBytes(32).toString("base64url");
const hexKey = () => randomBytes(32).toString("hex");
const fingerprint = (value) => createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);

if (existsSync(OUT) && !force) {
  console.error(`[keys] ${path.basename(OUT)} ya existe. Usa --force para rotar (sobrescribe).`);
  process.exit(1);
}

const bookpiSecret = secret();
const hypercoreSigningKey = secret();
const genesisAdminToken = token();
const genesisPublicToken = token();
const hypercoreApiToken = token();
const hsfApiToken = token();
const humanApprovalToken = token();
const opsApiToken = token();
const connectorWebhookSecret = secret();
const webhookSigningSecret = secret();
const tokenEncryptionKey = hexKey();

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const publicPem = publicKey.export({ format: "pem", type: "spki" }).toString();
const keyId = `ed25519-native-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString("hex")}`;
const publicFingerprint = fingerprint(publicPem);

const quote = (value) => `"${value.replace(/\n/g, "\\n")}"`;

const lines = [
  "# =============================================================================",
  "# Isabella Villaseñor AI — claves NATIVAS del proyecto",
  `# generado: ${new Date().toISOString()}`,
  "# state: generated | local-only. NO versionar (cubierto por .gitignore `.env.*`).",
  "# Cargar:  node --env-file=.env.native dist/server.js   (o `pnpm run start:native`)",
  "# Rotar:   pnpm run keys:generate -- --force   y recargar los consumidores.",
  "# Las claves de proveedores externos (OPENROUTER_API_KEY, HF_TOKEN, SUPABASE_*,",
  "# POSTGRES_*) NO se generan aquí: pertenecen a cuentas del operador humano.",
  "# =============================================================================",
  "",
  "# --- T3 · integridad de evidencia (segredo simétrico HMAC/SHA3, >=32 chars) ---",
  `BOOKPI_INTEGRITY_SECRET=${quote(bookpiSecret)}`,
  `HYPERCORE_SIGNING_KEY=${quote(hypercoreSigningKey)}`,
  "",
  "# --- APIs protegidas (bearer tokens, >=32 chars) ---",
  `GENESIS_ADMIN_API_TOKEN=${quote(genesisAdminToken)}`,
  `GENESIS_PUBLIC_API_TOKEN=${quote(genesisPublicToken)}`,
  `HYPERCORE_API_TOKEN=${quote(hypercoreApiToken)}`,
  `HSF_API_TOKEN=${quote(hsfApiToken)}`,
  `GENESIS_HUMAN_APPROVAL_TOKEN=${quote(humanApprovalToken)}`,
  `GENESIS_HUMAN_APPROVER_ID=${quote(APPROVER)}`,
  `OPS_API_TOKEN=${quote(opsApiToken)}`,
  "",
  "# --- Webhooks de conectores (HMAC) ---",
  `CONNECTOR_WEBHOOK_SECRET=${quote(connectorWebhookSecret)}`,
  `WEBHOOK_SIGNING_SECRET=${quote(webhookSigningSecret)}`,
  `CONNECTOR_PROVIDERS=${quote("stripe,github,slack,linear")}`,
  `CONNECTOR_TENANT_MAP=${quote("")}`,
  "",
  "# --- Cifrado de tokens (reservado; AES-256-GCM, 32 bytes hex) ---",
  `TOKEN_ENCRYPTION_KEY=${quote(tokenEncryptionKey)}`,
  "",
  "# --- T2/T3 · firmante Ed25519 de aprobación humana ---",
  `ISABELLA_APPROVAL_KEY_ID=${quote(keyId)}`,
  `ISABELLA_APPROVAL_PRIVATE_KEY_PEM=${quote(privatePem)}`,
  `ISABELLA_APPROVAL_TRUSTED_KEY_ID=${quote(keyId)}`,
  `ISABELLA_APPROVAL_TRUSTED_PUBLIC_KEY_PEM=${quote(publicPem)}`,
  `ISABELLA_APPROVAL_TRUSTED_APPROVER_ID=${quote(APPROVER)}`,
  "",
  "# --- Rutas de persistencia local (no secretas) ---",
  `APP_PUBLIC_URL=${quote("http://localhost:3000")}`,
  `BOOKPI_LEDGER_PATH=${quote("./data/bookpi/ledger.jsonl")}`,
  `GAMEOVER_PASSPORT_PATH=${quote("./data/gameover/passports.json")}`,
  "",
];

writeFileSync(OUT, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
try {
  chmodSync(OUT, 0o600);
} catch {
  /* best-effort on platforms without POSIX modes */
}

const summary = [
  ["BOOKPI_INTEGRITY_SECRET", bookpiSecret],
  ["HYPERCORE_SIGNING_KEY", hypercoreSigningKey],
  ["GENESIS_ADMIN_API_TOKEN", genesisAdminToken],
  ["GENESIS_PUBLIC_API_TOKEN", genesisPublicToken],
  ["HYPERCORE_API_TOKEN", hypercoreApiToken],
  ["HSF_API_TOKEN", hsfApiToken],
  ["GENESIS_HUMAN_APPROVAL_TOKEN", humanApprovalToken],
  ["OPS_API_TOKEN", opsApiToken],
  ["CONNECTOR_WEBHOOK_SECRET", connectorWebhookSecret],
  ["WEBHOOK_SIGNING_SECRET", webhookSigningSecret],
  ["TOKEN_ENCRYPTION_KEY", tokenEncryptionKey],
];

console.log(`[keys] Escrito: ${OUT}`);
for (const [name, value] of summary) console.log(`[keys]   ${name.padEnd(34)} sha256:${fingerprint(value)}`);
console.log(`[keys]   ISABELLA_APPROVAL_KEY_ID         ${keyId}`);
console.log(`[keys]   ISABELLA_APPROVAL_PUBLIC(fpr)    ${publicFingerprint}`);
console.log(`[keys] aprobador humano vinculado: ${APPROVER}`);
console.log("[keys] Los valores están SOLO en el archivo; no se imprimen en consola.");
