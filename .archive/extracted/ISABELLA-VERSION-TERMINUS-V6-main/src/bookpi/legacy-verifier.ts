/**
 * BookPI ledger legacy verifier / normalizer (bookpi.ledger.v5).
 * state: draft | engine-generated (pending human review). Pure and read-only:
 * it validates a legacy JSON event chain and normalizes it to the v5 shape
 * without inventing fields. It does not replace the durable ledger.
 */

import { sha256Hex, sha3_512Hex, ZERO_HASH } from "./crypto";

export const LEGACY_LEDGER_MAX_EVENTS = 1_000_000;
export const BOOKPI_EVENT_V5_SCHEMA = "bookpi.event.v5" as const;
export const BOOKPI_LEDGER_V5_SCHEMA = "bookpi.ledger.v5" as const;

export type LegacyActorType = "user" | "service" | "agent" | "system";
export type LedgerVerificationStatus = "pending" | "verified" | "invalid" | "unverified";

export interface LegacyLedgerEvent {
  index: number;
  timestamp: string;
  eventType: string;
  module: string;
  action: string;
  actor: string;
  data: Record<string, unknown>;
  prevHash: string;
  nonce: number;
  hash: string;
  cid?: string;
  signature?: string;
  keyId?: string;
}

export interface BookPiV5Event {
  schema: typeof BOOKPI_EVENT_V5_SCHEMA;
  eventId: string;
  sequence: number;
  timestamp: string;
  eventType: string;
  module: string;
  action: string;
  actor: { type: LegacyActorType; id: string; keyId?: string };
  policyVersion: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  previousEventHash: string;
  eventHash: string;
  nonce: number;
  signature?: { algorithm: "Ed25519"; keyId: string; value: string };
  storage:
    | { provider: "object-storage"; contentAddress: string }
    | { provider: "legacy-json" };
  verification: { status: LedgerVerificationStatus };
}

export interface LedgerValidationIssue {
  code: string;
  message: string;
  sequence?: number;
}

export interface LedgerValidationResult {
  valid: boolean;
  status: LedgerVerificationStatus;
  checked: number;
  total: number;
  issues: LedgerValidationIssue[];
  warnings: string[];
  firstInvalidSequence?: number;
}

export interface NormalizedLedger {
  schema: typeof BOOKPI_LEDGER_V5_SCHEMA;
  source: "legacy" | "bookpi-v5";
  generatedAt: string;
  validation: LedgerValidationResult;
  events: BookPiV5Event[];
}

const HASH_64 = /^[a-f0-9]{64}$/i;
const CID_V1 = /^bafy[a-z2-9]{20,}$/;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

function hashPayload(payload: Record<string, unknown>): string {
  return sha3_512Hex(canonical(payload));
}

function hashNormalizedEvent(event: BookPiV5Event): string {
  return sha256Hex(
    canonical({
      schema: event.schema,
      eventId: event.eventId,
      sequence: event.sequence,
      timestamp: event.timestamp,
      eventType: event.eventType,
      module: event.module,
      action: event.action,
      actorId: event.actor.id,
      policyVersion: event.policyVersion,
      payloadHash: event.payloadHash,
      previousEventHash: event.previousEventHash,
    }),
  );
}

function isValidTimestamp(value: string): boolean {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function addIssue(result: LedgerValidationResult, code: string, message: string, sequence?: number): void {
  result.issues.push({ code, message, sequence });
  if (result.firstInvalidSequence === undefined && sequence !== undefined) {
    result.firstInvalidSequence = sequence;
  }
}

function validateLegacyEvent(
  event: LegacyLedgerEvent,
  index: number,
  previous: LegacyLedgerEvent | undefined,
  result: LedgerValidationResult,
): void {
  if (event.index !== index) {
    addIssue(result, "INDEX_INVALID", `Índice esperado ${index}, recibido ${event.index}.`, event.index);
  }
  if (!Number.isSafeInteger(event.nonce) || event.nonce < 0) {
    addIssue(result, "NONCE_INVALID", "El nonce debe ser un entero seguro no negativo.", event.index);
  }
  if (!isValidTimestamp(event.timestamp)) {
    addIssue(result, "TIMESTAMP_INVALID", "El timestamp no es válido.", event.index);
  }
  if (!/^[a-z][a-z0-9_]*$/i.test(event.eventType) || event.eventType.length > 64) {
    addIssue(result, "EVENT_TYPE_INVALID", "eventType no cumple el formato permitido.", event.index);
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(event.module) || event.module.length > 64) {
    addIssue(result, "MODULE_INVALID", "module no cumple el formato permitido.", event.index);
  }
  if (!/^[a-z][a-z0-9_.]*$/.test(event.action) || event.action.length > 96) {
    addIssue(result, "ACTION_INVALID", "action no cumple el formato permitido.", event.index);
  }
  if (typeof event.actor !== "string" || event.actor.length === 0) {
    addIssue(result, "ACTOR_INVALID", "actor es obligatorio.", event.index);
  }
  if (!HASH_64.test(event.prevHash)) {
    addIssue(result, "PREVIOUS_HASH_INVALID", "prevHash no contiene 64 caracteres hexadecimales.", event.index);
  }
  if (!HASH_64.test(event.hash)) {
    addIssue(result, "EVENT_HASH_INVALID", "hash no contiene 64 caracteres hexadecimales.", event.index);
  }
  if (event.cid !== undefined && !CID_V1.test(event.cid)) {
    result.warnings.push(`CID no validado en el evento ${event.index}.`);
  }
  if (index === 0 && event.prevHash.toLowerCase() !== ZERO_HASH) {
    addIssue(result, "GENESIS_INVALID", "El primer evento debe apuntar al hash cero.", event.index);
  }
  if (previous) {
    if (event.prevHash.toLowerCase() !== previous.hash.toLowerCase()) {
      addIssue(result, "CHAIN_LINK_INVALID", "prevHash no coincide con el hash anterior.", event.index);
    }
    if (isValidTimestamp(event.timestamp) && isValidTimestamp(previous.timestamp) && Date.parse(event.timestamp) < Date.parse(previous.timestamp)) {
      addIssue(result, "TIMESTAMP_ORDER_INVALID", "El timestamp retrocede respecto al evento anterior.", event.index);
    }
  }
  if (event.eventType === "ai_decision" && event.action === "episode.register" && event.data.context === "boot") {
    result.warnings.push(`Evento episódico de boot detectado en ${event.index}.`);
  }
}

export function validateLegacyLedger(events: readonly LegacyLedgerEvent[]): LedgerValidationResult {
  const result: LedgerValidationResult = {
    valid: true,
    status: "verified",
    checked: 0,
    total: events.length,
    issues: [],
    warnings: [],
  };

  if (events.length === 0) {
    return {
      valid: false,
      status: "unverified",
      checked: 0,
      total: 0,
      issues: [{ code: "EMPTY_LEDGER", message: "El ledger está vacío." }],
      warnings: [],
    };
  }

  if (events.length > LEGACY_LEDGER_MAX_EVENTS) {
    addIssue(result, "LEDGER_TOO_LARGE", `El ledger supera el límite de ${LEGACY_LEDGER_MAX_EVENTS} eventos.`);
  }

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event) continue;
    validateLegacyEvent(event, i, events[i - 1], result);
  }

  result.checked = events.length;
  result.valid = result.issues.length === 0;
  result.status = result.valid ? (result.warnings.length > 0 ? "unverified" : "verified") : "invalid";
  return result;
}

export function normalizeLegacy(events: readonly LegacyLedgerEvent[]): BookPiV5Event[] {
  return events.map((event) => {
    const payloadHash = hashPayload(event.data);
    const eventId = typeof event.data.eventId === "string" ? event.data.eventId : `legacy-${event.index}`;
    const policyVersion = typeof event.data.version === "string" ? event.data.version : "unknown";
    const actorType: LegacyActorType = event.actor === "system" ? "system" : "service";
    return {
      schema: BOOKPI_EVENT_V5_SCHEMA,
      eventId,
      sequence: event.index + 1,
      timestamp: event.timestamp,
      eventType: event.eventType,
      module: event.module,
      action: event.action,
      actor: { type: actorType, id: event.actor, ...(event.keyId ? { keyId: event.keyId } : {}) },
      policyVersion,
      payload: event.data,
      payloadHash,
      previousEventHash: event.prevHash,
      eventHash: event.hash,
      nonce: event.nonce,
      ...(event.signature && event.keyId
        ? { signature: { algorithm: "Ed25519" as const, keyId: event.keyId, value: event.signature } }
        : {}),
      storage: event.cid
        ? { provider: "object-storage" as const, contentAddress: event.cid }
        : { provider: "legacy-json" as const },
      verification: { status: "unverified" as const },
    };
  });
}

export function verifyNormalizedHashes(events: readonly BookPiV5Event[]): LedgerValidationResult {
  const result: LedgerValidationResult = {
    valid: true,
    status: "verified",
    checked: 0,
    total: events.length,
    issues: [],
    warnings: [],
  };

  for (const event of events) {
    if (hashPayload(event.payload) !== event.payloadHash) {
      addIssue(result, "PAYLOAD_HASH_INVALID", `El payloadHash no coincide en la secuencia ${event.sequence}.`, event.sequence);
    }
    if (hashNormalizedEvent(event) !== event.eventHash) {
      result.warnings.push(
        `eventHash legacy no coincide en la secuencia ${event.sequence}; el algoritmo original puede ser distinto.`,
      );
    }
    result.checked += 1;
  }

  result.valid = result.issues.length === 0;
  result.status = result.valid ? (result.warnings.length > 0 ? "unverified" : "verified") : "invalid";
  return result;
}

export function normalizeLedger(events: readonly LegacyLedgerEvent[]): NormalizedLedger {
  const structure = validateLegacyLedger(events);
  const normalized = normalizeLegacy(events);
  const hashes = verifyNormalizedHashes(normalized);

  const valid = structure.valid && hashes.valid;
  const status: LedgerVerificationStatus = !valid
    ? "invalid"
    : structure.status === "unverified" || hashes.status === "unverified"
      ? "unverified"
      : "verified";

  const validation: LedgerValidationResult = {
    valid,
    status,
    checked: structure.checked,
    total: structure.total,
    issues: [...structure.issues, ...hashes.issues],
    warnings: [...structure.warnings, ...hashes.warnings],
    ...(structure.firstInvalidSequence !== undefined
      ? { firstInvalidSequence: structure.firstInvalidSequence }
      : hashes.firstInvalidSequence !== undefined
        ? { firstInvalidSequence: hashes.firstInvalidSequence }
        : {}),
  };

  return {
    schema: BOOKPI_LEDGER_V5_SCHEMA,
    source: "legacy",
    generatedAt: new Date().toISOString(),
    validation,
    events: normalized,
  };
}

export function emptyLegacyLedgerHash(): string {
  return ZERO_HASH;
}
