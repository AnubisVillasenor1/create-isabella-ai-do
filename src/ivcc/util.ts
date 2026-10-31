/** Deterministic helpers shared by IVCC modules. No randomness, no hidden state. */
import { createHash, timingSafeEqual } from 'node:crypto';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Stable JSON: object keys are sorted so hashes and signatures are reproducible. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) out[key] = sortValue(item);
    }
    return out;
  }
  return value;
}

export function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function boundedText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxChars) return null;
  return trimmed;
}

export function finiteInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clamp(value, min, max);
}

export function toIso(value: Date): string {
  return value.toISOString();
}

export function parseIso(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
