/**
 * ISA-X v1.1 — per-request signer (state: draft | engine-generated).
 *
 * Signs every request with real Ed25519 (`node:crypto` via the `Ed25519Signer`
 * facade and `verifyEd25519` from `../post-quantum` — reused, not duplicated).
 * Each signature envelope binds the protocol version, key id, scope, timestamp
 * and a nonce to the canonical request bytes.
 *
 * Key lifecycle: one ACTIVE signing key; rotation is double-phase (see
 * `keys.ts`); revocation is honoured from the ring AND from the injected
 * `IsaXRevocationRegistry`. Every operation emits an audit event.
 */
import { Ed25519Signer, verifyEd25519 } from "../post-quantum";
import { nonce } from "../nonce";
import {
  ISA_X_DEFAULT_CLOCK_SKEW_MS,
  IsaXError,
  assertSupportedVersion,
  canonicalRequest,
  isaXSigningInput,
  scopeMatches,
  utf8,
} from "./protocol";
import {
  createIsaXKeyRing,
  generateIsaXKeyMaterial,
  type IsaXKeyMaterial,
  type IsaXKeyRing,
} from "./keys";
import type { IsaXReason, IsaXRequest } from "./protocol";
import { requireKeyUsable, type IsaXRevocationRegistry } from "./revocation";

export interface IsaXSignature {
  readonly version: string;
  readonly keyId: string;
  readonly scope: string;
  readonly timestamp: number;
  readonly nonce: string;
  readonly signature: string;
}

export interface IsaXSignOptions {
  readonly request: IsaXRequest;
  readonly scope: string;
  /** Override the signing key; defaults to the ACTIVE key. */
  readonly keyId?: string;
  /** Override the nonce (used by the challenge handshake, never by callers). */
  readonly nonce?: string;
  /** Override the timestamp (injectable clock for tests). */
  readonly timestamp?: number;
}

export interface IsaXVerifyOptions {
  readonly request: IsaXRequest;
  readonly signature: IsaXSignature;
  readonly expectedScope: string;
  readonly now?: number;
  readonly clockSkewMs?: number;
}

export type IsaXVerifyFailureReason =
  | "UNKNOWN_KEY"
  | "KEY_REVOKED"
  | "SCOPE_REJECTED"
  | "TIMESTAMP_SKEW"
  | "BAD_SIGNATURE"
  | "MALFORMED"
  | "PROTOCOL_MISMATCH";

export type IsaXVerifyResult =
  | { readonly ok: true; readonly reason: "OK"; readonly signature: IsaXSignature }
  | { readonly ok: false; readonly reason: IsaXVerifyFailureReason; readonly detail?: string };

export type IsaXAuditAction = "sign" | "verify" | "rotate" | "revoke";
export type IsaXAuditReason = IsaXReason;

export interface IsaXAuditEvent {
  readonly action: IsaXAuditAction;
  readonly ok: boolean;
  readonly reason: IsaXAuditReason;
  readonly keyId: string;
  readonly scope: string;
  readonly at: number;
  readonly nonce?: string;
}

export type IsaXAuditHook = (event: IsaXAuditEvent) => void;

export interface IsaXSigner {
  readonly keyId: string;
  sign(options: IsaXSignOptions): Promise<IsaXSignature>;
  verify(options: IsaXVerifyOptions): Promise<IsaXVerifyResult>;
  keyRing(): IsaXKeyRing;
  rotate(): { newKeyId: string; demotedKeyId?: string; retiredKeyId?: string };
  revokeKey(keyId: string, reason?: string): void;
}

export interface IsaXSignerOptions {
  readonly initialKeyMaterial?: IsaXKeyMaterial;
  readonly revocation?: IsaXRevocationRegistry;
  readonly audit?: IsaXAuditHook;
  readonly now?: () => number;
  readonly clockSkewMs?: number;
}

function failure(
  reason: IsaXVerifyFailureReason,
  detail: string,
): { ok: false; reason: IsaXVerifyFailureReason; detail?: string } {
  return { ok: false, reason, detail };
}

export function createIsaXSigner(options: IsaXSignerOptions = {}): IsaXSigner {
  const now = options.now ?? Date.now;
  const clockSkewMs = options.clockSkewMs ?? ISA_X_DEFAULT_CLOCK_SKEW_MS;
  const revocation = options.revocation;
  const audit = options.audit ?? (() => undefined);
  const ring = createIsaXKeyRing({ now });
  const signers = new Map<string, Ed25519Signer>();

  function loadMaterial(key: IsaXKeyMaterial): Ed25519Signer {
    const existing = signers.get(key.keyId);
    if (existing) return existing;
    const signer = Ed25519Signer.fromPem(key.privateKeyPem, key.keyId);
    signers.set(key.keyId, signer);
    return signer;
  }

  const initial = options.initialKeyMaterial ?? generateIsaXKeyMaterial();
  ring.bootstrap(initial, now());
  loadMaterial(initial);

  async function sign(signOptions: IsaXSignOptions): Promise<IsaXSignature> {
    const timestamp = signOptions.timestamp ?? now();
    if (!Number.isFinite(timestamp)) {
      throw new IsaXError("ISA_X_MALFORMED", "signing timestamp must be finite");
    }
    const keyId = signOptions.keyId ?? ring.active()?.keyId;
    if (!keyId) throw new IsaXError("ISA_X_NO_ACTIVE_KEY", "no ACTIVE signing key available");
    if (!ring.canSign(keyId)) {
      throw new IsaXError("ISA_X_KEY_NOT_ACTIVE", `key '${keyId}' is not the ACTIVE signing key`);
    }
    if (revocation) requireKeyUsable(revocation, keyId);
    const signer = signers.get(keyId);
    if (!signer) throw new IsaXError("ISA_X_UNKNOWN_KEY", `no signing material for '${keyId}'`);

    const signatureNonce = signOptions.nonce ?? nonce();
    const canonical = canonicalRequest(signOptions.request);
    const input = isaXSigningInput({
      version: "1.1",
      keyId,
      scope: signOptions.scope,
      timestamp,
      nonce: signatureNonce,
      canonical,
    });
    const bytes = await signer.sign(utf8(input));
    const signature: IsaXSignature = {
      version: "1.1",
      keyId,
      scope: signOptions.scope,
      timestamp,
      nonce: signatureNonce,
      signature: Buffer.from(bytes).toString("base64url"),
    };
    audit({ action: "sign", ok: true, reason: "OK", keyId, scope: signOptions.scope, at: timestamp, nonce: signatureNonce });
    return Object.freeze(signature);
  }

  async function verify(verifyOptions: IsaXVerifyOptions): Promise<IsaXVerifyResult> {
    const { signature } = verifyOptions;
    const verifiedAt = verifyOptions.now ?? now();
    const skew = verifyOptions.clockSkewMs ?? clockSkewMs;

    if (!Number.isFinite(signature.timestamp)) {
      audit({ action: "verify", ok: false, reason: "MALFORMED", keyId: signature.keyId, scope: signature.scope, at: verifiedAt });
      return failure("MALFORMED", "signature timestamp is not finite");
    }
    try {
      assertSupportedVersion(signature.version);
    } catch {
      audit({ action: "verify", ok: false, reason: "PROTOCOL_MISMATCH", keyId: signature.keyId, scope: signature.scope, at: verifiedAt });
      return failure("PROTOCOL_MISMATCH", `unsupported version '${signature.version}'`);
    }

    const metadata = ring.get(signature.keyId);
    if (!metadata) {
      audit({ action: "verify", ok: false, reason: "UNKNOWN_KEY", keyId: signature.keyId, scope: signature.scope, at: verifiedAt });
      return failure("UNKNOWN_KEY", `unknown signing key '${signature.keyId}'`);
    }
    if (!ring.canVerify(signature.keyId) || (revocation?.isKeyRevoked(signature.keyId) ?? false)) {
      audit({ action: "verify", ok: false, reason: "KEY_REVOKED", keyId: signature.keyId, scope: signature.scope, at: verifiedAt });
      return failure("KEY_REVOKED", `signing key '${signature.keyId}' is revoked or not verifiable`);
    }
    if (!scopeMatches(signature.scope, verifyOptions.expectedScope)) {
      audit({ action: "verify", ok: false, reason: "SCOPE_REJECTED", keyId: signature.keyId, scope: signature.scope, at: verifiedAt });
      return failure("SCOPE_REJECTED", `signature scope '${signature.scope}' does not satisfy '${verifyOptions.expectedScope}'`);
    }
    if (Math.abs(verifiedAt - signature.timestamp) > skew) {
      audit({ action: "verify", ok: false, reason: "TIMESTAMP_SKEW", keyId: signature.keyId, scope: signature.scope, at: verifiedAt });
      return failure("TIMESTAMP_SKEW", `signature ${Math.abs(verifiedAt - signature.timestamp)}ms outside the ${skew}ms window`);
    }

    const canonical = canonicalRequest(verifyOptions.request);
    const input = isaXSigningInput({
      version: signature.version,
      keyId: signature.keyId,
      scope: signature.scope,
      timestamp: signature.timestamp,
      nonce: signature.nonce,
      canonical,
    });
    let valid = false;
    try {
      valid = await verifyEd25519(metadata.publicKeyPem, utf8(input), Buffer.from(signature.signature, "base64url"));
    } catch {
      valid = false;
    }
    if (!valid) {
      audit({ action: "verify", ok: false, reason: "BAD_SIGNATURE", keyId: signature.keyId, scope: signature.scope, at: verifiedAt });
      return failure("BAD_SIGNATURE", "Ed25519 verification failed");
    }
    audit({ action: "verify", ok: true, reason: "OK", keyId: signature.keyId, scope: signature.scope, at: verifiedAt, nonce: signature.nonce });
    return { ok: true, reason: "OK", signature };
  }

  return {
    keyId: initial.keyId,
    sign,
    verify,
    keyRing: () => ring,
    rotate() {
      const newKey = generateIsaXKeyMaterial();
      const result = ring.rotate(newKey, now());
      loadMaterial(newKey);
      audit({
        action: "rotate",
        ok: true,
        reason: "OK",
        keyId: result.newActive.keyId,
        scope: "*",
        at: now(),
      });
      return {
        newKeyId: result.newActive.keyId,
        demotedKeyId: result.demoted?.keyId,
        retiredKeyId: result.retired?.keyId,
      };
    },
    revokeKey(keyId, reason = "compromised") {
      ring.revoke(keyId, reason, now());
      signers.delete(keyId);
      if (revocation) revocation.revokeKey(keyId, reason);
      audit({ action: "revoke", ok: true, reason: "OK", keyId, scope: "*", at: now() });
    },
  };
}