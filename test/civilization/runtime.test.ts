import { describe, expect, it } from "vitest";
import {
  CIVILIZATION_METHOD_ID,
  runCivilizationCycle,
  type CivilizationDeps,
} from "../../src/civilization/runtime";
import type { TrafficBand, TrafficLightVerdict } from "../../src/governance/traffic-light";
import type { CompanionSafetyAction } from "../../src/companion/safety";
import type { VigiaDecision } from "../../src/security/vigia";
import type { KnowledgeClaim } from "../../src/memory/ikes";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";

const ROUTE: Record<TrafficBand, TrafficLightVerdict["route"]> = {
  GREEN: "FAST",
  YELLOW: "GROUNDED",
  ORANGE: "AGENT",
  RED: "HUMAN_REVIEW",
};

function verdict(band: TrafficBand): TrafficLightVerdict {
  return {
    version: "1.0.0",
    band,
    label: band,
    friction: "MINIMAL",
    riskTier: "LOW",
    category: "general",
    route: ROUTE[band],
    fastLane: band === "GREEN",
    requiredFilters: [],
    skippedFilters: [],
    cachePolicy: "NO_CACHE",
    humanReviewRequired: band === "RED",
    authorityPath: "FULL",
    reasons: [],
    digest: "d",
    methodId: "A.TWINS.E00_TURBO.classify_flow.v1.0.0.LOW.AUTONOMOUS",
    disclaimer: "x",
  } as unknown as TrafficLightVerdict;
}

const CLAIM: KnowledgeClaim = {
  claimId: "c1",
  subject: "TAMV",
  predicate: "es",
  object: "federación",
  sourceIds: [],
  evidenceIds: [],
  epistemicState: "E0_UNVERIFIED",
  temporalState: "current",
  provenance: {},
  contentHash: "h",
  version: 1,
};

function makeDeps(overrides: Partial<CivilizationDeps> = {}): CivilizationDeps {
  return {
    classifyFlow: () => verdict("GREEN"),
    assessCompanionSafety: () => ({ action: "ALLOW", findings: [], humanReviewRequired: false, rationale: "ok" }),
    assessVigia: () => ({ decision: "ALLOW", bloqueo: { ontological: false, semantic: false, behavioral: false }, score: 0, findings: [] }),
    retrieveKnowledge: () => [CLAIM],
    planExperts: () => ({ selected: [], parallelizable: false, authorityPath: "FULL" }),
    harden: () => ({
      findings: [],
      quarantineRequired: false,
      zeroWidthCount: 0,
      homoglyphCount: 0,
      highEntropyTokens: 0,
      luhnInvalidCards: 0,
      maskedContent: "",
    }),
    explainPolicy: (decision) => ({
      kind: "policy",
      decision,
      humanReadable: "x",
      factors: [],
      evidenceRefs: [],
      policyVersion: "test",
      generatedAt: new Date().toISOString(),
    }),
    evolutionControls: () => ({ controls: [], mode: "memory" }),
    publish: () => undefined,
    ...overrides,
  };
}

describe("ISABELLA Ω · CCR-1 — ciclo gobernado", () => {
  it("ejecuta los 9 pasos y nunca autoriza ni ejecuta", () => {
    const result = runCivilizationCycle(makeDeps(), { input: "¿qué es el TAMV?" });
    expect(result.methodId).toBe(CIVILIZATION_METHOD_ID);
    expect(result.authorityPath).toBe("FULL");
    expect(result.authorizationPerformed).toBe(false);
    expect(result.executionPerformed).toBe(false);
    expect(result.steps.map((s) => s.id)).toEqual([
      "sovereign-kernel",
      "memory-mesh",
      "knowledge-fabric",
      "reasoning-mesh",
      "policy-engine",
      "trust-engine",
      "reality-engine",
      "evolution-engine",
      "response-contract",
    ]);
    expect(result.response.authorityPath).toBe("FULL");
    expect(result.response.usedKnowledgeDomains).toContain("TAMV");
  });

  it("declara la simulación como NOT_WIRED (no la fabrica)", () => {
    const result = runCivilizationCycle(makeDeps(), { input: "simula el futuro" });
    expect(result.response.simulation).toBeNull();
    expect(result.steps.find((s) => s.id === "reality-engine")?.status).toBe("NOT_WIRED");
  });

  it("exige aprobación humana en la evolución", () => {
    const result = runCivilizationCycle(makeDeps(), { input: "evoluciona" });
    expect(result.response.evolution?.humanApprovalRequired).toBe(true);
  });

  it("marca ROJO como revisión humana y BLOCK como DENY", () => {
    const red = runCivilizationCycle(makeDeps({ classifyFlow: () => verdict("RED") }), { input: "borra todo" });
    expect(red.band).toBe("RED");
    expect(red.response.policy.decision).toBe("REVIEW");

    const blocked = runCivilizationCycle(
      makeDeps({
        assessCompanionSafety: () => ({
          action: "BLOCK" as CompanionSafetyAction,
          findings: [],
          humanReviewRequired: true,
          rationale: "grooming",
        }),
        assessVigia: () => ({ decision: "BLOCK" as VigiaDecision, bloqueo: { ontological: true, semantic: true, behavioral: true }, score: 1, findings: [] }),
      }),
      { input: "contenido bloqueado" },
    );
    expect(blocked.response.policy.decision).toBe("DENY");
    expect(blocked.admitted).toBe(false);
  });

  it("falla cerrado con entrada vacía", () => {
    expect(() => runCivilizationCycle(makeDeps(), { input: "   " })).toThrow(/CIVILIZATION_INPUT_REQUIRED/);
  });

  it("se integra con el runtime real (13 capas, 20 regalos)", () => {
    const runtime = new IsabellaGenesisRuntime();
    const result = runtime.runCivilizationCycle({ input: "gobierna esta consulta" });
    expect(result.response.bookpiHash).toHaveLength(64);
    expect(result.authorizationPerformed).toBe(false);
    const summary = runtime.civilizationSummary();
    expect(summary.layers).toBe(13);
    expect(summary.gifts).toBe(20);
    expect(runtime.capabilities.list().map((c) => c.id)).toContain("hsf.civilization.runtime");
  });
});
