/**
 * Nonce uniqueness registry (ISA-259).
 *
 * Enforces a unique, TTL-bounded nonce per key so a repeated nonce is rejected.
 * Nonces are stored as SHA-256 digests (fixed length, raw values not retained)
 * and compared with `timingSafeEqual`. Nonces are public anti-replay values,
 * not secrets, so constant-time comparison is defence-in-depth only.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface NonceRegistryOptions {
  /** Time-to-live for each claimed nonce, in milliseconds. */
  ttlMs: number;
  /** Hard cap on live entries; fails closed when exceeded. */
  maxEntries?: number;
  /** Injectable clock (tests). Defaults to `Date.now`. */
  now?: () => number;
}

export interface NonceRegistry {
  /** Returns `true` if the nonce is new, `false` if it was already claimed and is live. */
  claim(nonce: string): boolean;
  /** Returns `true` if the nonce is currently recorded and unexpired. */
  has(nonce: string): boolean;
  /** Number of live entries (expired entries may remain until pruned). */
  readonly size: number;
  /** Removes expired entries; returns how many were removed. */
  prune(): number;
}

interface NonceEntry {
  expiresAt: number;
  digest: Buffer;
}

/** Cryptographically random nonce (256 bits, base64url). */
export function nonce(): string {
  return randomBytes(32).toString("base64url");
}

function digestOf(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function createNonceRegistry(options: NonceRegistryOptions): NonceRegistry {
  const { ttlMs } = options;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("NONCE: ttlMs must be a positive number.");
  const maxEntries = options.maxEntries ?? 100_000;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("NONCE: maxEntries must be a positive integer.");
  }
  const now = options.now ?? Date.now;
  const entries = new Map<string, NonceEntry>();

  function prune(): number {
    const current = now();
    let removed = 0;
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= current) {
        entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  function has(value: string): boolean {
    if (typeof value !== "string" || value.length === 0) return false;
    const digest = digestOf(value);
    const entry = entries.get(digest.toString("hex"));
    if (!entry) return false;
    if (entry.expiresAt <= now()) {
      entries.delete(digest.toString("hex"));
      return false;
    }
    return timingSafeEqual(entry.digest, digest);
  }

  function claim(value: string): boolean {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("NONCE: nonce must be a non-empty string.");
    }
    const current = now();
    const digest = digestOf(value);
    const key = digest.toString("hex");
    const entry = entries.get(key);
    if (entry) {
      if (entry.expiresAt > current && timingSafeEqual(entry.digest, digest)) {
        return false;
      }
      entries.delete(key);
    }
    prune();
    if (entries.size >= maxEntries) throw new Error("NONCE: registry capacity exceeded.");
    entries.set(key, { expiresAt: current + ttlMs, digest });
    return true;
  }

  return {
    claim,
    has,
    get size() {
      return entries.size;
    },
    prune,
  };
}
