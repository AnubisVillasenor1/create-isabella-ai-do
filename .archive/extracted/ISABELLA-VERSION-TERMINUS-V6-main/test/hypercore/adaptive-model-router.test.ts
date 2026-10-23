import { describe, expect, it } from "vitest";
import { routeExperts } from "../../src/hypercore/adaptive-model-router";
import { compileContext } from "../../src/hypercore/context-compiler";
import { createDefaultExperts } from "../../src/hypercore/micro-moe";
import { DEFAULT_ROUTER_POLICY, type HyperCoreTask } from "../../src/hypercore/types";

function stateFor(task: HyperCoreTask) {
  return compileContext(task, [], { policyVersion: "CROWN-v20" });
}

describe("HyperCore Adaptive Model Router", () => {
  it("selects at most topK experts", () => {
    const task: HyperCoreTask = {
      taskId: "r-1",
      intent: "generate api endpoint",
      domain: "code",
      risk: "low",
      prompt: "Generate an API endpoint with validation.",
      contextTokens: 300,
    };
    const selected = routeExperts(createDefaultExperts(), stateFor(task));
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(DEFAULT_ROUTER_POLICY.topK);
  });

  it("always returns at least one expert even for unknown domains", () => {
    const task: HyperCoreTask = {
      taskId: "r-2",
      intent: "zzz",
      domain: "unknown-domain",
      risk: "low",
      prompt: "qqq wwv",
      contextTokens: 10,
    };
    const selected = routeExperts(createDefaultExperts(), stateFor(task));
    expect(selected.length).toBe(1);
  });

  it("returns no experts for an empty registry", () => {
    const task: HyperCoreTask = {
      taskId: "r-3",
      intent: "generate api endpoint",
      domain: "code",
      risk: "low",
      prompt: "Generate.",
      contextTokens: 10,
    };
    expect(routeExperts([], stateFor(task))).toEqual([]);
  });
});
