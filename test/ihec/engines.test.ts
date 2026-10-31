import { describe, expect, it } from "vitest";
import {
  CognitiveGovernanceCore,
  CrisisMemoryEngine,
  DatasetFusionEngine,
  HyperCacheEngine,
  HyperMlFusionEngine,
  HyperRagEngine,
  HyperRecoveryEngine,
  HyperSentinelEngine,
  HyperSnapshotEngine,
  ImmuneMutationEngine,
  OmegaMode,
  SelfHealingTopologyEngine,
  VectorHyperIndex,
  sealPayload,
  type IhecSnapshot,
} from "../../src/ihec";

describe("IHEC · Hyper Snapshot / Recovery", () => {
  it("sella el snapshot con SHA3-512 determinista", () => {
    const engine = new HyperSnapshotEngine();
    const a = engine.capture({ state: { x: 1 }, memory: [1, 2] });
    const b = engine.capture({ state: { x: 1 }, memory: [1, 2] });
    expect(a.hash).toHaveLength(128);
    expect(a.hash).toBe(b.hash);
    expect(sealPayload({ x: 1 })).toBe(sealPayload({ x: 1 }));
  });

  it("restaura verificando integridad", () => {
    const snapshot = new HyperSnapshotEngine().capture({ state: { a: 1 } });
    const recovery = new HyperRecoveryEngine().restore(snapshot);
    expect(recovery.integrityVerified).toBe(true);
    expect(recovery.restoredFrom).toBe(snapshot.hash);
  });

  it("falla cerrado ante un snapshot manipulado", () => {
    const snapshot = new HyperSnapshotEngine().capture({ state: { a: 1 } });
    const tampered: IhecSnapshot = { ...snapshot, state: { a: 2 } };
    expect(() => new HyperRecoveryEngine().restore(tampered)).toThrow(/INTEGRITY_FAILED/);
  });
});

describe("IHEC · Hyper Sentinel", () => {
  it("puntúa señales de forma determinista", () => {
    const sentinel = new HyperSentinelEngine();
    expect(sentinel.detect({}).risk).toBe(0.4);
    expect(sentinel.detect({ signature: "ok", contextDrift: 0.9, semanticNoise: 0.9 }).risk).toBe(0.6);
    const high = sentinel.detect({ contextDrift: 0.9, semanticNoise: 0.9 });
    expect(high.risk).toBe(1);
    expect(high.level).toBe("high");
  });
});

describe("IHEC · Hyper Cache", () => {
  it("gestiona niveles hot/warm/cold y métricas", () => {
    const cache = new HyperCacheEngine();
    cache.set("a", "1");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("missing")).toBeUndefined();
    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.tiers.hot).toBe(1);
  });

  it("expulsa y demota al exceder la capacidad hot", () => {
    const cache = new HyperCacheEngine();
    for (let index = 0; index < 10; index += 1) cache.set(`k${index}`, `v${index}`);
    const stats = cache.stats();
    expect(stats.tiers.hot).toBe(8);
    expect(stats.tiers.warm).toBe(2);
    expect(stats.demotions).toBe(2);
  });
});

describe("IHEC · Hyper ML Fusion", () => {
  it("selecciona la señal dominante", () => {
    const fusion = new HyperMlFusionEngine();
    expect(fusion.fuse({ llm: 1 }).selected).toBe("llm");
    expect(fusion.fuse({ rules: 0.5, llm: 0.1 }).selected).toBe("rules");
  });
});

describe("IHEC · Dataset Fusion", () => {
  it("deduplica y enriquece deterministamente", () => {
    const result = new DatasetFusionEngine().process([
      { id: "1", content: "alpha" },
      { id: "2", content: "alpha" },
      { id: "3", content: "beta", tags: ["x"] },
    ]);
    expect(result.ingested).toBe(3);
    expect(result.valid).toBe(3);
    expect(result.duplicates).toBe(1);
    expect(result.enriched).toBe(1);
    expect(result.fused).toBe(2);
  });
});

describe("IHEC · Vector Hyper Index", () => {
  it("elige el índice por latencia/precisión/carga", () => {
    const index = new VectorHyperIndex();
    expect(index.select({ latencyTargetMs: 3, accuracyTarget: 0.9 }).index).toBe("HNSW");
    expect(index.select({ latencyTargetMs: 100, accuracyTarget: 0.99 }).index).toBe("ScaNN");
    expect(index.select({ latencyTargetMs: 100, accuracyTarget: 0.5, load: 0.1 }).index).toBe("Annoy");
    expect(index.select({ latencyTargetMs: 100, accuracyTarget: 0.5, load: 0.9 }).index).toBe("FAISS");
  });
});

describe("IHEC · Hyper RAG", () => {
  it("puntúa y ordena candidatos híbridos", () => {
    const result = new HyperRagEngine().search("hola", [
      { id: "a", text: "hola mundo", vectorScore: 0.8 },
      { id: "b", text: "otra cosa" },
    ]);
    expect(result.hits[0]?.id).toBe("a");
    expect(result.hits[0]?.lexicalHit).toBe(true);
    expect(result.strategy).toBe("hybrid-weighted");
  });
});

describe("IHEC · Crisis Memory / Immune Mutation (Ω-14)", () => {
  it("archiva crisis append-only y genera guardas PENDING_REVIEW", () => {
    const memory = new CrisisMemoryEngine();
    memory.record(new Error("boom"), "hash-1", "FAILOVER");
    memory.record(new Error("boom2"), null, "OMEGA");
    expect(memory.all()).toHaveLength(2);
    expect(memory.all()[0]?.seq).toBe(0);
    expect(memory.all()[1]?.lesson).toContain("Incidente");

    const mutation = new ImmuneMutationEngine();
    const guard = mutation.generateGuard(new Error("x"), "critical");
    expect(guard.action).toBe("isolate_and_mutate");
    expect(guard.approvalStatus).toBe("PENDING_REVIEW");
    expect(mutation.all()).toHaveLength(1);
  });
});

describe("IHEC · Topology / Governance / Omega", () => {
  it("planifica reconfiguración y registra decisiones", () => {
    const plan = new SelfHealingTopologyEngine().reconfigure("fed-1");
    expect(plan.status).toBe("reconfigured");
    expect(plan.plan.length).toBeGreaterThan(0);

    const governance = new CognitiveGovernanceCore();
    const response = governance.degradedResponse({}, null, "KERNEL_FAIL");
    expect(response.status).toBe("degraded");
    expect(response.authorizationPerformed).toBe(false);
    expect(response.executionPerformed).toBe(false);
    expect(governance.trail()).toHaveLength(1);
  });

  it("activa Omega Mode y reconstruye", () => {
    const omega = new OmegaMode();
    omega.freeze();
    expect(omega.saveGlobalState()).toHaveLength(128);
    omega.quarantineCorrupted();
    omega.activateSecondaryRuntime();
    expect(omega.active()).toBe(true);
    const response = omega.rebuildAndRespond({});
    expect(response.status).toBe("omega");
    expect(response.authorizationPerformed).toBe(false);
  });
});
