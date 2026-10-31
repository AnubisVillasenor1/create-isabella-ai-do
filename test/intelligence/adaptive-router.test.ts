import { describe, expect, it } from "vitest";
import { planExecution, type AdaptiveRequest } from "../../src/intelligence";

function request(overrides: Partial<AdaptiveRequest> = {}): AdaptiveRequest {
  return {
    inputTokens: 100,
    expectedOutputTokens: 100,
    pressure: 0.1,
    riskTier: "LOW",
    requiresTools: false,
    requiresMemory: false,
    ...overrides,
  };
}

describe("intelligence/adaptive-router", () => {
  it("clasifica como TRIVIAL las solicitudes pequeñas sin herramientas ni memoria", () => {
    const plan = planExecution(request());
    expect(plan.complexity).toBe("TRIVIAL");
    expect(plan.cachePolicy).toBe("PREFIX");
    expect(plan.parallelBranches).toBe(1);
  });

  it("escala a STANDARD con memoria y a DEEP con herramientas", () => {
    expect(planExecution(request({ requiresMemory: true })).complexity).toBe("STANDARD");
    expect(planExecution(request({ requiresTools: true })).complexity).toBe("DEEP");
    expect(planExecution(request({ inputTokens: 5000, expectedOutputTokens: 5000 })).complexity).toBe("DEEP");
  });

  it("marca CRITICAL y suprime la aceleración cuando el riesgo es crítico", () => {
    const plan = planExecution(request({ riskTier: "CRITICAL", pressure: 0.95 }));
    expect(plan.complexity).toBe("CRITICAL");
    expect(plan.parallelBranches).toBe(1);
    expect(plan.draftTokens).toBe(0);
    expect(plan.verifierFanout).toBe(1);
    expect(plan.authorityPath).toBe("FULL");
  });

  it("activa HYPERBOOST bajo presión alta y riesgo no crítico", () => {
    const plan = planExecution(request({ pressure: 0.95, inputTokens: 5000, expectedOutputTokens: 5000 }));
    expect(plan.hypercore.mode).toBe("HYPERBOOST");
    expect(plan.parallelBranches).toBe(4);
    expect(plan.draftTokens).toBe(96);
    expect(plan.verifierFanout).toBe(3);
    expect(plan.cachePolicy).toBe("PREFIX+SEMANTIC");
  });

  it("el early exit sólo se permite bajo el riesgo máximo configurado", () => {
    const low = planExecution(request({ pressure: 0.95, riskTier: "LOW" }));
    const critical = planExecution(request({ pressure: 0.95, riskTier: "CRITICAL" }));
    expect(low.hypercore.activations).toContain("EARLY_EXIT");
    expect(critical.hypercore.activations).not.toContain("EARLY_EXIT");
  });
});
