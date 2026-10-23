import { describe, expect, it } from "vitest";
import {
  TURBO_FILTERS,
  TURBO_PLANNER_METHOD_ID,
  TURBO_PLANNER_VERSION,
  planTurboRoute,
  routeRequiresFilter,
  type TurboRequest,
} from "../../src/intelligence/turbo-planner";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";
import type { MagpieEvent } from "../../src/messaging";

const base: TurboRequest = {
  intent: "resume la política de privacidad",
  inputTokens: 200,
  riskTier: "LOW",
  principalId: "user-1",
};

describe("Turbo Route Planner Ω", () => {
  it("routes a trivial, low-risk request to FAST and skips heavy filters", () => {
    const plan = planTurboRoute(base);
    expect(plan.version).toBe(TURBO_PLANNER_VERSION);
    expect(plan.route).toBe("FAST");
    expect(plan.methodId).toBe(TURBO_PLANNER_METHOD_ID);
    expect(plan.requiredFilters).toEqual(["AEGIS", "CROWN", "SANITIZATION"]);
    expect(plan.skippedFilters).toContain("GROUNDING");
    expect(plan.skippedFilters).toContain("PERMISSION_MAP");
    expect(routeRequiresFilter(plan, "AEGIS")).toBe(true);
    expect(routeRequiresFilter(plan, "GROUNDING")).toBe(false);
    expect(plan.authorityPath).toBe("FULL");
    expect(plan.humanReviewRequired).toBe(false);
  });

  it("routes a standard/memory request to GROUNDED and requires the grounding filter", () => {
    const plan = planTurboRoute({ ...base, requiresMemory: true });
    expect(plan.route).toBe("GROUNDED");
    expect(plan.requiredFilters).toContain("GROUNDING");
    expect(plan.skippedFilters).toContain("CONTRADICTION");
  });

  it("routes a toolled or deep request to AGENT and requires the full governed set", () => {
    const plan = planTurboRoute({ ...base, requiresTools: true });
    expect(plan.route).toBe("AGENT");
    expect(plan.requiredFilters).toEqual([...TURBO_FILTERS]);
    expect(plan.skippedFilters).toEqual([]);
  });

  it("fails closed to HUMAN_REVIEW on critical risk or a high-impact trigger", () => {
    const critical = planTurboRoute({ ...base, riskTier: "CRITICAL" });
    expect(critical.route).toBe("HUMAN_REVIEW");
    expect(critical.humanReviewRequired).toBe(true);
    expect(critical.cachePolicy).toBe("NONE");
    expect(critical.requiredFilters).toEqual([...TURBO_FILTERS]);

    const highImpact = planTurboRoute({ ...base, highImpactTriggers: ["sensitive_data"] });
    expect(highImpact.route).toBe("HUMAN_REVIEW");
    expect(highImpact.highImpactTriggered).toBe(true);
  });

  it("disables cache reuse without a federated scope (fail-closed)", () => {
    expect(planTurboRoute(base).cachePolicy).toBe("NONE");
    expect(planTurboRoute({ ...base, federationId: 3 }).cachePolicy).toBe("SEMANTIC");
  });

  it("never reuses the cache for high risk", () => {
    const plan = planTurboRoute({ ...base, riskTier: "HIGH", federationId: 3 });
    expect(plan.route).toBe("AGENT");
    expect(plan.cachePolicy).toBe("NONE");
  });

  it("produces a deterministic digest", () => {
    expect(planTurboRoute(base).digest).toBe(planTurboRoute(base).digest);
    expect(planTurboRoute(base).digest).toMatch(/^[0-9a-f]{64}$/);
    expect(planTurboRoute(base).digest).not.toBe(planTurboRoute({ ...base, inputTokens: 999 }).digest);
  });

  it("fails closed on malformed input", () => {
    expect(() => planTurboRoute({ ...base, intent: "  " })).toThrow(/TURBO_INTENT_REQUIRED/);
    expect(() => planTurboRoute({ ...base, inputTokens: -1 })).toThrow(/TURBO_INPUT_TOKENS_INVALID/);
    expect(() => planTurboRoute({ ...base, pressure: 2 })).toThrow(/TURBO_PRESSURE_INVALID/);
    expect(() => planTurboRoute({ ...base, federationId: 9 })).toThrow(/TURBO_FEDERATION_INVALID/);
    expect(() => planTurboRoute({ ...base, principalId: "" })).toThrow(/TURBO_PRINCIPAL_REQUIRED/);
  });

  it("is wired into the runtime and emits a governed event", () => {
    const runtime = new IsabellaGenesisRuntime();
    expect(runtime.capabilities.list().map((c) => c.id)).toContain("hsf.intelligence.turbo-planner");

    const seen: MagpieEvent[] = [];
    runtime.subscribeEvent("intelligence.turbo.planned", (event) => seen.push(event));

    const plan = runtime.planTurboRoute({ ...base, requiresTools: true, federationId: 2 });
    expect(plan.route).toBe("AGENT");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.topic).toBe("intelligence.turbo.planned");
    expect(seen[0]?.type).toBe("AGENT");
  });
});
