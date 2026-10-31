import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { BookPiEventCore, BookPiEventRecord, JsonValue } from './types';
import { bookPiSecret } from '../security/secrets';
import { sha256Hex } from '../lib/sha256';

export const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function canonicalJson(value: JsonValue): string {
  return stableStringify(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export { sha256Hex } from '../lib/sha256';

export function sha3_512Hex(input: string): string {
  return createHash('sha3-512').update(input, 'utf8').digest('hex');
}

export function hmacSha256Hex(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input, 'utf8').digest('hex');
}

/** Núcleo canónico del evento (excluye integrity/hash/canonical). */
export function eventCore(seed: BookPiEventCore): string {
  return canonicalJson({
    type: seed.type,
    id: seed.id,
    sequence: seed.sequence,
    prevHash: seed.prevHash,
    timestamp: seed.timestamp,
    ...(seed.actorId ? { actorId: seed.actorId } : {}),
    header: seed.header,
    payload: seed.payload,
    schemaVersion: seed.schemaVersion,
    meta: seed.meta,
  });
}

export function computeEventHash(seed: BookPiEventCore): string {
  return sha256Hex(eventCore(seed));
}

/** Integridad: SHA3-512(secret || eventHash), distinta del hash canónico del evento. */
export function computeEventIntegrity(hash: string, secret?: string): string {
  return sha3_512Hex(`${bookPiSecret(secret)}:${hash}`);
}

export function signEvent(eventHash: string, actorId: string, secret: string): string {
  return hmacSha256Hex(`${actorId}:${eventHash}`, secret);
}

export function verifyEventSignature(
  signature: string,
  eventHash: string,
  actorId: string,
  secret: string
): boolean {
  const expected = signEvent(eventHash, actorId, secret);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyChainLink(record: BookPiEventRecord, secret?: string): boolean {
  const recomputedHash = computeEventHash(record);
  const recomputedIntegrity = computeEventIntegrity(recomputedHash, secret);
  return recomputedHash === record.hash && recomputedIntegrity === record.integrity;
}

export function recomputeRecord(record: BookPiEventRecord, secret?: string): boolean {
  return verifyChainLink(record, secret);
}
