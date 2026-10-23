/**
 * Canonical JSON + hashing primitives for HyperCore Ω² (state: draft).
 * Deterministic, key-sorted serialization so cache keys and decision hashes are
 * reproducible across processes.
 */
import { createHash } from "node:crypto";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortValue(item));
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = sortValue(source[key]);
    return sorted;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export { sha256Hex } from "../lib/sha256";

export function sha3Hex(value: string | Uint8Array): string {
  return createHash("sha3-256").update(value).digest("hex");
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function tokenize(value: string): readonly string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}
