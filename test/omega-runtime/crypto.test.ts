import { describe, expect, it } from "vitest";
import {
  HYBRID_ENVELOPE_SCHEMA,
  PostQuantumReadiness,
  verifyHybridEnvelope,
} from "../../src/omega-runtime/crypto";

describe("ΩX-20 hybrid envelope readiness", () => {
  it("signs and verifies a canonical payload end-to-end", async () => {
    const readiness = new PostQuantumReadiness(undefined, "omega-test");
    const payload = { decision: "allow", evidence: ["local"], nested: { b: 2, a: 1 } };
    const envelope = await readiness.sign(payload, "2026-10-25T00:00:00.000Z");
    expect(envelope.schema).toBe(HYBRID_ENVELOPE_SCHEMA);
    expect(envelope.algorithm).toBe("Ed25519+SHA3-512");
    expect(envelope.keyId).toBe("omega-test");
    expect(envelope.quantumResistant).toBe(false);
    expect(envelope.payloadHash).toMatch(/^[0-9a-f]{128}$/);
    expect(await readiness.verify(envelope, payload)).toBe(true);
    expect(await verifyHybridEnvelope(readiness.publicKeyPem(), envelope, payload)).toBe(true);
  });

  it("detects payload and signature tampering", async () => {
    const readiness = new PostQuantumReadiness(undefined, "omega-test");
    const envelope = await readiness.sign({ amount: 10 });
    expect(await readiness.verify(envelope, { amount: 11 })).toBe(false);
    expect(await verifyHybridEnvelope(readiness.publicKeyPem(), envelope, { amount: 11 })).toBe(false);

    const tampered = { ...envelope, signature: `${envelope.signature.slice(0, -2)}aa` };
    expect(await readiness.verify(tampered, { amount: 10 })).toBe(false);
  });

  it("reports classical-only readiness without pretending to be post-quantum", () => {
    const readiness = new PostQuantumReadiness(undefined, "omega-test");
    const inventory = readiness.inventory();
    expect(inventory.state).toBe("classical-only");
    expect(inventory.classicalSignature.available).toBe(true);
    expect(inventory.hashBinding.available).toBe(true);
    expect(inventory.postQuantum.available).toBe(false);
    expect(inventory.postQuantum.algorithms).toEqual(
      expect.arrayContaining(["ML-KEM-768", "ML-DSA-65", "SLH-DSA-SHA2-128s"]),
    );
    expect(inventory.quantumResistant).toBe(false);
    expect(inventory.note).toMatch(/no resistencia post-cuántica/i);
  });
});
