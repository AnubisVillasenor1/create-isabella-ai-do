import { describe, expect, it } from "vitest";
import {
  IKESEngine,
  hashSourceContent,
  verifyKnowledgeClaimIntegrity,
  type IKESEnginePersistencePort,
  type IKESEngineSnapshot,
  type KnowledgeClaim,
  type KnowledgeSource,
} from "../../src/memory/ikes";

function fakePersistence(seed: IKESEngineSnapshot = { sources: [], claims: [] }) {
  const sources = new Map(seed.sources.map((source) => [source.sourceId, source] as const));
  const claims = new Map(seed.claims.map((claim) => [claim.claimId, claim] as const));
  const port: IKESEnginePersistencePort = {
    async load() { return { sources: [...sources.values()], claims: [...claims.values()] }; },
    async saveSource(source: KnowledgeSource) { sources.set(source.sourceId, source); },
    async saveClaim(claim: KnowledgeClaim) { claims.set(claim.claimId, claim); },
    async health() { return { healthy: true, reason: "test persistence available" }; },
  };
  return { port, sources, claims };
}

describe("IKES durable persistence contract", () => {
  it("persists admitted source/claim state and hydrates integrity-valid records", async () => {
    const backing = fakePersistence();
    const first = new IKESEngine(backing.port);
    await first.initPersistence();

    const source: KnowledgeSource = {
      sourceId: "src-test",
      uri: "https://example.org/research",
      title: "Test source",
      retrievedAt: "2026-10-17T00:00:00.000Z",
      contentHash: hashSourceContent("source content"),
      license: "CC-BY-4.0",
    };
    first.registerSource(source);
    await first.flushPersistence();

    const proposal = {
      proposedBy: "human:reviewer",
      evidenceIds: [source.sourceId],
      claim: {
        subject: "Isabella",
        predicate: "hasModule",
        object: "IKES",
        sourceIds: [source.sourceId],
        evidenceIds: [source.sourceId],
        temporalState: "current" as const,
        license: "CC-BY-4.0",
        provenance: { review: "test-only" },
      },
    };
    const claim = first.propose(proposal);
    await first.flushPersistence();
    expect(verifyKnowledgeClaimIntegrity(claim)).toBe(true);

    const restored = new IKESEngine(backing.port);
    await restored.initPersistence();
    expect(restored.retrieve("Isabella")).toHaveLength(1);
    expect(restored.retrieve("Isabella")[0]?.claimId).toBe(claim.claimId);
    expect((await restored.persistenceProbe()).healthy).toBe(true);
  });

  it("does not allow retrieval before durable hydration finishes", async () => {
    let releaseLoad!: (value: IKESEngineSnapshot) => void;
    const port: IKESEnginePersistencePort = {
      load: () => new Promise((resolve) => { releaseLoad = resolve; }),
      async saveSource() {},
      async saveClaim() {},
      async health() { return { healthy: true, reason: "ok" }; },
    };
    const engine = new IKESEngine(port);
    const init = engine.initPersistence();
    expect(() => engine.retrieve("anything")).toThrow("IKES_PERSISTENCE_NOT_INITIALIZED");
    releaseLoad({ sources: [], claims: [] });
    await init;
    expect(engine.retrieve("anything")).toEqual([]);
  });

  it("reports persistence write failures instead of silently claiming durability", async () => {
    const port: IKESEnginePersistencePort = {
      async load() { return { sources: [], claims: [] }; },
      async saveSource() { throw new Error("database unavailable"); },
      async saveClaim() {},
      async health() { return { healthy: true, reason: "connection ok" }; },
    };
    const engine = new IKESEngine(port);
    await engine.initPersistence();
    engine.registerSource({
      sourceId: "src-fail",
      uri: "https://example.org/source",
      title: "Failure test",
      retrievedAt: "2026-10-17T00:00:00.000Z",
      contentHash: hashSourceContent("failure source"),
    });
    await expect(engine.flushPersistence()).rejects.toThrow("IKES_PERSISTENCE_WRITE_FAILED");
    expect((await engine.persistenceProbe()).healthy).toBe(false);
  });
});
