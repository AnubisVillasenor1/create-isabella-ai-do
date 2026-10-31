import { describe, expect, it } from "vitest";
import { CapabilityGateway, CapabilityRegistry, InMemoryMemoryFabric, KnowledgeFabric, consensus, verifyClaim } from "../src/capabilities";
import type { CapabilityGatewayPolicy } from "../src/capabilities";
import { IsabellaGenesisRuntime } from "../src/genesis/runtime";

describe("HSF", () => {
  it("registers canonical HSF capabilities during Genesis runtime initialization", () => {
    const runtime = new IsabellaGenesisRuntime();
    const ids = runtime.capabilities.list().map((capability) => capability.id);
    expect(ids).toContain("hsf.memory.fabric");
    expect(ids).toContain("hsf.execution.fabric");
    expect(ids).toContain("hsf.knowledge.fabric");
    expect(ids.length).toBeGreaterThanOrEqual(10);
  });


  it("invokes a registered capability", async () => {
    const registry = new CapabilityRegistry();
    registry.register({
      descriptor: { id: "test.capability", version: "1.0.0", domain: "integration", description: "test", riskTier: "LOW", requiresAuthority: true },
      health: () => "ready",
      execute: async (input) => ({ ok: true, input }),
    });
    const allowForTest: CapabilityGatewayPolicy = { authorize: async () => ({ granted: true, reason: "TEST_POLICY" }) };
    const result = await new CapabilityGateway(registry, allowForTest).invoke("test.capability", { value: 7 }, {
      requestId: "req-1", traceId: "trace-1", principalId: "p", role: "operator", policyVersion: "test",
      metadata: { authenticated: "true", genesisGovernanceAdmitted: "true" },
    });
    expect(result.status).toBe("executed");
  });

  it("freezes registered capability descriptors against external mutation", () => {
    const registry = new CapabilityRegistry();
    registry.register({
      descriptor: { id: "stable.descriptor", version: "1.0.0", domain: "integration", description: "stable", riskTier: "LOW", requiresAuthority: true },
      health: () => "ready",
      execute: async () => ({ ok: true }),
    });
    const descriptor = registry.list()[0];
    expect(descriptor).toBeDefined();
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(registry.get("stable.descriptor").descriptor)).toBe(true);
  });

  it("requires human approval for high-risk capabilities", async () => {
    const registry = new CapabilityRegistry();
    let executed = false;
    registry.register({
      descriptor: { id: "high-risk.capability", version: "1.0.0", domain: "execution", description: "high-risk", riskTier: "HIGH", requiresAuthority: true },
      health: () => "ready",
      execute: async () => { executed = true; return { ok: true }; },
    });
    const result = await new CapabilityGateway(registry).invoke("high-risk.capability", {}, {
      requestId: "req-high", traceId: "trace-high", principalId: "service", role: "operator", policyVersion: "test",
      metadata: { authenticated: "true", genesisGovernanceAdmitted: "true" },
    });
    expect(result.status).toBe("rejected");
    expect(result.error).toBe("HSF_HUMAN_APPROVAL_REQUIRED");
    expect(executed).toBe(false);
  });

  it("does not execute a degraded capability provider", async () => {
    const registry = new CapabilityRegistry();
    let executed = false;
    registry.register({
      descriptor: { id: "degraded.capability", version: "1.0.0", domain: "execution", description: "degraded", riskTier: "LOW", requiresAuthority: true },
      health: () => "degraded",
      execute: async () => { executed = true; return { ok: true }; },
    });
    const result = await new CapabilityGateway(registry).invoke("degraded.capability", {}, {
      requestId: "req-degraded", traceId: "trace-degraded", principalId: "service", role: "operator", policyVersion: "test",
      metadata: { authenticated: "true", genesisGovernanceAdmitted: "true" },
    });
    expect(result.status).toBe("unavailable");
    expect(result.error).toBe("HSF_PROVIDER_DEGRADED_FAIL_CLOSED");
    expect(executed).toBe(false);
  });

  it("denies invocation without server-authenticated governance metadata", async () => {
    const registry = new CapabilityRegistry();
    registry.register({
      descriptor: { id: "protected.capability", version: "1.0.0", domain: "integration", description: "protected", riskTier: "HIGH", requiresAuthority: true },
      health: () => "ready",
      execute: async () => ({ secret: "should-not-run" }),
    });
    const result = await new CapabilityGateway(registry).invoke("protected.capability", {}, {
      requestId: "req-deny", traceId: "trace-deny", principalId: "client-controlled", role: "admin", policyVersion: "test",
    });
    expect(result.status).toBe("rejected");
    expect(result.error).toBe("HSF_AUTHORIZATION_POLICY_NOT_CONFIGURED");
  });

  it("does not expose mutable internal memory records", () => {
    const memory = new InMemoryMemoryFabric();
    const saved = memory.write({ text: "private internal text", namespace: "genesis", relations: ["r1"], metadata: { owner: "admin" } });
    (saved as { text: string }).text = "tampered";
    (saved.relations as string[]).push("tampered");
    const retrieved = memory.retrieve("private");
    expect(retrieved[0]?.text).toBe("private internal text");
    expect(retrieved[0]?.relations).toEqual(["r1"]);
    expect(() => memory.retrieve("", undefined, 0)).toThrow(/LIMIT_OUT_OF_RANGE/);
  });

  it("keeps ingested knowledge pending review and returns detached records", () => {
    const knowledge = new KnowledgeFabric();
    const artifact = knowledge.ingest({ title: "T", content: "C", source: "S" });
    expect(artifact.status).toBe("PENDING_REVIEW");
    (artifact as { content: string }).content = "tampered";
    expect(knowledge.get(artifact.id)?.content).toBe("C");
    expect(knowledge.list()[0]?.status).toBe("PENDING_REVIEW");
  });

  it("labels consensus and evidence scores as heuristics, not truth probabilities", () => {
    const result = consensus([
      { expertId: "a", verdict: "yes", confidence: 0.9, evidence: ["e1"] },
      { expertId: "b", verdict: "no", confidence: 0.9, evidence: ["e2"] },
      { expertId: "c", verdict: "yes", confidence: 0.9, evidence: ["e3"] },
    ]);
    expect(result.verdict).toBe("yes");
    expect(result.agreementRatio).toBeCloseTo(2 / 3);
    expect(result.confidence).toBeCloseTo(0.6);
    expect(result.confidenceType).toBe("HEURISTIC_AGREEMENT_SCORE");

    const score = verifyClaim({ claim: "claim", evidence: ["source-1", "source-2"], contradictions: [] });
    expect(score.confidence).toBe(0.8);
    expect(score.scoreType).toBe("HEURISTIC_NOT_PROBABILITY");
    expect(score.level).toBe("SUPPORTIVE_SIGNAL");
    expect(verifyClaim({ claim: "unknown", evidence: [], contradictions: [] }).level).toBe("UNVERIFIED");
  });

  it("fails closed for unknown capabilities and deduplicates memory", async () => {
    const gateway = new CapabilityGateway(new CapabilityRegistry());
    const result = await gateway.invoke("missing", {}, {
      requestId: "req-1", traceId: "trace-1", principalId: "p", role: "operator", policyVersion: "test",
    });
    expect(result.status).toBe("rejected");
    const registered = new CapabilityRegistry();
    registered.register({
      descriptor: { id: "registered", version: "1.0.0", domain: "integration", description: "test", riskTier: "LOW", requiresAuthority: true },
      health: () => "ready",
      execute: async () => "should not run",
    });
    const denied = await new CapabilityGateway(registered).invoke("registered", {}, {
      requestId: "req-2", traceId: "trace-2", principalId: "p", role: "operator", policyVersion: "test",
    });
    expect(denied.status).toBe("rejected");
    expect(denied.error).toBe("HSF_AUTHORIZATION_POLICY_NOT_CONFIGURED");
    const memory = new InMemoryMemoryFabric();
    const a = memory.write({ text: "Genesis knowledge", namespace: "genesis", relations: [] });
    const b = memory.write({ text: "Genesis knowledge", namespace: "genesis", relations: [] });
    expect(a.id).toBe(b.id);
    const knowledge = new KnowledgeFabric();
    const artifact = knowledge.ingest({ title: "T", content: "C", source: "S" });
    expect(artifact.contentHash).toHaveLength(64);
    expect(artifact.status).toBe("PENDING_REVIEW");
  });
});
