// state: draft | engine-generated
//
// Deterministic serialization. Persisting and transporting a native model
// required a canonical byte form so that a hash computed on one host verifies on
// another; ad-hoc JSON.stringify does not guarantee key order. This adds a
// stable, recursively key-sorted serializer with a checksum envelope and a
// verify-on-deserialize path that refuses tampered payloads. Integrity of a
// blob is not endorsement of a model — approval lives in the registry.

import { createHash } from 'node:crypto';

export interface SerdeEnvelope<T> {
  format: 'isabella.native-ml.v1';
  checksum: string;
  payload: T;
}

/** Recursively sort object keys so serialization is stable across engines. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return String(value);
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = canonical(v);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new Error('non_finite_not_serializable');
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonical(value));
}

export function checksum(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

export function serialize<T>(payload: T): SerdeEnvelope<T> {
  const body = canonical(payload);
  return { format: 'isabella.native-ml.v1', checksum: checksum(body), payload: body as T };
}

export function serializeToText<T>(payload: T): string {
  return canonicalStringify(serialize(payload));
}

/** Deserialize and verify; throws on checksum mismatch or malformed envelope. */
export function deserialize<T>(text: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid_serde_json');
  }
  return unwrapEnvelope<T>(parsed);
}

export function unwrapEnvelope<T>(parsed: unknown): T {
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid_envelope');
  const env = parsed as Partial<SerdeEnvelope<T>>;
  if (env.format !== 'isabella.native-ml.v1') throw new Error('unsupported_serde_format');
  if (typeof env.checksum !== 'string' || env.payload === undefined)
    throw new Error('invalid_envelope');
  if (checksum(env.payload) !== env.checksum) throw new Error('serde_checksum_mismatch');
  return env.payload as T;
}

/** Verify an already-parsed envelope's integrity without trusting its payload. */
export function verifyEnvelope<T>(env: SerdeEnvelope<T>): boolean {
  try {
    return checksum(env.payload) === env.checksum;
  } catch {
    return false;
  }
}
