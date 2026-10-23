/**
 * ISA-X v1.1 — challenge-response handshake (state: draft | engine-generated).
 *
 * One-time challenge: `issue()` produces a challenge with a fresh 256-bit nonce
 * (from `../nonce` — reused, not duplicated) and an expiry. `resolve()` requires
 * the responder to return a valid Ed25519 signature over the challenge's
 * canonical request; the nonce is claimed exactly once through a `NonceRegistry`
 * so a replayed answer is rejected (`NONCE_REUSE`). Timestamps outside the
 * skew window are rejected (`TIMESTAMP_SKEW`), as are scope mismatches.
 */
import { randomUUID } from "node:crypto";
import { ISA_X_DEFAULT_CLOCK_SKEW_MS, ISA_X_DEFAULT_TTL_MS } from "./protocol";
import { createNonceRegistry, nonce, type NonceRegistry } from "../nonce";
import {
  IsaXError,
  assertSupportedVersion,
  scopeMatches,
} from "./protocol";
import type { IsaXRequest } from "./protocol";
import type { IsaXSignature, IsaXSigner } from "./signer";
import { issueSessionToken, type IsaXRevocationRegistry } from "./revocation";

export interface IsaXChallenge {
  readonly challengeId: string;
  readonly nonce: string;
  readonly scope: string;
  readonly audience: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface IsaXChallengeIssueOptions {
  readonly scope: string;
  readonly audience?: string;
  /** Overrides the service TTL for this specific challenge. */
  readonly ttlMs?: number;
}

export interface IsaXChallengeAnswer {
  readonly challengeId: string;
  readonly signature: IsaXSignature;
}

export type IsaXChallengeFailureReason =
  | "UNKNOWN_CHALLENGE"
  | "EXPIRED"
  | "TIMESTAMP_SKEW"
  | "SCOPE_REJECTED"
  | "NONCE_REUSE"
  | "MALFORMED"
  | "PROTOCOL_MISMATCH"
  | "UNKNOWN_KEY"
  | "KEY_REVOKED"
  | "BAD_SIGNATURE";

export type IsaXChallengeVerdict =
  | {
      readonly ok: true;
      readonly reason: "OK";
      readonly challengeId: string;
      readonly scope: string;
      readonly keyId: string;
      readonly token: string;
      readonly consumedAt: number;
    }
  | { readonly ok: false; readonly reason: IsaXChallengeFailureReason; readonly challengeId: string };

export interface IsaXChallengeServiceOptions {
  readonly signer: IsaXSigner;
  readonly revocation?: IsaXRevocationRegistry;
  readonly nonceRegistry?: NonceRegistry;
  readonly ttlMs?: number;
  readonly clockSkewMs?: number;
  readonly maxChallenges?: number;
  readonly now?: () => number;
}

export interface IsaXChallengeService {
  issue(scope: string, audience?: string): IsaXChallenge;
  resolve(answer: IsaXChallengeAnswer, now?: number): Promise<IsaXChallengeVerdict>;
  size(): number;
}

/** The canonical request both sides derive from a challenge. */
export function challengeRequest(challenge: IsaXChallenge): IsaXRequest {
  return {
    method: "POST",
    path: "/isa-x/v1/challenge",
    query: {
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      scope: challenge.scope,
      audience: challenge.audience,
      issuedAt: String(challenge.issuedAt),
      expiresAt: String(challenge.expiresAt),
    },
    headers: { "content-type": "application/json" },
  };
}

export function createIsaXChallengeService(options: IsaXChallengeServiceOptions): IsaXChallengeService {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? ISA_X_DEFAULT_TTL_MS;
  const clockSkewMs = options.clockSkewMs ?? ISA_X_DEFAULT_CLOCK_SKEW_MS;
  const maxChallenges = options.maxChallenges ?? 1024;
  const registry = options.nonceRegistry ?? createNonceRegistry({ ttlMs });
  const challenges = new Map<string, IsaXChallenge>();
  const consumed = new Set<string>();

  function prune(): void {
    const current = now();
    for (const [challengeId, challenge] of challenges) {
      if (challenge.expiresAt <= current) challenges.delete(challengeId);
    }
  }

  return {
    issue(scope, audience = "isa-x") {
      if (typeof scope !== "string" || scope.trim().length === 0) {
        throw new IsaXError("ISA_X_MALFORMED", "challenge scope is required");
      }
      prune();
      if (challenges.size >= maxChallenges) {
        throw new IsaXError("ISA_X_CAPACITY", `challenge registry is full (${maxChallenges})`);
      }
      const issuedAt = now();
      const challenge: IsaXChallenge = Object.freeze({
        challengeId: randomUUID(),
        nonce: nonce(),
        scope: scope.trim(),
        audience: audience.trim(),
        issuedAt,
        expiresAt: issuedAt + ttlMs,
      });
      challenges.set(challenge.challengeId, challenge);
      return challenge;
    },

    async resolve(answer, at) {
      const resolvedAt = at ?? now();
      const challenge = challenges.get(answer.challengeId);
      if (!challenge) {
        return { ok: false, reason: "UNKNOWN_CHALLENGE", challengeId: answer.challengeId };
      }
      const { signature } = answer;

      try {
        assertSupportedVersion(signature.version);
      } catch {
        return { ok: false, reason: "PROTOCOL_MISMATCH", challengeId: answer.challengeId };
      }

      if (signature.nonce !== challenge.nonce || signature.scope !== challenge.scope) {
        return { ok: false, reason: "MALFORMED", challengeId: answer.challengeId };
      }
      if (resolvedAt > challenge.expiresAt) {
        return { ok: false, reason: "EXPIRED", challengeId: answer.challengeId };
      }
      if (!scopeMatches(signature.scope, challenge.scope)) {
        return { ok: false, reason: "SCOPE_REJECTED", challengeId: answer.challengeId };
      }
      if (Math.abs(resolvedAt - signature.timestamp) > clockSkewMs) {
        return { ok: false, reason: "TIMESTAMP_SKEW", challengeId: answer.challengeId };
      }

      const verified = await options.signer.verify({
        request: challengeRequest(challenge),
        signature,
        expectedScope: challenge.scope,
        now: resolvedAt,
        clockSkewMs,
      });
      if (!verified.ok) {
        return { ok: false, reason: verified.reason, challengeId: answer.challengeId };
      }

      if (consumed.has(answer.challengeId)) {
        return { ok: false, reason: "NONCE_REUSE", challengeId: answer.challengeId };
      }
      if (registry.claim(signature.nonce) === false) {
        return { ok: false, reason: "NONCE_REUSE", challengeId: answer.challengeId };
      }
      consumed.add(answer.challengeId);

      return {
        ok: true,
        reason: "OK",
        challengeId: answer.challengeId,
        scope: challenge.scope,
        keyId: signature.keyId,
        token: issueSessionToken(),
        consumedAt: resolvedAt,
      };
    },

    size() {
      return challenges.size;
    },
  };
}