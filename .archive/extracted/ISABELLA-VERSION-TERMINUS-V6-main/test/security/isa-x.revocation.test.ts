import { describe, expect, it } from "vitest";
import {
  IsaXError,
  challengeRequest,
  createIsaXChallengeService,
  createIsaXSigner,
  createRevocationRegistry,
  requireTokenValid,
} from "../../src/security/isa-x";

const CLOCK = 1_700_000_000_000;
const TTL = 300_000;

describe("ISA-X revocation — keys", () => {
  it("invalidates a signing key so signatures are rejected and signing is blocked", async () => {
    const revocation = createRevocationRegistry({ now: () => CLOCK });
    const signer = createIsaXSigner({ now: () => CLOCK, revocation });
    const scope = "cognition:route";
    const request = { method: "POST", path: "/api/v1/cognition/route" };

    const signature = await signer.sign({ request, scope, timestamp: CLOCK });
    expect(revocation.isKeyRevoked(signer.keyId)).toBe(false);

    revocation.revokeKey(signer.keyId, "compromise");
    expect(revocation.isKeyRevoked(signer.keyId)).toBe(true);

    const rejected = await signer.verify({ request, signature, expectedScope: scope, now: CLOCK });
    expect(rejected).toMatchObject({ ok: false, reason: "KEY_REVOKED" });

    await expect(signer.sign({ request, scope, timestamp: CLOCK })).rejects.toThrow(IsaXError);
    expect(revocation.records().some((r) => r.kind === "key" && r.id === signer.keyId)).toBe(true);
  });

  it("honours ring-level revocation through signer.revokeKey", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const scope = "s";
    const request = { method: "POST", path: "/x" };
    const signature = await signer.sign({ request, scope, timestamp: CLOCK });

    signer.revokeKey(signer.keyId, "key_rollover");
    expect(signer.keyRing().get(signer.keyId)?.state).toBe("REVOKED");

    const rejected = await signer.verify({ request, signature, expectedScope: scope, now: CLOCK });
    expect(rejected).toMatchObject({ ok: false, reason: "KEY_REVOKED" });
  });
});

describe("ISA-X revocation — session tokens", () => {
  it("issues a token on challenge success and invalidates it on revoke", async () => {
    const revocation = createRevocationRegistry({ now: () => CLOCK });
    const signer = createIsaXSigner({ now: () => CLOCK, revocation });
    const challenges = createIsaXChallengeService({ signer, revocation, ttlMs: TTL, now: () => CLOCK });

    const challenge = challenges.issue("session:open");
    const signature = await signer.sign({
      request: challengeRequest(challenge),
      scope: challenge.scope,
      nonce: challenge.nonce,
      timestamp: CLOCK,
    });
    const verdict = await challenges.resolve({ challengeId: challenge.challengeId, signature }, CLOCK);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error(`unexpected verdict ${verdict.reason}`);
    expect(verdict.token.length).toBeGreaterThanOrEqual(16);

    expect(revocation.isTokenRevoked(verdict.token)).toBe(false);
    expect(() => requireTokenValid(revocation, verdict.token)).not.toThrow();

    revocation.revokeToken(verdict.token, "logout");
    expect(revocation.isTokenRevoked(verdict.token)).toBe(true);
    expect(() => requireTokenValid(revocation, verdict.token)).toThrow(IsaXError);
    try {
      requireTokenValid(revocation, verdict.token);
    } catch (error) {
      expect((error as IsaXError).code).toBe("ISA_X_TOKEN_REVOKED");
    }
    expect(revocation.records().some((r) => r.kind === "token")).toBe(true);
  });
});