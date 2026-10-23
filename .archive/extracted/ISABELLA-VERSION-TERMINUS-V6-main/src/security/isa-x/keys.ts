/**
 * ISA-X v1.1 — key ring (state: draft | engine-generated).
 *
 * Holds public key metadata only; private key material lives in the signer's
 * closed map. The ring models two-key rotation (double-phase):
 *
 *   rotate #1: ACTIVE → PREVIOUS (still verifies during grace period),
 *              new key becomes ACTIVE.
 *   rotate #2: the former PREVIOUS is REVOKED; the last ACTIVE becomes
 *              PREVIOUS; a fresh key becomes ACTIVE.
 *
 * This keeps a single signing key ACTIVE at any time while old signatures keep
 * verifying for exactly one rotation phase. Revoked keys are rejected.
 */
import { createHash, generateKeyPairSync } from "node:crypto";
import type { IsaXAlgorithm } from "./protocol";

export const ISA_X_KEY_STATES = ["ACTIVE", "PREVIOUS", "REVOKED"] as const;
export type IsaXKeyState = (typeof ISA_X_KEY_STATES)[number];

export interface IsaXKeyMaterial {
  readonly keyId: string;
  readonly algorithm: IsaXAlgorithm;
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
}

export interface IsaXKeyMetadata {
  readonly keyId: string;
  readonly algorithm: IsaXAlgorithm;
  readonly state: IsaXKeyState;
  readonly createdAt: number;
  readonly publicKeyPem: string;
  readonly fingerprint: string;
  readonly revokedAt?: number;
  readonly revokedReason?: string;
}

/** SHA-256 fingerprint (hex, 32 chars) of an SPKI PEM. */
export function isaXKeyFingerprint(publicKeyPem: string): string {
  const normalized = publicKeyPem.replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 32);
}

/** Generates a fresh Ed25519 key pair and returns its material. */
export function generateIsaXKeyMaterial(keyId?: string): IsaXKeyMaterial {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  return {
    keyId: keyId ?? `isa-x-${isaXKeyFingerprint(publicKeyPem).slice(0, 12)}`,
    algorithm: "Ed25519",
    privateKeyPem,
    publicKeyPem,
  };
}

export interface IsaXKeyRing {
  active(): IsaXKeyMetadata | undefined;
  get(keyId: string): IsaXKeyMetadata | undefined;
  all(): readonly IsaXKeyMetadata[];
  /** Adds the first key as ACTIVE. Throws if the ring already has a key. */
  bootstrap(key: IsaXKeyMaterial, now?: number): IsaXKeyMetadata;
  /**
   * Double-phase rotation. Returns the new ACTIVE key plus the demoted
   * (PREVIOUS) and retired (REVOKED) keys, when present.
   */
  rotate(newKey: IsaXKeyMaterial, now?: number): {
    newActive: IsaXKeyMetadata;
    demoted: IsaXKeyMetadata | undefined;
    retired: IsaXKeyMetadata | undefined;
  };
  revoke(keyId: string, reason: string, now?: number): IsaXKeyMetadata;
  /** Only the ACTIVE key may sign. */
  canSign(keyId: string): boolean;
  /** ACTIVE and PREVIOUS keys may verify (grace period). Revoked keys cannot. */
  canVerify(keyId: string): boolean;
}

interface MutableKey {
  keyId: string;
  algorithm: IsaXAlgorithm;
  state: IsaXKeyState;
  createdAt: number;
  publicKeyPem: string;
  fingerprint: string;
  revokedAt?: number;
  revokedReason?: string;
}

function freezeView(key: MutableKey): IsaXKeyMetadata {
  return Object.freeze({
    keyId: key.keyId,
    algorithm: key.algorithm,
    state: key.state,
    createdAt: key.createdAt,
    publicKeyPem: key.publicKeyPem,
    fingerprint: key.fingerprint,
    revokedAt: key.revokedAt,
    revokedReason: key.revokedReason,
  });
}

function recordFromKeyMaterial(key: IsaXKeyMaterial, state: IsaXKeyState, createdAt: number): MutableKey {
  return {
    keyId: key.keyId,
    algorithm: key.algorithm,
    state,
    createdAt,
    publicKeyPem: key.publicKeyPem,
    fingerprint: isaXKeyFingerprint(key.publicKeyPem),
  };
}

export interface IsaXKeyRingOptions {
  readonly now?: () => number;
}

export function createIsaXKeyRing(options: IsaXKeyRingOptions = {}): IsaXKeyRing {
  const now = options.now ?? Date.now;
  const keys = new Map<string, MutableKey>();

  function activeKey(): MutableKey | undefined {
    for (const key of keys.values()) {
      if (key.state === "ACTIVE") return key;
    }
    return undefined;
  }

  function visible(keyId: string): IsaXKeyMetadata | undefined {
    const key = keys.get(keyId);
    return key ? freezeView(key) : undefined;
  }

  return {
    active() {
      const key = activeKey();
      return key ? freezeView(key) : undefined;
    },
    get: visible,
    all() {
      return [...keys.values()].map(freezeView);
    },
    bootstrap(key, at) {
      if (keys.size > 0) throw new Error("ISA-X: key ring is already bootstrapped.");
      const createdAt = at ?? now();
      const record = recordFromKeyMaterial(key, "ACTIVE", createdAt);
      keys.set(record.keyId, record);
      return freezeView(record);
    },
    rotate(newKey, at) {
      const rotationAt = at ?? now();
      let retired: MutableKey | undefined;
      let demoted: MutableKey | undefined;
      for (const key of keys.values()) {
        if (key.state === "PREVIOUS") {
          key.state = "REVOKED";
          key.revokedAt = rotationAt;
          key.revokedReason = "rotated_out";
          retired = key;
        } else if (key.state === "ACTIVE") {
          key.state = "PREVIOUS";
          demoted = key;
        }
      }
      const record = recordFromKeyMaterial(newKey, "ACTIVE", rotationAt);
      keys.set(record.keyId, record);
      return {
        newActive: freezeView(record),
        demoted: demoted ? freezeView(demoted) : undefined,
        retired: retired ? freezeView(retired) : undefined,
      };
    },
    revoke(keyId, reason, at) {
      const key = keys.get(keyId);
      if (!key) throw new Error(`ISA-X: unknown key '${keyId}'`);
      key.state = "REVOKED";
      key.revokedAt = at ?? now();
      key.revokedReason = reason;
      return freezeView(key);
    },
    canSign(keyId) {
      return keys.get(keyId)?.state === "ACTIVE";
    },
    canVerify(keyId) {
      const state = keys.get(keyId)?.state;
      return state === "ACTIVE" || state === "PREVIOUS";
    },
  };
}