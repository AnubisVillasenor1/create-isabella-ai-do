import { describe, expect, it } from "vitest";
import { createIsaXSigner, type IsaXRequest } from "../../src/security/isa-x";

const CLOCK = 1_700_000_000_000;

function request(): IsaXRequest {
  return { method: "POST", path: "/api/v1/isabella/mediate", body: new TextEncoder().encode("rotate") };
}

describe("ISA-X double-phase key rotation", () => {
  it("keeps the previous key verifiable after one rotation and retires it after the second", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const scope = "rotation:scope";
    const key1 = signer.keyId;
    const ring = signer.keyRing();

    const sig1 = await signer.sign({ request: request(), scope, timestamp: CLOCK });

    const rotate1 = signer.rotate();
    expect(rotate1.demotedKeyId).toBe(key1);
    expect(rotate1.newKeyId).not.toBe(key1);
    expect(ring.get(key1)?.state).toBe("PREVIOUS");
    expect(ring.all().filter((k) => k.state === "ACTIVE")).toHaveLength(1);

    // The demoted key can no longer sign, but keeps verifying (grace).
    await expect(signer.sign({ request: request(), scope, keyId: key1, timestamp: CLOCK })).rejects.toThrow(
      /ISA_X_KEY_NOT_ACTIVE/,
    );
    const sig2 = await signer.sign({ request: request(), scope, timestamp: CLOCK });
    expect(sig2.keyId).toBe(rotate1.newKeyId);

    expect((await signer.verify({ request: request(), signature: sig1, expectedScope: scope, now: CLOCK })).ok).toBe(true);
    expect((await signer.verify({ request: request(), signature: sig2, expectedScope: scope, now: CLOCK })).ok).toBe(true);

    // Second rotation: key1 is retired (REVOKED), key2 becomes PREVIOUS.
    const rotate2 = signer.rotate();
    expect(rotate2.retiredKeyId).toBe(key1);
    expect(ring.get(key1)?.state).toBe("REVOKED");
    expect(ring.get(sig2.keyId)?.state).toBe("PREVIOUS");
    expect(ring.all().filter((k) => k.state === "ACTIVE")).toHaveLength(1);

    const afterRetire = await signer.verify({ request: request(), signature: sig1, expectedScope: scope, now: CLOCK });
    expect(afterRetire).toMatchObject({ ok: false, reason: "KEY_REVOKED" });

    const sig2After = await signer.verify({ request: request(), signature: sig2, expectedScope: scope, now: CLOCK });
    expect(sig2After.ok).toBe(true);

    const sig3 = await signer.sign({ request: request(), scope, timestamp: CLOCK });
    expect(sig3.keyId).toBe(rotate2.newKeyId);
  });
});