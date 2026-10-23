import { describe, expect, it } from "vitest";
import {
  FALLBACK_EXPERT,
  ROUTER_CLASSIFICATION,
  SHA256_HEX_RE,
  assertArtifactCompatible,
  createExpertRegistry,
  declareExpertArtifact,
  demoExpertRegistry,
  isCompatibleVersion,
  parseSemVer,
  satisfiesMoeContract,
  type ExpertArtifact,
} from "../../src/cognition/moe/contract";
import {
  computeLoadBalancingLoss,
  computeLogits,
  createGateParams,
  dispatchBatch,
  gateParamsDigest,
  isMoeGateDecision,
  softmax,
  topKIndices,
  type GateOptions,
  type MoeGateDecision,
} from "../../src/cognition/moe/router";
import { DISPATCH_AUTHORITY_FIELDS, dispatch, expertPlanForDispatched } from "../../src/cognition/moe/dispatch";
import { combine } from "../../src/cognition/moe/combine";
import { replayDigest } from "../../src/cognition/moe/hash";
import { planExecution } from "../../src/intelligence/adaptive-router";
import { synthesize } from "../../src/cognition/orchestrator";
import * as cognitionBarrel from "../../src/cognition";

const registry = demoExpertRegistry();
const expertIds = registry.list().map((entry) => entry.artifact.id);
const params = createGateParams([
  [2, 0],
  [0, 0],
  [1, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
]);
const opts: GateOptions = { expertIds, topK: 2, capacityPerExpert: 5, fallbackExpert: FALLBACK_EXPERT };
const features = [1, 0];

function decideOne(input: readonly number[]): MoeGateDecision {
  const first = dispatchBatch([{ tokenId: "t", features: input }], params, opts)[0];
  if (!first) throw new Error("fixture: sin decisión");
  return first.decision;
}

function syntheticDecision(selected: readonly string[], probabilities: readonly number[]): MoeGateDecision {
  return {
    routing: "experts",
    tokenId: "synthetic",
    expertIds: ["A", "B"],
    topK: 1,
    capacity: 10,
    logits: probabilities,
    weights: probabilities,
    contributions: selected.map((id) => ({
      expertId: id,
      weight: id === "A" ? probabilities[0] ?? 0 : probabilities[1] ?? 0,
    })),
    selectedExpertIds: selected,
    overflow: [],
    fallbackReason: undefined,
  };
}

describe("ISA-001 contrato MoE explícito", () => {
  it("expertRegistry expone hash, versión, dataset y licencia por experto", () => {
    const list = registry.list();
    expect(list.length).toBe(7);
    const ids = new Set<string>();
    for (const entry of list) {
      expect(entry.artifact.hash).toMatch(SHA256_HEX_RE);
      expect(entry.artifact.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.artifact.dataset.length).toBeGreaterThan(0);
      expect(entry.artifact.license.length).toBeGreaterThan(0);
      ids.add(entry.artifact.id);
    }
    expect(ids.size).toBe(list.length);
  });

  it("router/gating expone topK y capacity; dispatch, combine y fallback existen", () => {
    const decision = decideOne(features);
    expect(decision.topK).toBe(2);
    expect(decision.capacity).toBe(5);
    expect(typeof dispatch).toBe("function");
    expect(typeof combine).toBe("function");
    expect(FALLBACK_EXPERT).toBe("MOE_GOVERNED_FALLBACK");
  });
});

describe("ISA-002 separación router heurístico / MoE", () => {
  it("adaptive-router no satisface el contrato MoE", () => {
    const plan = planExecution({
      inputTokens: 10,
      expectedOutputTokens: 10,
      pressure: 0.5,
      riskTier: "LOW",
      requiresTools: false,
      requiresMemory: false,
    });
    expect(satisfiesMoeContract(ROUTER_CLASSIFICATION.adaptiveRouter.family)).toBe(false);
    expect(ROUTER_CLASSIFICATION.adaptiveRouter.satisfiesMoeContract).toBe(false);
    expect(ROUTER_CLASSIFICATION.moeRouter.satisfiesMoeContract).toBe(true);
    expect(isMoeGateDecision(plan)).toBe(false);
  });

  it("el gate MoE sí satisface el guard estructural", () => {
    expect(isMoeGateDecision(decideOne(features))).toBe(true);
  });
});

describe("ISA-003 gating aprendible (logits + softmax + top-k)", () => {
  it("logits = W·x, softmax normaliza y top-k elige por logit", () => {
    const logits = computeLogits(params, features);
    expect([...logits]).toEqual([2, 0, 1, 0, 0, 0, 0]);
    const weights = softmax(logits);
    expect(weights.reduce((acc, value) => acc + value, 0)).toBeCloseTo(1, 12);
    for (const value of weights) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(weights[0] ?? 0).toBeGreaterThan(weights[2] ?? 0);
    expect(weights[2] ?? 0).toBeGreaterThan(weights[1] ?? 0);
    expect([...topKIndices(logits, 3)]).toEqual([0, 2, 1]);
  });

  it("parametrizable: cambiar los pesos cambia el routing", () => {
    const alt = createGateParams([
      [0, 0],
      [0, 0],
      [0, 0],
      [5, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    const base = decideOne(features);
    const changedFirst = dispatchBatch([{ tokenId: "t", features }], alt, opts)[0];
    if (!changedFirst) throw new Error("fixture: sin decisión");
    expect(base.selectedExpertIds[0]).toBe("E01_SECURITY");
    expect(changedFirst.decision.selectedExpertIds[0]).toBe("E18_PLANNING");
  });

  it("softmax y top-k son deterministas", () => {
    expect(softmax(computeLogits(params, features))).toEqual(softmax(computeLogits(params, features)));
    expect(gateParamsDigest(params)).toBe(gateParamsDigest(params));
  });
});

describe("ISA-004 artefactos independientes por experto", () => {
  it("cada experto tiene un artefacto con hash, versión, dataset y licencia propios", () => {
    const list = registry.list();
    const hashes = new Set(list.map((entry) => entry.artifact.hash));
    expect(hashes.size).toBe(list.length);
    for (const entry of list) {
      expect(Object.isFrozen(entry.artifact)).toBe(true);
      expect(entry.artifact.dataset.length).toBeGreaterThan(0);
    }
    expect(registry.get("E01_SECURITY")?.artifact.dataset).toBe("genesis-governance-v1");
  });
});

describe("ISA-005 dispatch top-k", () => {
  it("envía cada token solo a los expertos seleccionados, no a todos", () => {
    const decision = decideOne(features);
    expect(decision.routing).toBe("experts");
    expect(decision.selectedExpertIds.length).toBe(2);
    const result = dispatch(decision, registry);
    expect(result.executedExpertIds.length).toBe(2);
    for (const id of result.executedExpertIds) {
      expect(decision.selectedExpertIds.includes(id)).toBe(true);
    }
    expect(result.executedExpertIds.length).toBeLessThan(registry.list().length);
  });
});

describe("ISA-006 combine ponderado", () => {
  it("suma salidas ponderadas por los pesos del gate y conserva trazabilidad", () => {
    const decision = decideOne(features);
    const c0 = decision.contributions[0];
    const c1 = decision.contributions[1];
    if (!c0 || !c1) throw new Error("fixture: contribuciones insuficientes");
    const outputs = [
      { expertId: c0.expertId, weight: c0.weight, contribution: [2, 0] },
      { expertId: c1.expertId, weight: c1.weight, contribution: [0, 4] },
    ];
    const result = combine(decision, outputs);
    expect(result.routing).toBe("experts");
    expect(result.usedFallback).toBe(false);
    expect(result.vector[0]).toBeCloseTo(2 * c0.weight, 12);
    expect(result.vector[1]).toBeCloseTo(4 * c1.weight, 12);
    expect(result.contributions.length).toBe(2);
    expect(result.contributions.map((entry) => entry.expertId)).toEqual([c0.expertId, c1.expertId]);
    expect(combine(decision, outputs)).toEqual(result);
  });

  it("rechaza salidas de expertos no planificados", () => {
    const decision = decideOne(features);
    expect(() => combine(decision, [{ expertId: "E99_X", weight: 0.5, contribution: [1] }])).toThrow(/no planificado/);
  });
});

describe("ISA-007 capacity y overflow determinista", () => {
  const ids3 = ["E01_SECURITY", "E07_ECONOMY", "E11_VERITAS"];
  const params3 = createGateParams([
    [2, 0],
    [0, 0],
    [1, 0],
  ]);
  const opts3: GateOptions = { expertIds: ids3, topK: 2, capacityPerExpert: 1, fallbackExpert: FALLBACK_EXPERT };
  const inputs3 = [0, 1, 2].map((i) => ({ tokenId: `t${i}`, features: [1, 0] }));

  it("limita capacidad por experto y registra overflow determinista", () => {
    const batch = dispatchBatch(inputs3, params3, opts3);
    expect(batch[0]?.decision.selectedExpertIds).toEqual(["E01_SECURITY", "E11_VERITAS"]);
    expect(batch[1]?.decision.selectedExpertIds).toEqual(["E07_ECONOMY"]);
    expect(batch[2]?.decision.routing).toBe("fallback");
    const report = computeLoadBalancingLoss(batch.map((entry) => entry.decision), ids3.length);
    expect(report.counts.every((count) => count <= 1)).toBe(true);
    expect(dispatchBatch(inputs3, params3, opts3)).toEqual(batch);
  });
});

describe("ISA-008 overflow seguro hacia fallback gobernado", () => {
  const ids3 = ["E01_SECURITY", "E07_ECONOMY", "E11_VERITAS"];
  const params3 = createGateParams([
    [2, 0],
    [0, 0],
    [1, 0],
  ]);
  const opts3: GateOptions = { expertIds: ids3, topK: 2, capacityPerExpert: 1, fallbackExpert: FALLBACK_EXPERT };
  const inputs3 = [0, 1, 2].map((i) => ({ tokenId: `t${i}`, features: [1, 0] }));

  it("no se pierde auditoría: el overflow se registra y cae al fallback", () => {
    const batch = dispatchBatch(inputs3, params3, opts3);
    const last = batch[2];
    if (!last) throw new Error("fixture: sin decisión");
    expect(last.decision.routing).toBe("fallback");
    expect(last.decision.fallbackReason).toBe("NO_EXPERT_CAPACITY_AVAILABLE");
    expect(last.decision.overflow.length).toBeGreaterThan(0);
    expect(last.decision.selectedExpertIds).toEqual([FALLBACK_EXPERT]);
    expect(dispatch(last.decision, registry).usedFallback).toBe(true);
    const fallbackResult = combine(last.decision, [
      { expertId: FALLBACK_EXPERT, weight: 1, contribution: [7, 7] },
    ]);
    expect(fallbackResult.usedFallback).toBe(true);
    expect([...fallbackResult.vector]).toEqual([7, 7]);
  });
});

describe("ISA-009 balance de carga", () => {
  it("balance perfecto ⇒ loss 1; concentración ⇒ loss > 1", () => {
    const balanced = computeLoadBalancingLoss(
      [syntheticDecision(["A"], [0.5, 0.5]), syntheticDecision(["B"], [0.5, 0.5])],
      2,
    );
    expect(balanced.loss).toBeCloseTo(1, 12);
    expect([...balanced.counts]).toEqual([1, 1]);
    const concentrated = computeLoadBalancingLoss(
      [syntheticDecision(["A"], [0.9, 0.1]), syntheticDecision(["A"], [0.9, 0.1])],
      2,
    );
    expect(concentrated.loss).toBeCloseTo(1.8, 12);
    expect(concentrated.loss).toBeGreaterThan(1);
  });
});

describe("ISA-011 evitar expertos fantasma", () => {
  it("anunciar un experto sin artefacto falla; marcado no operativo pasa", () => {
    expect(() => registry.assertsNoGhosts(["E01_SECURITY"])).not.toThrow();
    expect(() => registry.assertsNoGhosts(["E99_FANTASMA"])).toThrow(/fantasma/);
    const marked = createExpertRegistry([
      declareExpertArtifact({
        id: "E20_SELF_CRITIQUE",
        version: "1.0.0",
        dataset: "genesis-critique-v1",
        license: "CC-BY-4.0",
        payload: "E20_SELF_CRITIQUE:critique:spec:v1",
        status: "NON_OPERATIONAL",
      }),
    ]);
    expect(() => marked.assertsNoGhosts(["E20_SELF_CRITIQUE"])).not.toThrow();
    expect(marked.isOperational("E20_SELF_CRITIQUE")).toBe(false);
    expect(() => marked.open("E20_SELF_CRITIQUE", "dev")).toThrow(/NO_OPERATIONAL/);
  });

  it("dispatch bloquea expertos fantasma sin ejecutarlos", () => {
    const ghostDecision: MoeGateDecision = {
      routing: "experts",
      tokenId: "ghost",
      expertIds: ["E99_GHOST"],
      topK: 1,
      capacity: 1,
      logits: [0],
      weights: [1],
      contributions: [{ expertId: "E99_GHOST", weight: 1 }],
      selectedExpertIds: ["E99_GHOST"],
      overflow: [],
      fallbackReason: undefined,
    };
    const result = dispatch(ghostDecision, registry);
    expect([...result.executedExpertIds]).toEqual([]);
    expect(result.blocked[0]?.reason).toBe("GHOST_PREVENTED");
    expect(result.usedFallback).toBe(true);
  });
});

describe("ISA-012 versionado semántico y compatibilidad", () => {
  it("valida compatibilidad de versión y contrato del artefacto", () => {
    expect(isCompatibleVersion("1.2.0", "1.0.0")).toBe(true);
    expect(isCompatibleVersion("1.2.3", "1.2.3")).toBe(true);
    expect(isCompatibleVersion("1.0.0", "1.1.0")).toBe(false);
    expect(isCompatibleVersion("2.0.0", "1.0.0")).toBe(false);
    expect(() => parseSemVer("1.2")).toThrow();
    const artifact = declareExpertArtifact({
      id: "E01_SECURITY",
      version: "1.0.0",
      dataset: "genesis-governance-v1",
      license: "CC-BY-4.0",
      payload: "E01_SECURITY:security:spec:v1",
    });
    expect(() => assertArtifactCompatible(artifact, 1, "1.0.0")).not.toThrow();
    expect(() => assertArtifactCompatible(artifact, 2, "1.0.0")).toThrow(/incompatible/);
    expect(() => assertArtifactCompatible(artifact, 1, "1.1.0")).toThrow(/por debajo/);
  });
});

describe("ISA-013 hash/firma antes de cargar el experto", () => {
  it("staging/production exigen hash verificado; dev es permisivo", () => {
    const base = declareExpertArtifact({
      id: "E01_SECURITY",
      version: "1.0.0",
      dataset: "genesis-governance-v1",
      license: "CC-BY-4.0",
      payload: "original",
    });
    const tampered: ExpertArtifact = { ...base, payload: "tampered" };
    const tamperedRegistry = createExpertRegistry([tampered]);
    expect(() => tamperedRegistry.open("E01_SECURITY", "dev")).not.toThrow();
    expect(() => tamperedRegistry.open("E01_SECURITY", "staging")).toThrow(/hash/);
    expect(() => tamperedRegistry.open("E01_SECURITY", "production")).toThrow(/hash/);
    expect(() => registry.open("E01_SECURITY", "production")).not.toThrow();
  });
});

describe("ISA-016 frontera estructural de autoridad", () => {
  it("el gate y el dispatch no transportan permisos ni herramientas", () => {
    const decision = decideOne(features);
    const result = dispatch(decision, registry);
    for (const field of DISPATCH_AUTHORITY_FIELDS) {
      expect(field in result).toBe(false);
      expect(field in decision).toBe(false);
    }
  });
});

describe("ISA-018 capacidades multimodales sin fingir soporte", () => {
  it("un experto text-only no se enruta para image", () => {
    const decision = decideOne(features);
    const imageDispatch = dispatch(decision, registry, "image");
    expect(imageDispatch.executedExpertIds.length).toBe(0);
    expect(imageDispatch.blocked.every((entry) => entry.reason === "MODALITY_UNSUPPORTED")).toBe(true);
    expect(imageDispatch.usedFallback).toBe(true);
    expect(dispatch(decision, registry, "text").executedExpertIds.length).toBe(2);
  });
});

describe("ISA-020 replay determinista", () => {
  it("mismo gate/versión/artefactos ⇒ mismo digest y misma decisión", () => {
    const context = {
      gateDigest: gateParamsDigest(params),
      topK: 2,
      capacity: 5,
      artifacts: registry.list().map((entry) => ({
        id: entry.artifact.id,
        version: entry.artifact.version,
        hash: entry.artifact.hash,
      })),
    };
    expect(replayDigest(context)).toBe(replayDigest(context));
    const changedVersion = {
      ...context,
      artifacts: context.artifacts.map((entry, i) => (i === 0 ? { ...entry, version: "9.9.9" } : entry)),
    };
    const changedCapacity = { ...context, capacity: 6 };
    expect(replayDigest(changedVersion)).not.toBe(replayDigest(context));
    expect(replayDigest(changedCapacity)).not.toBe(replayDigest(context));
    const inputs = [
      { tokenId: "a", features: [1, 0] },
      { tokenId: "b", features: [0, 0] },
    ];
    expect(dispatchBatch(inputs, params, opts)).toEqual(dispatchBatch(inputs, params, opts));
  });
});

describe("coherencia con el orquestador cognitivo existente", () => {
  it("los expertos despachados alimentan synthesize sin romperlo", () => {
    const decision = decideOne(features);
    const result = dispatch(decision, registry);
    const plan = expertPlanForDispatched(result.executedExpertIds);
    expect(plan.selected.length).toBe(result.executedExpertIds.length);
    const synthesis = synthesize(
      { taskId: "moe-1", input: "in", requiredExperts: result.executedExpertIds, risk: "LOW" },
      plan,
      result.executedExpertIds.map((id) => ({ expertId: id, status: "OK", summary: "ok", evidenceRefs: [] })),
    );
    expect(synthesis.status).toBe("READY");
    expect(synthesis.authorityPath).toBe("FULL");
  });

  it("el fallback gobernado no pertenece al catálogo cognitivo", () => {
    expect(() => expertPlanForDispatched([FALLBACK_EXPERT])).toThrow(/catálogo/);
  });
});

describe("barrel de cognition", () => {
  it("re-exporta las API MoE", () => {
    expect(typeof cognitionBarrel.dispatchBatch).toBe("function");
    expect(typeof cognitionBarrel.combine).toBe("function");
    expect(typeof cognitionBarrel.demoExpertRegistry).toBe("function");
  });
});