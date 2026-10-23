/**
 * Atlas canonical events — modelo de eventos EDA disciplinada (Atlas Trascendence).
 *
 * Define los 15 eventos canónicos con payloads tipados, un constructor que valida
 * los campos requeridos y un envoltorio idempotente. No publica: produce el sobre
 * de evento; el bus/entrega pertenece a infraestructura externa.
 */
import { createHash, randomUUID } from "node:crypto";

export const ATLAS_EVENT_TYPES = [
  "identity.linked",
  "identity.unlinked",
  "documents.created",
  "documents.versioned",
  "documents.state_changed",
  "publications.requested",
  "publications.doi_reserved",
  "publications.completed",
  "publications.failed",
  "federations.anchored",
  "federations.consistency_checked",
  "security.policy_violated",
  "security.incident_detected",
  "security.key_rotated",
  "backups.completed",
] as const;

export type AtlasEventType = (typeof ATLAS_EVENT_TYPES)[number];

export interface AtlasEventPayloads {
  "identity.linked": { atlas_identity_id: string; provider: string; external_id: string };
  "identity.unlinked": { atlas_identity_id: string; provider: string; external_id: string };
  "documents.created": {
    document_uid: string; federation_id: string; namespace: string;
    title: string; created_by: string; version: number; canonical_hash: string;
  };
  "documents.versioned": {
    document_uid: string; previous_version: number; new_version: number;
    canonical_hash_before: string; canonical_hash_after: string;
  };
  "documents.state_changed": { document_uid: string; old_state: string; new_state: string; reason: string };
  "publications.requested": { document_uid: string; providers: readonly string[]; requested_by: string };
  "publications.doi_reserved": { document_uid: string; provider: string; doi: string; reservation_timestamp: string };
  "publications.completed": { document_uid: string; results: readonly { provider: string; status: string; external_ref?: string; doi?: string }[] };
  "publications.failed": { document_uid: string; provider: string; error_code: string; error_message: string; attempts: number };
  "federations.anchored": { anchor_id: string; document_uid: string; federations: readonly { federation_id: string; hash: string; timestamp: string }[] };
  "federations.consistency_checked": { anchor_id: string; status: "consistent" | "inconsistent"; mismatches: readonly string[] };
  "security.policy_violated": {
    policy_id: string; actor_id: string; resource_type: string; resource_id: string;
    federation_id: string; risk_level: string; details: Readonly<Record<string, unknown>>;
  };
  "security.incident_detected": {
    incident_id: string; type: string; severity: string;
    affected_identities: readonly string[]; affected_documents: readonly string[]; summary: string;
  };
  "security.key_rotated": { key_id: string; scope: string; rotated_at: string };
  "backups.completed": { backup_id: string; target: string; status: string; started_at: string; completed_at: string; size_bytes: number };
}

export type AtlasEventName = keyof AtlasEventPayloads;

export interface AtlasEvent<K extends AtlasEventName = AtlasEventName> {
  event_type: K;
  event_id: string;
  idempotency_key: string;
  occurred_at: string;
  payload: AtlasEventPayloads[K];
}

const REQUIRED_FIELDS: Readonly<Record<AtlasEventName, readonly string[]>> = {
  "identity.linked": ["atlas_identity_id", "provider", "external_id"],
  "identity.unlinked": ["atlas_identity_id", "provider", "external_id"],
  "documents.created": ["document_uid", "federation_id", "namespace", "title", "created_by", "version", "canonical_hash"],
  "documents.versioned": ["document_uid", "previous_version", "new_version", "canonical_hash_before", "canonical_hash_after"],
  "documents.state_changed": ["document_uid", "old_state", "new_state", "reason"],
  "publications.requested": ["document_uid", "providers", "requested_by"],
  "publications.doi_reserved": ["document_uid", "provider", "doi", "reservation_timestamp"],
  "publications.completed": ["document_uid", "results"],
  "publications.failed": ["document_uid", "provider", "error_code", "error_message", "attempts"],
  "federations.anchored": ["anchor_id", "document_uid", "federations"],
  "federations.consistency_checked": ["anchor_id", "status", "mismatches"],
  "security.policy_violated": ["policy_id", "actor_id", "resource_type", "resource_id", "federation_id", "risk_level", "details"],
  "security.incident_detected": ["incident_id", "type", "severity", "affected_identities", "affected_documents", "summary"],
  "security.key_rotated": ["key_id", "scope", "rotated_at"],
  "backups.completed": ["backup_id", "target", "status", "started_at", "completed_at", "size_bytes"],
};

/** Clave de idempotencia determinista a partir del tipo y el payload. */
export function idempotencyKey<K extends AtlasEventName>(eventType: K, payload: AtlasEventPayloads[K]): string {
  return createHash("sha256").update(`${eventType}:${JSON.stringify(payload)}`).digest("hex");
}

/** Construye y valida un evento canónico; falla si faltan campos requeridos. */
export function buildAtlasEvent<K extends AtlasEventName>(
  eventType: K,
  payload: AtlasEventPayloads[K],
  opts: { occurredAt?: string; eventId?: string } = {},
): AtlasEvent<K> {
  const required = REQUIRED_FIELDS[eventType];
  const record = payload as unknown as Record<string, unknown>;
  const missing = required.filter((field) => record[field] === undefined || record[field] === null);
  if (missing.length > 0) throw new Error(`ATLAS_EVENTS: ${eventType} missing required fields: ${missing.join(",")}`);
  return {
    event_type: eventType,
    event_id: opts.eventId ?? randomUUID(),
    idempotency_key: idempotencyKey(eventType, payload),
    occurred_at: opts.occurredAt ?? new Date().toISOString(),
    payload,
  };
}

export function isKnownAtlasEventType(value: string): value is AtlasEventName {
  return (ATLAS_EVENT_TYPES as readonly string[]).includes(value);
}