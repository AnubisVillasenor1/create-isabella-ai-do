/**
 * ISA-X v1.1 — protocol primitives (state: draft | engine-generated).
 *
 * HONESTY NOTE. The file `ISA-X Sovereign Protocol.txt` referenced by the
 * planning brief is NOT present in this repository nor in the surrounding
 * workspace. Nothing in this module pretends to quote it. Instead this is a
 * minimal, real ISA-X profile with a clearly stated construction:
 *
 * - Signing algorithm: **Ed25519** through `node:crypto` (FIPS 186-5,
 *   classical). Real signatures, real verification, no mock bytes.
 * - Post-quantum algorithms (ML-KEM-768 / ML-DSA-65 / SLH-DSA-SHA2-128s) are
 *   `BLOCKED_ENVIRONMENT`: they need an external HSM/KMS or a vetted native PQC
 *   library that is not vendored here. Requesting one throws, it is never
 *   simulated. See `docs/security/ISA-X-IMPLEMENTATION.md`.
 *
 * The canonical request encoding below is deterministic: header keys are
 * lower-cased and whitespace-normalised, query/header pairs are sorted, and the
 * body is reduced to a SHA-256 digest (or `-` when absent/empty).
 */
import { createHash } from "node:crypto";
import { createPqcSignatureAlgorithm } from "../post-quantum";

export const ISA_X_VERSION = "1.1" as const;
export const ISA_X_SUPPORTED_VERSIONS = ["1.1", "1.0"] as const;
export type IsaXProtocolVersion = (typeof ISA_X_SUPPORTED_VERSIONS)[number];

/** The only algorithm ISA-X can actually sign with inside this repository. */
export type IsaXAlgorithm = "Ed25519";
export const ISA_X_SIGNING_ALGORITHM: IsaXAlgorithm = "Ed25519";

/** Algorithms ISA-X cannot use here; they require an external HSM/KMS. */
export const ISA_X_BLOCKED_ALGORITHMS = ["ML-KEM-768", "ML-DSA-65", "SLH-DSA-SHA2-128s"] as const;
export type IsaXBlockedAlgorithm = (typeof ISA_X_BLOCKED_ALGORITHMS)[number];

export const ISA_X_ERROR_CODES = [
  "ISA_X_MALFORMED",
  "ISA_X_NO_ACTIVE_KEY",
  "ISA_X_KEY_REVOKED",
  "ISA_X_KEY_NOT_ACTIVE",
  "ISA_X_UNKNOWN_KEY",
  "ISA_X_SCOPE_REJECTED",
  "ISA_X_TIMESTAMP_SKEW",
  "ISA_X_NONCE_REUSE",
  "ISA_X_EXPIRED",
  "ISA_X_UNKNOWN_CHALLENGE",
  "ISA_X_BAD_SIGNATURE",
  "ISA_X_PROTOCOL_MISMATCH",
  "ISA_X_TOKEN_REVOKED",
  "ISA_X_PQC_UNAVAILABLE",
  "ISA_X_CAPACITY",
] as const;
export type IsaXErrorCode = (typeof ISA_X_ERROR_CODES)[number];

/** Raised for every hard rejection in the ISA-X layer. Always code-tagged. */
export class IsaXError extends Error {
  readonly code: IsaXErrorCode;
  constructor(code: IsaXErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "IsaXError";
    this.code = code;
  }
}

export const ISA_X_REASONS = [
  "OK",
  "UNKNOWN_KEY",
  "KEY_REVOKED",
  "SCOPE_REJECTED",
  "TIMESTAMP_SKEW",
  "NONCE_REUSE",
  "EXPIRED",
  "UNKNOWN_CHALLENGE",
  "BAD_SIGNATURE",
  "MALFORMED",
  "PROTOCOL_MISMATCH",
] as const;
export type IsaXReason = (typeof ISA_X_REASONS)[number];
export type IsaXFailureReason = Exclude<IsaXReason, "OK">;

/** Default clock skew tolerated on signed timestamps (30 seconds). */
export const ISA_X_DEFAULT_CLOCK_SKEW_MS = 30_000;

/** Maximum challenge lifetime by default (5 minutes). */
export const ISA_X_DEFAULT_TTL_MS = 300_000;

export function isSupportedVersion(version: string): boolean {
  return (ISA_X_SUPPORTED_VERSIONS as readonly string[]).includes(version);
}

export function assertSupportedVersion(version: string): void {
  if (!isSupportedVersion(version)) {
    throw new IsaXError("ISA_X_PROTOCOL_MISMATCH", `unsupported ISA-X protocol version '${version}'`);
  }
}

/** A request whose bytes are canonically encoded before signing. */
export interface IsaXRequest {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
}

interface NormalizedPair {
  readonly key: string;
  readonly value: string;
}

function normalizedPairs(
  record: Readonly<Record<string, string>> | undefined,
  lowerKey: boolean,
): NormalizedPair[] {
  if (!record) return [];
  const pairs: NormalizedPair[] = [];
  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = (lowerKey ? rawKey.trim().toLowerCase() : rawKey.trim()).replace(/\s+/g, " ");
    const value = rawValue.trim();
    if (key.length === 0) continue;
    pairs.push({ key, value });
  }
  pairs.sort((a, b) => {
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    if (a.value !== b.value) return a.value < b.value ? -1 : 1;
    return 0;
  });
  return pairs;
}

function bodyDigest(body: Uint8Array | undefined): string {
  if (!body || body.byteLength === 0) return "-";
  return createHash("sha256").update(body).digest("hex");
}

/**
 * Deterministic canonical request encoding. Two requests that differ only in
 * header/query ordering, header casing or surrounding whitespace produce the
 * exact same string; a different body always produces a different string.
 */
export function canonicalRequest(request: IsaXRequest): string {
  const method = request.method.trim().toUpperCase();
  const path = request.path.trim();
  if (method.length === 0 || path.length === 0) {
    throw new IsaXError("ISA_X_MALFORMED", "request method and path are required");
  }
  const query = normalizedPairs(request.query, false)
    .map((pair) => `${pair.key}=${pair.value}`)
    .join("&");
  const headers = normalizedPairs(request.headers, true)
    .map((pair) => `${pair.key}: ${pair.value}`)
    .join("\n");
  return [ISA_X_VERSION, method, path, query, headers, bodyDigest(request.body)].join("\n");
}

export function canonicalRequestBytes(request: IsaXRequest): Uint8Array {
  return new TextEncoder().encode(canonicalRequest(request));
}

export interface IsaXSigningParts {
  readonly version: string;
  readonly keyId: string;
  readonly scope: string;
  readonly timestamp: number;
  readonly nonce: string;
  readonly canonical: string;
}

/**
 * The exact byte string that gets signed. Every security-relevant header of
 * the envelope (version, key, scope, timestamp, nonce) is bound into it, so an
 * attacker cannot strip or rewrite any of them without breaking Ed25519.
 */
export function isaXSigningInput(parts: IsaXSigningParts): string {
  return [
    `isa-x:${parts.version}`,
    `key:${parts.keyId}`,
    `scope:${parts.scope}`,
    `ts:${parts.timestamp}`,
    `nonce:${parts.nonce}`,
    "request:",
    parts.canonical,
  ].join("\n");
}

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * Scope matching: exact equality, plus `namespace:*` wildcards. A verify call
 * that supplies a scope the signature does not carry is rejected.
 */
export function scopeMatches(actual: string, expected: string): boolean {
  if (expected === actual) return true;
  if (expected.endsWith(":*")) {
    const prefix = expected.slice(0, -1);
    return actual.startsWith(prefix);
  }
  return false;
}

export interface IsaXAlgorithmEntry {
  readonly algorithm: string;
  readonly status: "implemented" | "blocked_environment";
  readonly environment: "AVAILABLE" | "BLOCKED_ENVIRONMENT";
  readonly detail: string;
}

export interface IsaXAlgorithmPolicy {
  readonly version: string;
  readonly state: "draft";
  readonly signingAlgorithm: IsaXAlgorithm;
  readonly entries: readonly IsaXAlgorithmEntry[];
}

/**
 * Honest algorithm inventory for ISA-X. Ed25519 is real; every post-quantum
 * entry is BLOCKED_ENVIRONMENT until an external HSM/KMS or native PQC library
 * is wired through `PqcExternalProvider`.
 */
export function isaXAlgorithmPolicy(): IsaXAlgorithmPolicy {
  return {
    version: ISA_X_VERSION,
    state: "draft",
    signingAlgorithm: ISA_X_SIGNING_ALGORITHM,
    entries: [
      {
        algorithm: "Ed25519",
        status: "implemented",
        environment: "AVAILABLE",
        detail: "Real signature/verification via node:crypto (FIPS 186-5, classical, not post-quantum).",
      },
      {
        algorithm: "ML-KEM-768",
        status: "blocked_environment",
        environment: "BLOCKED_ENVIRONMENT",
        detail: "FIPS 203 KEM requires an external HSM/KMS or a vetted native PQC provider; not vendored here.",
      },
      {
        algorithm: "ML-DSA-65",
        status: "blocked_environment",
        environment: "BLOCKED_ENVIRONMENT",
        detail: "FIPS 204 signatures require an external HSM/KMS or a vetted native PQC provider; not vendored here.",
      },
      {
        algorithm: "SLH-DSA-SHA2-128s",
        status: "blocked_environment",
        environment: "BLOCKED_ENVIRONMENT",
        detail: "FIPS 205 hash-based signatures require an external HSM/KMS or a vetted native PQC provider.",
      },
    ],
  };
}

/**
 * Fails closed on any non-Ed25519 ISA-X algorithm. Delegates to the real
 * `post-quantum` facade so the error surfaces as `PQC_BACKEND_UNAVAILABLE`
 * with `BLOCKED_ENVIRONMENT`, never as a fake signature.
 */
export function requireIsaXAlgorithm(algorithm: string): void {
  if (algorithm === ISA_X_SIGNING_ALGORITHM) return;
  createPqcSignatureAlgorithm(algorithm as "ML-DSA-65");
}
