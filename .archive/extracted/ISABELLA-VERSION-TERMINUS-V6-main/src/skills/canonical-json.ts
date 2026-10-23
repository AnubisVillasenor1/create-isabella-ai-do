/**
 * Canonical JSON (RFC 8785 JCS-style) and SHA-256 digests.
 *
 * Deterministic, order-independent JSON serialization used for reproducible
 * hashing, execution manifests and evidence chains. Numbers follow the
 * ECMAScript Number::toString representation (as used by JCS); object keys are
 * sorted by UTF-16 code unit (Array.prototype.sort) so distinct processes
 * produce identical bytes for identical values.
 *
 * SHA-256 is specified by NIST FIPS 180-4.
 */
import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new Error("CANONICAL_JSON: non-finite numbers are not representable in JSON.");
      }
      return JSON.stringify(value);
    case "bigint":
      throw new Error("CANONICAL_JSON: bigint is not representable in JSON.");
    case "undefined":
    case "function":
    case "symbol":
      return "null";
    default:
      break;
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${entries.join(",")}}`;
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

/** Joins hashes with a pipe and re-hashes them (chained manifest digest). */
export function manifestDigest(parts: readonly unknown[]): string {
  return sha256(parts.map((part) => canonicalJson(part)).join("|"));
}

/** SHA-256 of a raw string without canonicalization (for byte-exact content). */
export { sha256Hex } from "../lib/sha256";
