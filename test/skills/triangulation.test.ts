import { describe, expect, it } from "vitest";
import {
  hashEvidence,
  hashInput,
  hashOutput,
  hashPolicy,
  manifestHash,
  triangulate,
  type SkillContract,
} from "../../src/skills";

const contract: SkillContract = {
  inputSchema: { type: "object", required: ["amount"], properties: { amount: { type: "integer", minimum: 1 } } },
  outputSchema: { type: "object", required: ["ok"], properties: { ok: { const: true } } },
  authority: { requiredScopes: ["test:run"], requiresStepUp: false, requiresQuorum: false },
  evidencePolicy: { required: false, piiRedaction: false, retentionDays: 1 },
  limits: { maxLatencyMs: 1000, maxMemoryMb: 64, maxCallsPerMinute: 60, maxEnergyUnits: 10 },
  rollback: { supported: false, strategy: "none" },
};

const provenance = { actorId: "human-1", tenantId: "tamv", federationId: "f1", policyVersion: "CROWN-v20" };

describe("HyperCore Ω triangulation", () => {
  it("validates an execution on the contract, provenance and result planes", () => {
    const result = triangulate({ contract, input: { amount: 5 }, output: { ok: true }, provenance, riskTier: "LOW" });
    expect(result.valid).toBe(true);
    expect(result.invalidVertices).toHaveLength(0);
    expect(result.result.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.result.signatureValid).toBeNull();
  });

  it("fails the contract vertex when the input violates its schema", () => {
    const result = triangulate({ contract, input: { amount: 0 }, output: { ok: true }, provenance, riskTier: "LOW" });
    expect(result.valid).toBe(false);
    expect(result.contract.inputValid).toBe(false);
    expect(result.invalidVertices).toContain("contract");
  });

  it("fails the contract vertex when the output violates its schema", () => {
    const result = triangulate({ contract, input: { amount: 5 }, output: { ok: false }, provenance, riskTier: "LOW" });
    expect(result.valid).toBe(false);
    expect(result.contract.outputValid).toBe(false);
  });

  it("fails the provenance vertex when an identity field is empty", () => {
    const result = triangulate({
      contract,
      input: { amount: 5 },
      output: { ok: true },
      provenance: { ...provenance, tenantId: "" },
      riskTier: "LOW",
    });
    expect(result.valid).toBe(false);
    expect(result.provenance.valid).toBe(false);
    expect(result.invalidVertices).toContain("provenance");
  });

  it("fails the result vertex when the reported manifest hash does not recompute", () => {
    const result = triangulate({
      contract,
      input: { amount: 5 },
      output: { ok: true },
      provenance,
      riskTier: "LOW",
      expectedManifestHash: "0".repeat(64),
    });
    expect(result.valid).toBe(false);
    expect(result.invalidVertices).toContain("result");
  });

  it("recomputes a stable manifest hash from the four plane hashes", () => {
    const inputHash = hashInput({ amount: 5 });
    const outputHash = hashOutput({ ok: true });
    const policyHash = hashPolicy({ policyVersion: "CROWN-v20", riskTier: "LOW", requiredScopes: ["test:run"] });
    const evidenceHash = hashEvidence(["a", "b"]);
    const expected = manifestHash({ inputHash, outputHash, policyHash, evidenceHash });
    const result = triangulate({
      contract,
      input: { amount: 5 },
      output: { ok: true },
      provenance,
      riskTier: "LOW",
      evidenceHashes: ["a", "b"],
      expectedManifestHash: expected,
    });
    expect(result.valid).toBe(true);
    expect(result.result.manifestHash).toBe(expected);
    expect(result.result.evidenceHash).toBe(evidenceHash);
  });

  it("checks the manifest signature when provided", () => {
    const inputHash = hashInput({ amount: 5 });
    const outputHash = hashOutput({ ok: true });
    const policyHash = hashPolicy({ policyVersion: "CROWN-v20", riskTier: "LOW", requiredScopes: ["test:run"] });
    const evidenceHash = hashEvidence([]);
    const expected = manifestHash({ inputHash, outputHash, policyHash, evidenceHash });
    const result = triangulate({
      contract,
      input: { amount: 5 },
      output: { ok: true },
      provenance,
      riskTier: "LOW",
      expectedManifestHash: expected,
      signature: "deadbeef",
      verifySignature: (hash) => hash === expected,
    });
    expect(result.result.signatureValid).toBe(true);
    expect(result.valid).toBe(true);
  });
});
