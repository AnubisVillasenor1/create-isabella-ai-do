import { describe, expect, it } from "vitest";
import { buildProposal } from "../../src/orion/proposal";
import { runSandbox } from "../../src/orion/sandbox";
import { generateControls } from "../../src/evolution/catalog";
import { issueHumanApproval } from "../../src/identity/approval";
import { createPrincipal } from "../../src/identity/principal";

const SNAPSHOT = generateControls().filter((c) => c.domain === "durable_memory").slice(0, 40);

function baseProposal(overrides: Record<string, unknown> = {}) {
  return buildProposal({
    methodId: "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS",
    domain: "durable_memory",
    plane: "CONTEXT_AND_MEMORY",
    target: "recall",
    changeBlocks: ["ajuste de ventana semántica"],
    riskTier: "LOW",
    governanceTier: "AUTONOMOUS",
    ...overrides,
  });
}

describe("orion/proposal", () => {
  it("construye propuestas con id y timestamp", () => {
    const p = baseProposal();
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.proposedAt).toBeTruthy();
    expect(p.riskTier).toBe("LOW");
  });

  it("rechaza propuestas sin bloques de cambio", () => {
    expect(() => baseProposal({ changeBlocks: [] })).toThrow(/bloque de cambio/);
  });
});

describe("orion/sandbox", () => {
  it("representa propuestas de riesgo bajo contra la instantánea", () => {
    const r = runSandbox(baseProposal(), { controlsSnapshot: SNAPSHOT });
    expect(r.passed).toBe(true);
    expect(r.controlsTouched).toBeGreaterThan(0);
    expect(r.replayedIds.length).toBeGreaterThan(0);
  });

  it("reprime riesgos MEDIUM+ sin aprobación humana", () => {
    const p = baseProposal({ riskTier: "HIGH", governanceTier: "TERRITORIAL" });
    expect(runSandbox(p, { controlsSnapshot: SNAPSHOT }).passed).toBe(false);
  });

  it("permite riesgos MEDIUM+ con aprobación humana", () => {
    const p = baseProposal({ riskTier: "HIGH", governanceTier: "TERRITORIAL" });
    const human = createPrincipal({ id: "h1", kind: "human", roles: ["admin"] });
    const approval = issueHumanApproval(human, { methodId: p.methodId, action: "recall" }, "ALLOW");
    expect(runSandbox(p, { controlsSnapshot: SNAPSHOT, approval }).passed).toBe(true);
  });

  it("falla si la propuesta no toca controles", () => {
    const p = buildProposal({
      methodId: "T.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS",
      domain: "turismo-no-existe",
      plane: "fantasma",
      target: "recall",
      changeBlocks: ["x"],
      riskTier: "LOW",
      governanceTier: "AUTONOMOUS",
    });
    const r = runSandbox(p, { controlsSnapshot: SNAPSHOT });
    expect(r.passed).toBe(false);
    expect(r.controlsTouched).toBe(0);
  });
});