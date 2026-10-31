import { describe, expect, it } from "vitest";
import {
  challengeRequest,
  createIsaXChallengeService,
  createIsaXSigner,
  type IsaXChallengeAnswer,
  type IsaXChallengeService,
  type IsaXSigner,
} from "../../src/security/isa-x";

const CLOCK = 1_700_000_000_000;
const TTL = 300_000;
const SKEW = 30_000;

interface Harness {
  readonly signer: IsaXSigner;
  readonly challenges: IsaXChallengeService;
}

function service(): Harness {
  const signer = createIsaXSigner({ now: () => CLOCK, clockSkewMs: SKEW });
  const challenges = createIsaXChallengeService({ signer, ttlMs: TTL, clockSkewMs: SKEW, now: () => CLOCK });
  return { signer, challenges };
}

async function answerFor(
  signer: IsaXSigner,
  challenges: IsaXChallengeService,
  scope: string,
  timestamp?: number,
): Promise<{ answer: IsaXChallengeAnswer; scope: string }> {
  const challenge = challenges.issue(scope);
  const signature = await signer.sign({
    request: challengeRequest(challenge),
    scope: challenge.scope,
    nonce: challenge.nonce,
    timestamp,
  });
  return { answer: { challengeId: challenge.challengeId, signature }, scope: challenge.scope };
}

describe("ISA-X challenge handshake", () => {
  it("accepts a fresh challenge and rejects a replayed answer (nonce reuse)", async () => {
    const { signer, challenges } = service();
    const { answer, scope } = await answerFor(signer, challenges, "cognition:route");

    const first = await challenges.resolve(answer, CLOCK);
    expect(first.ok).toBe(true);
    if (!first.ok) expect(first.reason).toBe("OK");
    expect(first.ok ? first.token : "").toMatch(/^[A-Za-z0-9_-]{16,}$/);

    const replay = await challenges.resolve(answer, CLOCK);
    expect(replay).toMatchObject({ ok: false, reason: "NONCE_REUSE" });
    void scope;
  });

  it("rejects an answer whose timestamp is outside the skew window", async () => {
    const { signer, challenges } = service();
    const { answer } = await answerFor(signer, challenges, "cognition:route", CLOCK - SKEW - 60_000);
    const verdict = await challenges.resolve(answer, CLOCK);
    expect(verdict).toMatchObject({ ok: false, reason: "TIMESTAMP_SKEW" });
  });

  it("rejects a future timestamp outside the skew window", async () => {
    const { signer, challenges } = service();
    const { answer } = await answerFor(signer, challenges, "cognition:route", CLOCK + SKEW + 60_000);
    const verdict = await challenges.resolve(answer, CLOCK);
    expect(verdict).toMatchObject({ ok: false, reason: "TIMESTAMP_SKEW" });
  });

  it("rejects an expired challenge", async () => {
    const { signer, challenges } = service();
    const { answer } = await answerFor(signer, challenges, "cognition:route");
    const verdict = await challenges.resolve(answer, CLOCK + TTL + 1_000);
    expect(verdict).toMatchObject({ ok: false, reason: "EXPIRED" });
  });

  it("rejects an unknown challenge id", async () => {
    const { signer, challenges } = service();
    const { answer } = await answerFor(signer, challenges, "cognition:route");
    const verdict = await challenges.resolve({ ...answer, challengeId: "00000000-0000-0000-0000-000000000000" }, CLOCK);
    expect(verdict).toMatchObject({ ok: false, reason: "UNKNOWN_CHALLENGE" });
  });

  it("rejects a nonce bound to a different challenge", async () => {
    const { signer, challenges } = service();
    const { answer: answerA } = await answerFor(signer, challenges, "cognition:route");
    const { answer: answerB } = await answerFor(signer, challenges, "cognition:route");
    const mixed = { challengeId: answerA.challengeId, signature: answerB.signature };
    const verdict = await challenges.resolve(mixed, CLOCK);
    expect(verdict).toMatchObject({ ok: false, reason: "MALFORMED" });
  });
});