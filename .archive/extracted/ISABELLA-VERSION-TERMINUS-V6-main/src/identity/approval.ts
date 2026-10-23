/** Human approval with cryptographic binding, expiry and replay protection. */
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import type { PdpEffect } from "./pdp";
import type { Principal } from "./principal";

export interface ApprovalSigner {
  keyId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

export interface ApprovalTarget {
  methodId: string;
  action?: string;
  principalId?: string;
  resource?: string;
  contextHash?: string;
  policyVersion?: string;
}

export interface ApprovalRef {
  evidenceId: string;
  approver: string;
  approverKind: "human";
  methodId: string;
  decision: PdpEffect;
  decidedAt: string;
  expiresAt: string;
  nonce: string;
  targetHash: string;
  keyId: string;
  publicKeyPem: string;
  signature: string;
  action: string;
  resource?: string;
  principalId?: string;
  contextHash?: string;
  policyVersion?: string;
}

export interface ApprovalReplayRegistry {
  consume(nonce: string, expiresAt: string): void;
  has(nonce: string): boolean;
}

export function createApprovalReplayRegistry(maxEntries = 100_000): ApprovalReplayRegistry {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("APPROVAL: replay registry capacity must be positive.");
  const consumed = new Map<string, number>();
  return {
    consume(nonce, expiresAt) {
      const now = Date.now();
      const expiry = Date.parse(expiresAt);
      if (!Number.isFinite(expiry) || expiry <= now) throw new Error("APPROVAL: expired approval cannot be consumed.");
      for (const [key, expires] of consumed) if (expires <= now) consumed.delete(key);
      if (consumed.has(nonce)) throw new Error("APPROVAL: replay detected.");
      if (consumed.size >= maxEntries) throw new Error("APPROVAL: replay registry capacity exceeded.");
      consumed.set(nonce, expiry);
    },
    has(nonce) {
      return consumed.has(nonce);
    },
  };
}

function canonicalTarget(target: ApprovalTarget, decision: PdpEffect, approver: string, nonce: string, expiresAt: string, decidedAt: string): string {
  return JSON.stringify({ approver, decision, decidedAt, expiresAt, methodId: target.methodId, action: target.action ?? "",
    principalId: target.principalId ?? null, resource: target.resource ?? null,
    contextHash: target.contextHash ?? null, policyVersion: target.policyVersion ?? null, nonce });
}

function hashTarget(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function approvalSignerFromEnvironment(): ApprovalSigner {
  const privateKeyPem = process.env.ISABELLA_APPROVAL_PRIVATE_KEY_PEM;
  const keyId = process.env.ISABELLA_APPROVAL_KEY_ID;
  if (!privateKeyPem || !keyId) throw new Error("APPROVAL: configure ISABELLA_APPROVAL_PRIVATE_KEY_PEM and ISABELLA_APPROVAL_KEY_ID.");
  try {
    const publicKeyPem = createPublicKey(createPrivateKey(privateKeyPem)).export({ format: "pem", type: "spki" }).toString();
    return { keyId, privateKeyPem, publicKeyPem };
  } catch (err) {
    if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
      const pair = generateKeyPairSync("ed25519");
      return {
        keyId,
        privateKeyPem: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
        publicKeyPem: pair.publicKey.export({ format: "pem", type: "spki" }).toString(),
      };
    }
    throw err;
  }
}

function signerFor(approver: Principal, signer?: ApprovalSigner): ApprovalSigner {
  if (signer) return signer;
  if (process.env.ISABELLA_APPROVAL_PRIVATE_KEY_PEM && process.env.ISABELLA_APPROVAL_KEY_ID && !process.env.ISABELLA_APPROVAL_PRIVATE_KEY_PEM.includes("replace-with-managed")) {
    try {
      return approvalSignerFromEnvironment();
    } catch (err) {
      if (process.env.VITEST !== "true" && process.env.NODE_ENV !== "test") throw err;
    }
  }
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    const pair = generateKeyPairSync("ed25519");
    return {
      keyId: `test-${approver.id}-${randomUUID()}`,
      privateKeyPem: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      publicKeyPem: pair.publicKey.export({ format: "pem", type: "spki" }).toString(),
    };
  }
  throw new Error("APPROVAL: production approval requires an externally managed Ed25519 signer.");
}

export function issueHumanApproval(
  approver: Principal,
  target: ApprovalTarget,
  decision: PdpEffect,
  signer?: ApprovalSigner,
  ttlMs = 5 * 60 * 1000,
): ApprovalRef {
  if (approver.kind !== "human") {
    throw new Error("APPROVAL: sólo la conciencia humana puede emitir aprobación (only a human principal can approve).");
  }
  if (!approver.roles.some((role) => role === "admin" || role === "approver")) {
    throw new Error("APPROVAL: principal lacks approval authority.");
  }
  if (process.env.VITEST !== "true" && process.env.NODE_ENV !== "test") {
    const trustedApproverId = process.env.ISABELLA_APPROVAL_TRUSTED_APPROVER_ID;
    if (!trustedApproverId || trustedApproverId !== approver.id) {
      throw new Error("APPROVAL: signer is not bound to the trusted approver identity.");
    }
  }
  if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > 24 * 60 * 60 * 1000) {
    throw new Error("APPROVAL: ttl must be between 1ms and 24h.");
  }
  const activeSigner = signerFor(approver, signer);
  const evidenceId = randomUUID();
  const nonce = randomUUID();
  const decidedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const targetHash = hashTarget(canonicalTarget(target, decision, approver.id, nonce, expiresAt, decidedAt));
  const payload = Buffer.from(`${evidenceId}.${targetHash}`, "utf8");
  const signature = sign(null, payload, createPrivateKey(activeSigner.privateKeyPem)).toString("base64url");
  // Ephemeral trust is test-only. Production verification must use a separately
  // configured trust anchor, never the public key embedded in the approval itself.
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    process.env.ISABELLA_APPROVAL_TRUSTED_KEY_ID = activeSigner.keyId;
    process.env.ISABELLA_APPROVAL_TRUSTED_PUBLIC_KEY_PEM = activeSigner.publicKeyPem;
    process.env.ISABELLA_APPROVAL_TRUSTED_APPROVER_ID = approver.id;
  }
  return {
    evidenceId, approver: approver.id, approverKind: "human", methodId: target.methodId,
    decision, decidedAt, expiresAt, nonce, targetHash, keyId: activeSigner.keyId,
    publicKeyPem: activeSigner.publicKeyPem, signature, action: target.action ?? "", resource: target.resource,
    principalId: target.principalId, contextHash: target.contextHash, policyVersion: target.policyVersion,
  };
}

export function verifyHumanApproval(ref: ApprovalRef, target: ApprovalTarget, replay?: ApprovalReplayRegistry): boolean {
  if (ref.approverKind !== "human" || ref.methodId !== target.methodId) return false;
  const canonical = canonicalTarget({ ...target, action: target.action ?? ref.action, resource: target.resource ?? ref.resource,
    principalId: target.principalId ?? ref.principalId, contextHash: target.contextHash ?? ref.contextHash,
    policyVersion: target.policyVersion ?? ref.policyVersion }, ref.decision, ref.approver, ref.nonce, ref.expiresAt, ref.decidedAt);
  if (hashTarget(canonical) !== ref.targetHash) return false;
  const expiry = Date.parse(ref.expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const trustedKeyId = process.env.ISABELLA_APPROVAL_TRUSTED_KEY_ID;
  const trustedPublicKeyPem = process.env.ISABELLA_APPROVAL_TRUSTED_PUBLIC_KEY_PEM;
  const trustedApproverId = process.env.ISABELLA_APPROVAL_TRUSTED_APPROVER_ID;
  if (!trustedKeyId || trustedKeyId !== ref.keyId || !trustedPublicKeyPem || !trustedApproverId || trustedApproverId !== ref.approver) return false;

  let trustedPublicKey;
  try {
    trustedPublicKey = createPublicKey(trustedPublicKeyPem);
    const embeddedPublicKey = createPublicKey(ref.publicKeyPem);
    if (trustedPublicKey.asymmetricKeyType !== "ed25519" || embeddedPublicKey.asymmetricKeyType !== "ed25519") return false;
    const trustedDer = trustedPublicKey.export({ format: "der", type: "spki" });
    const embeddedDer = embeddedPublicKey.export({ format: "der", type: "spki" });
    if (!trustedDer.equals(embeddedDer)) return false;
  } catch {
    return false;
  }

  const valid = verify(null, Buffer.from(ref.evidenceId + "." + ref.targetHash, "utf8"),
    trustedPublicKey, Buffer.from(ref.signature, "base64url"));
  if (!valid) return false;
  if (replay) replay.consume(ref.nonce, ref.expiresAt);
  return true;
}

export function isRecentApproval(ref: ApprovalRef, maxAgeMs: number): boolean {
  const age = Date.now() - Date.parse(ref.decidedAt);
  return age >= 0 && age <= maxAgeMs && Date.parse(ref.expiresAt) >= Date.now();
}
