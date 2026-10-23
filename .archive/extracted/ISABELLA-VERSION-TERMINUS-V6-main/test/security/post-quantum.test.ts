import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  Ed25519Signer,
  PqcBackendUnavailable,
  algorithmCapabilityReport,
  createPqcSignatureAlgorithm,
  verifyEd25519,
} from "../../src/security";

const payload = new TextEncoder().encode("sovereign-message");

describe("post-quantum signing facade", () => {
  it("produces real verifiable Ed25519 signatures and rejects tampering", async () => {
    const signer = Ed25519Signer.generate("key-1");
    const signature = await signer.sign(payload);
    expect(await signer.verify(payload, signature)).toBe(true);
    expect(await signer.verify(new TextEncoder().encode("tampered"), signature)).toBe(false);

    const tampered = new Uint8Array(signature);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(await signer.verify(payload, tampered)).toBe(false);

    expect(await verifyEd25519(signer.publicKeyPem(), payload, signature)).toBe(true);
    const other = Ed25519Signer.generate();
    expect(await verifyEd25519(other.publicKeyPem(), payload, signature)).toBe(false);
  });

  it("reloads an Ed25519 signer from a PEM private key", async () => {
    const pair = generateKeyPairSync("ed25519");
    const privateKeyPem = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const signer = Ed25519Signer.fromPem(privateKeyPem, "key-pem");
    expect(signer.algorithm).toBe("Ed25519");
    expect(signer.keyId).toBe("key-pem");
    const signature = await signer.sign(payload);
    expect(await signer.verify(payload, signature)).toBe(true);
  });

  it("rejects non-Ed25519 keys", () => {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKeyPem = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    expect(() => Ed25519Signer.fromPem(privateKeyPem)).toThrow(/Ed25519/);
  });

  it("throws PQC_BACKEND_UNAVAILABLE when requesting ML-DSA without a provider", () => {
    try {
      createPqcSignatureAlgorithm("ML-DSA-65");
      throw new Error("expected createPqcSignatureAlgorithm to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PqcBackendUnavailable);
      expect((error as PqcBackendUnavailable).code).toBe("PQC_BACKEND_UNAVAILABLE");
    }
    expect(() => createPqcSignatureAlgorithm("ML-KEM-768")).toThrow(PqcBackendUnavailable);
  });

  it("delegates to a configured external provider", async () => {
    const provider = {
      kind: "hsm" as const,
      keyId: "hsm-1",
      sign: async () => new Uint8Array([1, 2, 3]),
      verify: async () => true,
    };
    const algorithm = createPqcSignatureAlgorithm("ML-DSA-65", { provider });
    expect(algorithm.environment).toBe("EXTERNAL_PROVIDER");
    expect(algorithm.state).toBe("draft");
    const signature = await algorithm.sign(payload);
    expect(await algorithm.verify(payload, signature)).toBe(true);
  });

  it("reports the honest algorithm capability state", () => {
    const report = algorithmCapabilityReport();
    expect(report.state).toBe("draft");
    expect(report.implemented).toEqual(["Ed25519"]);
    expect(report.blockedEnvironment).toContain("ML-KEM-768");
    expect(report.blockedEnvironment).toContain("ML-DSA-65");
    expect(report.blockedEnvironment).toContain("SLH-DSA-SHA2-128s");
    const ed25519 = report.algorithms.find((a) => a.algorithm === "Ed25519");
    expect(ed25519?.status).toBe("implemented");
    expect(ed25519?.environment).toBe("AVAILABLE");
    for (const algorithm of report.algorithms.filter((a) => a.family === "post-quantum")) {
      expect(algorithm.status).toBe("pending_provider");
      expect(algorithm.environment).toBe("BLOCKED_ENVIRONMENT");
    }
  });
});
