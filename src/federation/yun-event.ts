import { createHash, randomUUID } from 'node:crypto';

export const YUN_EVENT_SCHEMA_VERSION = '1.0.0' as const;

export type YunSeverity = 'info' | 'warning' | 'error' | 'critical' | 'audit';
export type YunJsonValue =
  null | boolean | number | string | YunJsonValue[] | { [key: string]: YunJsonValue };

export interface YunEventInput {
  event_type: string;
  domain: string;
  federation_id: string;
  entity_id: string;
  trace_id: string;
  timestamp: string;
  severity: YunSeverity;
  payload: { [key: string]: YunJsonValue };
}

export interface YunEvent extends YunEventInput {
  event_id: string;
  schema_version: typeof YUN_EVENT_SCHEMA_VERSION;
  event_hash: string;
  integrity_scope: 'canonical_event_content_only';
}

const MAX_IDENTIFIER_LENGTH = 160;
const MAX_EVENT_TYPE_LENGTH = 120;
const MAX_PAYLOAD_BYTES = 32 * 1024;
const SEVERITIES = new Set<YunSeverity>(['info', 'warning', 'error', 'critical', 'audit']);

function requiredString(value: unknown, field: string, maxLength = MAX_IDENTIFIER_LENGTH): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} must not be empty`);
  if (normalized.length > maxLength)
    throw new RangeError(`${field} exceeds ${maxLength} characters`);
  if (/[\u0000-\u001f\u007f]/.test(normalized))
    throw new TypeError(`${field} contains control characters`);
  return normalized;
}

function canonicalize(value: YunJsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('payload numbers must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  const record = value as { [key: string]: YunJsonValue };
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key] as YunJsonValue)}`).join(',')}}`;
}

function cloneJson(value: YunJsonValue): YunJsonValue {
  // JSON round-trip rejects cycles and strips prototypes; canonicalize validates numbers.
  canonicalize(value);
  return JSON.parse(JSON.stringify(value)) as YunJsonValue;
}

/**
 * Validate a YUN event and attach a deterministic SHA-256 content hash.
 * This is not a digital signature, durable ledger, bus publish, or proof of truth.
 */
export function createYunEvent(input: YunEventInput, eventId = cryptoRandomId()): YunEvent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('event input must be an object');
  }
  if (!SEVERITIES.has(input.severity)) throw new TypeError('severity is not supported');

  const payload = cloneJson(input.payload);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('payload must be a JSON object');
  }
  const payloadBytes = Buffer.byteLength(canonicalize(payload), 'utf8');
  if (payloadBytes > MAX_PAYLOAD_BYTES)
    throw new RangeError(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);

  const timestamp = requiredString(input.timestamp, 'timestamp', 40);
  const parsedTime = Date.parse(timestamp);
  if (!Number.isFinite(parsedTime) || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(timestamp)) {
    throw new TypeError('timestamp must be an ISO-8601 UTC timestamp ending in Z');
  }

  const event: Omit<YunEvent, 'event_hash'> = {
    event_id: requiredString(eventId, 'event_id'),
    event_type: requiredString(input.event_type, 'event_type', MAX_EVENT_TYPE_LENGTH),
    domain: requiredString(input.domain, 'domain'),
    federation_id: requiredString(input.federation_id, 'federation_id'),
    entity_id: requiredString(input.entity_id, 'entity_id'),
    trace_id: requiredString(input.trace_id, 'trace_id'),
    timestamp: new Date(parsedTime).toISOString(),
    severity: input.severity,
    payload,
    schema_version: YUN_EVENT_SCHEMA_VERSION,
    integrity_scope: 'canonical_event_content_only',
  };
  const event_hash = createHash('sha256')
    .update(canonicalize(event as unknown as YunJsonValue), 'utf8')
    .digest('hex');

  return deepFreeze({ ...event, event_hash }) as YunEvent;
}

export function verifyYunEvent(event: YunEvent): boolean {
  if (!event || typeof event !== 'object' || typeof event.event_hash !== 'string') return false;
  try {
    const { event_hash, ...content } = event;
    const expected = createHash('sha256')
      .update(canonicalize(content as unknown as YunJsonValue), 'utf8')
      .digest('hex');
    const actual = Buffer.from(event_hash, 'hex');
    const expectedBytes = Buffer.from(expected, 'hex');
    return actual.length === expectedBytes.length && actual.equals(expectedBytes);
  } catch {
    return false;
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function cryptoRandomId(): string {
  // UUID generation uses the Node runtime's cryptographic source.
  return randomUUID();
}
