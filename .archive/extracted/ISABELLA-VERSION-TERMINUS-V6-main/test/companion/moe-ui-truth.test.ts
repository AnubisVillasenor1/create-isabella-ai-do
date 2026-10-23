import { describe, expect, it } from "vitest";
import { classifyUiRouterLabel, assertRouterLabelHonest } from "../../src/companion/moe-ui-truth";
import { ROUTER_CLASSIFICATION } from "../../src/cognition/moe/contract";

describe("moe-ui-truth (ISA-451)", () => {
  it("nevers labels the heuristic router as MoE/DeepSeek", () => {
    const heuristic = ROUTER_CLASSIFICATION.adaptiveRouter;
    expect(heuristic.family).toBe("HEURISTIC_LEXICAL");
    expect(heuristic.satisfiesMoeContract).toBe(false);

    const verdict = classifyUiRouterLabel("HEURISTIC_LEXICAL", "Rutas cognitivas con router MoE DeepSeek-V3");
    expect(verdict.verdict).toBe("MISLABELED");
    expect(verdict.reason).toContain("no satisface el contrato MoE");
  });

  it("allows a MoE label only for the sovereign contract family", () => {
    expect(ROUTER_CLASSIFICATION.moeRouter.family).toBe("MOE_SOVEREIGN");
    expect(ROUTER_CLASSIFICATION.moeRouter.satisfiesMoeContract).toBe(true);

    const honest = classifyUiRouterLabel("MOE_SOVEREIGN", "Router MoE soberano (contrato verificado)");
    expect(honest.verdict).toBe("HONEST_LABEL");
  });

  it("asserts honest labels and throws on dishonesty", () => {
    expect(() => assertRouterLabelHonest("MOE_SOVEREIGN", "especialistas con gate")).not.toThrow();
    expect(() => assertRouterLabelHonest("HEURISTIC_LEXICAL", "top-k de expertos")).toThrow(/UI_TRUTH/);
  });
});