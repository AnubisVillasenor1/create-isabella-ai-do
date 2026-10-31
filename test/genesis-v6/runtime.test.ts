import { describe, expect, it } from "vitest";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";
import { createCapabilityGate } from "../../src/crown/capability";
import { createPrincipal } from "../../src/identity/principal";

const METHOD = "A.TWINS.E15_MEMORY.recall.synthesize.v1.0.0.LOW.AUTONOMOUS";

describe("genesis/runtime", () => {
  it("composes AEGIS, CROWN, planning and memory without bypassing authority", () => {
    const runtime = new IsabellaGenesisRuntime();
    const principal = createPrincipal({ id: "h1", kind: "human", roles: ["operator"] });
    const gate = createCapabilityGate([{
      methodId: METHOD,
      owner: "isabella",
      allowedRoles: ["operator"],
      riskTier: "LOW",
      governanceTier: "AUTONOMOUS",
      humanApprovalRequired: false,
    }]);

    const decision = runtime.evaluate({
      input: "hola, recupera la memoria",
      methodId: METHOD,
      principal,
      gate,
      action: "memory:recall",
      resource: "memory",
      inputTokens: 10,
      expectedOutputTokens: 20,
      pressure: 0.2,
      riskTier: "LOW",
      requiresTools: false,
      requiresMemory: true,
      memoryQuery: "TAMV",
    });

    expect(decision.admitted).toBe(true);
    expect(decision.plan.authorityPath).toBe("FULL");
  });
});
