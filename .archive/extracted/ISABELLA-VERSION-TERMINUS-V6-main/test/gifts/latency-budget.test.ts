import { describe, expect, it } from "vitest";
import { planTurboRoute, type TurboRequest } from "../../src/intelligence/turbo-planner";
import { planLatencyBudget } from "../../src/gifts/latency-budget";

const request: TurboRequest = {
  intent: "resume el documento",
  inputTokens: 120,
  riskTier: "LOW",
  principalId: "user-1",
};

describe("Regalo 2 — Presupuesto de Latencia", () => {
  it("admite filtros opcionales que caben en el plazo", () => {
    const plan = planTurboRoute(request);
    const budget = planLatencyBudget({ plan, budgetMs: 200, optionalFilters: ["GROUNDING"] });
    expect(budget.withinBudget).toBe(true);
    expect(budget.runFilters).toContain("GROUNDING");
    expect(budget.deferredOptionalFilters).toHaveLength(0);
  });

  it("difiere opcionales y marca degradado si el plazo no alcanza, sin saltar obligatorios", () => {
    const plan = planTurboRoute(request);
    const budget = planLatencyBudget({ plan, budgetMs: 5, optionalFilters: ["GROUNDING"] });
    expect(budget.degraded).toBe(true);
    expect(budget.runFilters).toEqual(plan.requiredFilters);
    expect(budget.mandatoryFilters).toContain("AEGIS");
    expect(budget.deferredOptionalFilters).toContain("GROUNDING");
    expect(budget.overrunMs).toBeGreaterThan(0);
  });

  it("rechaza presupuestos inválidos", () => {
    const plan = planTurboRoute(request);
    expect(() => planLatencyBudget({ plan, budgetMs: 0 })).toThrow();
  });
});
