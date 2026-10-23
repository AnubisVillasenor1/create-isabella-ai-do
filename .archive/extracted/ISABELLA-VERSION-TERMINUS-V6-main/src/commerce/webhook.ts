/** COMMERCE — verificación de firma de webhook y procesamiento idempotente. */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export interface WebhookInput {
  provider: string;
  externalEventId: string;
  eventType: string;
}

export interface NormalizedWebhookEvent {
  provider: string;
  externalEventId: string;
  eventType: string;
  payloadHash: string;
  receivedAt: string;
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || secret.length === 0) return false;
  const candidate = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
  if (!/^[0-9a-f]{64}$/.test(candidate)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(candidate, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeWebhookEvent(input: WebhookInput): NormalizedWebhookEvent {
  if (!input.externalEventId || input.externalEventId.length > 256) {
    throw new Error("INVALID_EXTERNAL_EVENT_ID");
  }
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(input.provider)) {
    throw new Error("INVALID_PROVIDER");
  }
  if (!input.eventType || input.eventType.length > 64) {
    throw new Error("INVALID_EVENT_TYPE");
  }
  return {
    provider: input.provider,
    externalEventId: input.externalEventId,
    eventType: input.eventType,
    payloadHash: createHash("sha256").update(`${input.provider}.${input.externalEventId}`).digest("hex"),
    receivedAt: new Date().toISOString(),
  };
}

export interface IdempotencyRegistry {
  isDuplicate(key: string): boolean;
  consume(key: string): void;
}

export function createIdempotencyRegistry(): IdempotencyRegistry {
  const seen = new Set<string>();
  return {
    isDuplicate(key) {
      return seen.has(key);
    },
    consume(key) {
      seen.add(key);
    },
  };
}

export function idempotencyKey(provider: string, externalEventId: string): string {
  return `${provider}:${externalEventId}`;
}

export interface ProcessedWebhook {
  event: NormalizedWebhookEvent;
  dedupeKey: string;
  duplicate: boolean;
  recorded: boolean;
}

export function processWebhookEvent(
  input: WebhookInput,
  registry: IdempotencyRegistry,
): ProcessedWebhook {
  const event = normalizeWebhookEvent(input);
  const dedupeKey = idempotencyKey(event.provider, event.externalEventId);
  const duplicate = registry.isDuplicate(dedupeKey);
  if (duplicate) {
    return { event, dedupeKey, duplicate: true, recorded: false };
  }
  registry.consume(dedupeKey);
  return { event, dedupeKey, duplicate: false, recorded: true };
}

export function webhookEventId(): string {
  return randomUUID();
}

/**
 * Scheme de firma por proveedor. `raw-hmac-sha256` verifica HMAC-SHA256 sobre
 * el cuerpo crudo (`sha256=` o hex desnudo, estilo Stripe/GitHub/Linear).
 * `timestamped-hmac-sha256` verifica un token estilo Slack con `t=`/`v1=`
 * dentro de una ventana de tolerancia (replay prevention).
 */
export type SignatureScheme = "raw-hmac-sha256" | "timestamped-hmac-sha256";

export interface ProviderConfig {
  provider: string;
  scheme: SignatureScheme;
  secret: string;
  toleranceSeconds?: number;
}

export type WindowVerificationReason =
  | "OK"
  | "MISSING"
  | "MALFORMED"
  | "OUT_OF_WINDOW"
  | "BAD_SIGNATURE";

export interface WindowVerificationResult {
  valid: boolean;
  reason: WindowVerificationReason;
}

export interface WebhookWindowOptions {
  /** Tolerancia en segundos para aceptar el timestamp de la firma (default 300). */
  toleranceSeconds?: number;
  /** Reloj inyectable en épocas segundos; determinista para pruebas. */
  now?: () => number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

interface ParsedTimestampedSignature {
  version: "v0" | "v1";
  timestamp: number;
  digest: string;
}

function parseTimestampedSignature(signature: string): ParsedTimestampedSignature | undefined {
  const fields = new Map<string, string>();
  for (const part of signature.split(",")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    fields.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  const timestampRaw = fields.get("t");
  const version = fields.has("v1") ? "v1" : fields.has("v0") ? "v0" : undefined;
  const digest = version ? fields.get(version) : undefined;
  if (!timestampRaw || !version || !digest) return undefined;
  if (!/^\d{1,12}$/.test(timestampRaw)) return undefined;
  if (!/^[0-9a-fA-F]{64}$/.test(digest)) return undefined;
  return { version, timestamp: Number(timestampRaw), digest: digest.toLowerCase() };
}

/** Firma un evento con ventana de tiempo estilo Slack: `t=<epoch>,vN=<hmac>`. */
export function signWebhookWithWindow(
  rawBody: string,
  secret: string,
  timestampSeconds: number,
  version: "v0" | "v1" = "v1",
): string {
  const base = `${version}:${timestampSeconds}:${rawBody}`;
  const digest = createHmac("sha256", secret).update(base, "utf8").digest("hex");
  return `t=${timestampSeconds},${version}=${digest}`;
}

/**
 * Verifica firma con ventana de replay: el timestamp viaja en la propia firma
 * (`t=`/`v1=` a lo Slack). Fuera de la ventana de tolerancia devuelve
 * `OUT_OF_WINDOW` (replay). Variante detallada para razonar el veredicto.
 */
export function verifyWebhookWithWindowDetailed(
  rawBody: string,
  signature: string | undefined,
  secret: string,
  options: WebhookWindowOptions = {},
): WindowVerificationResult {
  if (!signature || secret.length === 0) return { valid: false, reason: "MISSING" };
  const parsed = parseTimestampedSignature(signature);
  if (!parsed) return { valid: false, reason: "MALFORMED" };
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = options.now ? options.now() : Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > tolerance) {
    return { valid: false, reason: "OUT_OF_WINDOW" };
  }
  const base = `${parsed.version}:${parsed.timestamp}:${rawBody}`;
  const expected = createHmac("sha256", secret).update(base, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parsed.digest, "hex");
  return a.length === b.length && timingSafeEqual(a, b)
    ? { valid: true, reason: "OK" }
    : { valid: false, reason: "BAD_SIGNATURE" };
}

/** Verdad conveniente sobre `verifyWebhookWithWindowDetailed`. */
export function verifyWebhookWithWindow(
  rawBody: string,
  signature: string | undefined,
  secret: string,
  options: WebhookWindowOptions = {},
): boolean {
  return verifyWebhookWithWindowDetailed(rawBody, signature, secret, options).valid;
}

/**
 * Verifica la firma ligándola al proveedor esperado (ISA-199/203/205): sin
 * config para el proveedor no hay firma válida. El proveedor decide el esquema.
 */
export function verifyProviderSignature(
  provider: string,
  rawBody: string,
  signature: string | undefined,
  configs: readonly ProviderConfig[],
  options: WebhookWindowOptions = {},
): WindowVerificationResult {
  const config = configs.find((c) => c.provider === provider);
  if (!config) return { valid: false, reason: "MISSING" };
  if (config.scheme === "timestamped-hmac-sha256") {
    return verifyWebhookWithWindowDetailed(rawBody, signature, config.secret, {
      toleranceSeconds: config.toleranceSeconds ?? options.toleranceSeconds,
      now: options.now,
    });
  }
  if (!signature || config.secret.length === 0) return { valid: false, reason: "MISSING" };
  return verifyWebhookSignature(rawBody, signature, config.secret)
    ? { valid: true, reason: "OK" }
    : { valid: false, reason: "BAD_SIGNATURE" };
}

/** Mapeo verificable de tenant sin DB: proveedor + prefijos opcionales de evento. */
export interface TenantMapping {
  provider: string;
  tenantId: string;
  /** Prefixos de `externalEventId` que acotan el mapeo a ese tenant. */
  eventPrefixes?: readonly string[];
}

export interface WebhookContext {
  provider: string;
  externalEventId: string;
  tenantId: string;
  signatureValid: boolean;
  receivedAt: string;
}

export interface ResolveTenantOptions {
  /** Si no hay mapeo, deriva un tenant determinista desde el proveedor. */
  allowFallback?: boolean;
}

/** Primero gana el mapeo sin prefijos; si todos tienen prefijos, pega el primero que cuadre. */
export function matchTenantMapping(
  provider: string,
  externalEventId: string,
  mappings: readonly TenantMapping[],
): TenantMapping | undefined {
  const normalized = provider.toLowerCase();
  let prefixMatch: TenantMapping | undefined;
  for (const mapping of mappings) {
    if (mapping.provider.toLowerCase() !== normalized) continue;
    if (!mapping.eventPrefixes || mapping.eventPrefixes.length === 0) return mapping;
    if (prefixMatch === undefined && mapping.eventPrefixes.some((prefix) => externalEventId.startsWith(prefix))) {
      prefixMatch = mapping;
    }
  }
  return prefixMatch;
}

/** Tenant determinista derivado del proveedor (fallback sin DB). */
export function deriveFallbackTenant(provider: string): string {
  return `tenant-${createHash("sha256").update(provider).digest("hex").slice(0, 16)}`;
}

/** Resuelve el tenant de un evento verificado; `undefined` si no hay mapeo ni fallback. */
export function resolveTenant(
  provider: string,
  externalEventId: string,
  mappings: readonly TenantMapping[] = [],
  options: ResolveTenantOptions = {},
): string | undefined {
  const mapping = matchTenantMapping(provider, externalEventId, mappings);
  if (mapping) return mapping.tenantId;
  if (options.allowFallback) return deriveFallbackTenant(provider);
  return undefined;
}

/** Deriva el tenant desde un key-id opcional incrustado en la firma (`k=`/`key=`/`keyid=`). */
export function mapTenantFromSignature(
  signature: string | undefined,
  keyIndex: Readonly<Record<string, string>>,
): string | undefined {
  if (!signature) return undefined;
  const keyId = extractKeyId(signature);
  if (!keyId) return undefined;
  return keyIndex[keyId];
}

function extractKeyId(signature: string): string | undefined {
  for (const part of signature.split(",")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) === "k" || trimmed.slice(0, eq) === "key" || trimmed.slice(0, eq) === "keyid") {
      const value = trimmed.slice(eq + 1);
      if (/^[A-Za-z0-9._-]{1,64}$/.test(value)) return value;
    }
  }
  return undefined;
}

function maskSecretValue(value: string): string {
  if (value.length <= 4) return "•••";
  return `${value.slice(0, 2)}•••`;
}

/**
 * Redacta secretos/firmas para logs y errores (ISA-217). Ejemplo:
 * `sha256=abcdef...` → `sha256=ab•••`. Nunca expone el hex completo.
 */
export function redactSecret(input: string): string {
  if (!input) return input;
  let output = input.replace(
    /\b(v0|v1|sha1|sha256)=([0-9a-fA-F]{4,})/g,
    (_match: string, key: string, value: string) => `${key}=${maskSecretValue(value)}`,
  );
  output = output.replace(
    /(bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi,
    (_match: string, prefix: string) => `${prefix}•••`,
  );
  output = output.replace(/\b[0-9a-fA-F]{32,}\b/g, (value: string) => maskSecretValue(value));
  output = output.replace(
    /\b(secret|signature|token|api[_-]?key|password|authorization|passwd)\b(\s*[:=]\s*)([^\s,;"']{4,})/gi,
    (_match: string, key: string, separator: string) => `${key}${separator}•••`,
  );
  return output;
}

/**
 * Semántica ACK tipada (ISA-210): solo `ACCEPTED` implica durable; los rechazos
 * no son retryable por el emisor salvo `RETRY` (fallo de persistencia).
 */
export enum AckOutcome {
  ACCEPTED = "ACCEPTED",
  DUPLICATE = "DUPLICATE",
  REJECTED_REPLAY = "REJECTED_REPLAY",
  REJECTED_SIGNATURE = "REJECTED_SIGNATURE",
  REJECTED_TENANT = "REJECTED_TENANT",
  REJECTED_MALFORMED = "REJECTED_MALFORMED",
  RETRY = "RETRY",
}

export interface AckDecision {
  status: number;
  code: AckOutcome;
  retryable: boolean;
  message: string;
}

export interface AckInput {
  outcome: AckOutcome;
  reason?: string;
}

export function ack(input: AckInput): AckDecision {
  switch (input.outcome) {
    case AckOutcome.ACCEPTED:
      return {
        status: 202,
        code: input.outcome,
        retryable: false,
        message: input.reason ?? "Event accepted and durably enqueued.",
      };
    case AckOutcome.DUPLICATE:
      return {
        status: 200,
        code: input.outcome,
        retryable: false,
        message: input.reason ?? "Duplicate event ignored.",
      };
    case AckOutcome.REJECTED_REPLAY:
      return {
        status: 409,
        code: input.outcome,
        retryable: false,
        message: input.reason ?? "Event is outside the replay window.",
      };
    case AckOutcome.REJECTED_SIGNATURE:
      return {
        status: 401,
        code: input.outcome,
        retryable: false,
        message: input.reason ?? "Signature verification failed.",
      };
    case AckOutcome.REJECTED_TENANT:
      return {
        status: 403,
        code: input.outcome,
        retryable: false,
        message: input.reason ?? "No tenant could be resolved for this event.",
      };
    case AckOutcome.REJECTED_MALFORMED:
      return {
        status: 400,
        code: input.outcome,
        retryable: false,
        message: input.reason ?? "Malformed event; parser internals are not exposed.",
      };
    case AckOutcome.RETRY:
      return {
        status: 503,
        code: input.outcome,
        retryable: true,
        message: input.reason ?? "Event not durably persisted; retry later.",
      };
    default:
      return { status: 500, code: AckOutcome.RETRY, retryable: true, message: "Unhandled ACK outcome." };
  }
}