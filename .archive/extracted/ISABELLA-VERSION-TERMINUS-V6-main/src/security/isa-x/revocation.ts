/**
 * ISA-X v1.1 — revocation registry (state: draft | engine-generated).
 *
 * Central authority for invalidating signing keys and opaque session tokens.
 * Raw tokens are never stored: only their SHA-256 digest is kept, and lookups
 * compare with `timingSafeEqual` (defence-in-depth; tokens are bearer-ish).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { IsaXError } from "./protocol";

export interface IsaXRevocationRecord {
  readonly kind: "key" | "token";
  /** For keys: keyId. For tokens: hex digest of the token, never the token. */
  readonly id: string;
  readonly revokedAt: number;
  readonly reason: string;
}

export interface IsaXRevocationRegistry {
  revokeKey(keyId: string, reason?: string): IsaXRevocationRecord;
  revokeToken(token: string, reason?: string): IsaXRevocationRecord;
  isKeyRevoked(keyId: string): boolean;
  isTokenRevoked(token: string): boolean;
  records(): readonly IsaXRevocationRecord[];
}

export interface IsaXRevocationOptions {
  readonly now?: () => number;
}

function digestOf(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function sameDigest(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createRevocationRegistry(options: IsaXRevocationOptions = {}): IsaXRevocationRegistry {
  const now = options.now ?? Date.now;
  const keys = new Map<string, Buffer>();
  const tokens = new Map<string, Buffer>();
  const records: IsaXRevocationRecord[] = [];

  function isRevoked(map: Map<string, Buffer>, value: string): boolean {
    const digest = digestOf(value);
    const hex = digest.toString("hex");
    const stored = map.get(hex);
    if (!stored) return false;
    return sameDigest(stored, digest);
  }

  return {
    revokeKey(keyId, reason = "compromised") {
      const revokedAt = now();
      const digest = digestOf(keyId);
      keys.set(digest.toString("hex"), digest);
      const record: IsaXRevocationRecord = { kind: "key", id: keyId, revokedAt, reason };
      records.push(record);
      return Object.freeze(record);
    },
    revokeToken(token, reason = "revoked") {
      if (typeof token !== "string" || token.length === 0) {
        throw new IsaXError("ISA_X_MALFORMED", "revocation requires a non-empty token");
      }
      const revokedAt = now();
      const digest = digestOf(token);
      tokens.set(digest.toString("hex"), digest);
      const record: IsaXRevocationRecord = { kind: "token", id: digest.toString("hex"), revokedAt, reason };
      records.push(record);
      return Object.freeze(record);
    },
    isKeyRevoked(keyId) {
      return isRevoked(keys, keyId);
    },
    isTokenRevoked(token) {
      return isRevoked(tokens, token);
    },
    records() {
      return [...records];
    },
  };
}

/** Fails closed: throws `ISA_X_TOKEN_REVOKED` when the token was revoked. */
export function requireTokenValid(registry: IsaXRevocationRegistry, token: string): void {
  if (registry.isTokenRevoked(token)) {
    throw new IsaXError("ISA_X_TOKEN_REVOKED", "session token has been revoked");
  }
}

/** Fails closed: throws `ISA_X_KEY_REVOKED` when the signing key was revoked. */
export function requireKeyUsable(registry: IsaXRevocationRegistry, keyId: string): void {
  if (registry.isKeyRevoked(keyId)) {
    throw new IsaXError("ISA_X_KEY_REVOKED", `signing key '${keyId}' has been revoked`);
  }
}

/** Opaque session token, 256 bits of entropy, base64url. */
export function issueSessionToken(): string {
  return randomBytes(32).toString("base64url");
}