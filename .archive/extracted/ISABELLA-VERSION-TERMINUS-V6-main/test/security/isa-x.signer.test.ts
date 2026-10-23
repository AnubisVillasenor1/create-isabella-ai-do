import { describe, expect, it } from "vitest";
import {
  createIsaXSigner,
  type IsaXAuditEvent,
  type IsaXVerifyResult,
} from "../../src/security/isa-x";

const CLOCK = 1_700_000_000_000;

function request() {
  return {
    method: "post",
    path: "/api/v1/isabella/mediate",
    query: { b: "2", a: "1" },
    headers: { "X-Trace": "trace-1", "Content-Type": "application/json" },
    body: new TextEncoder().encode("{\"intent\":\"reflect\"}"),
  };
}

async function expectOk(result: IsaXVerifyResult): Promise<void> {
  expect(result.ok).toBe(true);
  if (!result.ok) expect(result.reason).toBe("OK");
}

describe("ISA-X signer — per-request signing and verification", () => {
  it("signs and verifies a request with a real Ed25519 signature", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const signature = await signer.sign({ request: request(), scope: "isabella:mediate" });
    expect(signature.version).toBe("1.1");
    expect(signature.keyId).toBe(signer.keyId);
    expect(signature.signature).toMatch(/^[A-Za-z0-9_-]{16,}$/);

    const result = await signer.verify({
      request: request(),
      signature,
      expectedScope: "isabella:mediate",
      now: CLOCK,
    });
    await expectOk(result);
  });

  it("is deterministic for identical inputs (Ed25519)", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const nonce = "deterministic-nonce";
    const one = await signer.sign({ request: request(), scope: "s", nonce, timestamp: CLOCK });
    const two = await signer.sign({ request: request(), scope: "s", nonce, timestamp: CLOCK });
    expect(one.signature).toBe(two.signature);
  });

  it("rejects a tampered request", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const signature = await signer.sign({ request: request(), scope: "isabella:mediate" });
    const tampered = { ...request(), body: new TextEncoder().encode("{\"intent\":\"exfiltrate\"}") };
    const result = await signer.verify({ request: tampered, signature, expectedScope: "isabella:mediate", now: CLOCK });
    expect(result).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a signature carrying an unknown key", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const signature = await signer.sign({ request: request(), scope: "s" });
    const spoofed = { ...signature, keyId: "isa-x-forged" };
    const result = await signer.verify({ request: request(), signature: spoofed, expectedScope: "s", now: CLOCK });
    expect(result).toMatchObject({ ok: false, reason: "UNKNOWN_KEY" });
  });

  it("rejects an unsupported protocol version", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const signature = await signer.sign({ request: request(), scope: "s" });
    const spoofed = { ...signature, version: "0.9" };
    const result = await signer.verify({ request: request(), signature: spoofed, expectedScope: "s", now: CLOCK });
    expect(result).toMatchObject({ ok: false, reason: "PROTOCOL_MISMATCH" });
  });
});

describe("ISA-X signer — scope denial", () => {
  it("denies a scope the signature does not cover", async () => {
    const signer = createIsaXSigner({ now: () => CLOCK });
    const signature = await signer.sign({ request: request(), scope: "payment:write" });

    const denied = await signer.verify({
      request: request(),
      signature,
      expectedScope: "payment:read",
      now: CLOCK,
    });
    expect(denied).toMatchObject({ ok: false, reason: "SCOPE_REJECTED" });

    const exact = await signer.verify({
      request: request(),
      signature,
      expectedScope: "payment:write",
      now: CLOCK,
    });
    await expectOk(exact);

    const wildcard = await signer.verify({
      request: request(),
      signature,
      expectedScope: "payment:*",
      now: CLOCK,
    });
    await expectOk(wildcard);
  });
});

describe("ISA-X signer — audit hooks", () => {
  it("emits audit events for sign and verify", async () => {
    const events: IsaXAuditEvent[] = [];
    const signer = createIsaXSigner({ now: () => CLOCK, audit: (event) => events.push(event) });
    const signature = await signer.sign({ request: request(), scope: "audit:scope" });
    await signer.verify({ request: request(), signature, expectedScope: "audit:scope", now: CLOCK });
    await signer.verify({ request: request(), signature, expectedScope: "other:scope", now: CLOCK });

    const actions = events.map((e) => `${e.action}:${e.ok}:${e.reason}`);
    expect(actions).toContain("sign:true:OK");
    expect(actions).toContain("verify:true:OK");
    expect(actions).toContain("verify:false:SCOPE_REJECTED");
    const failed = events.find((e) => !e.ok);
    expect(failed?.keyId).toBe(signer.keyId);
  });
});