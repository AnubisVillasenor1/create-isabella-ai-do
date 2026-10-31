import { describe, expect, it } from "vitest";
import { compileContext } from "../../src/hypercore/context-compiler";
import type { HyperCoreTask } from "../../src/hypercore/types";

const task: HyperCoreTask = {
  taskId: "ctx-1",
  intent: "generate api endpoint",
  domain: "code",
  risk: "low",
  prompt: 'Create an "Invoice" endpoint. Do not expose card data. Return JSON.',
  contextTokens: 800,
};

describe("HyperCore Context Compiler", () => {
  it("extracts entities, objectives and constraints deterministically", () => {
    const first = compileContext(task);
    const second = compileContext(task);
    expect(first.entities).toEqual(second.entities);
    expect(first.entities).toContain("Invoice");
    expect(first.constraints.some((clause) => clause.toLowerCase().includes("do not"))).toBe(true);
    expect(first.objectives.length).toBeGreaterThan(0);
  });

  it("reports a bounded compression ratio", () => {
    const state = compileContext(task);
    expect(state.compressionRatio).toBeGreaterThanOrEqual(0);
    expect(state.compressionRatio).toBeLessThanOrEqual(1);
    expect(state.compiledTokens).toBeLessThanOrEqual(state.originalTokens);
  });

  it("propagates the policy version and carries injected memory", () => {
    const state = compileContext(task, ["prior session"], { policyVersion: "CROWN-v20" });
    expect(state.policyVersion).toBe("CROWN-v20");
    expect(state.memory).toEqual(["prior session"]);
  });

  it("reports zero compression when the original token count is unknown", () => {
    const state = compileContext({ ...task, contextTokens: 0 });
    expect(state.compressionRatio).toBe(0);
    expect(state.compiledTokens).toBeGreaterThan(0);
  });
});
