import { describe, expect, it } from "vitest";
import { createGovernedSemanticCache } from "../../src/hypercore/governed-semantic-cache";
import type { HyperCoreTask, VerifiedResponse } from "../../src/hypercore/types";

const task: HyperCoreTask = {
  taskId: "cache-1",
  intent: "generate api endpoint",
  domain: "code",
  risk: "low",
  prompt: "",
  contextTokens: 100,
  userScope: "user-1",
};

function response(): VerifiedResponse {
  return {
    answer: "ok",
    evidence: [],
    verdict: { verdict: "ALLOW", approvals: 2, required: 2, checks: [], failed: [], reason: "test" },
    financialExecution: false,
  };
}

describe("HyperCore Governed Semantic Cache", () => {
  it("produces a stable key bound to scope and versions", () => {
    const cache = createGovernedSemanticCache();
    expect(cache.buildKey(task, { policyVersion: "CROWN-v20", modelVersion: "m", dataVersion: "d" })).toBe(
      cache.buildKey(task, { policyVersion: "CROWN-v20", modelVersion: "m", dataVersion: "d" }),
    );
    expect(cache.buildKey(task, { policyVersion: "CROWN-v20", modelVersion: "m", dataVersion: "d" })).not.toBe(
      cache.buildKey({ ...task, userScope: "user-2" }, { policyVersion: "CROWN-v20", modelVersion: "m", dataVersion: "d" }),
    );
  });

  it("stores and retrieves an entry within its TTL", () => {
    const cache = createGovernedSemanticCache();
    cache.store(task, response(), { policyVersion: "p", modelVersion: "m", dataVersion: "d" }, 3600, 0.0001);
    const hit = cache.lookup(task, { policyVersion: "p", modelVersion: "m", dataVersion: "d" });
    expect(hit).not.toBeNull();
    expect(cache.size()).toBe(1);
  });

  it("invalidates on a version change and on expiry", () => {
    let clock = 0;
    const cache = createGovernedSemanticCache({ now: () => clock });
    const versions = { policyVersion: "p", modelVersion: "m", dataVersion: "d" };
    cache.store(task, response(), versions, 1, 0.0001);
    expect(cache.lookup(task, { ...versions, policyVersion: "p2" })).toBeNull();
    clock = 5000;
    expect(cache.lookup(task, versions)).toBeNull();
  });

  it("surfaces lexically similar candidates for reuse review", () => {
    const cache = createGovernedSemanticCache();
    const versions = { policyVersion: "p", modelVersion: "m", dataVersion: "d" };
    cache.store({ ...task, prompt: "" }, response(), versions, 3600, 0.0001);
    const matches = cache.findSimilar({ ...task, prompt: "" }, versions);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.entry).toBeDefined();
  });

  it("clears all entries", () => {
    const cache = createGovernedSemanticCache();
    const versions = { policyVersion: "p", modelVersion: "m", dataVersion: "d" };
    cache.store(task, response(), versions, 3600, 0.0001);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
