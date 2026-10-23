import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(new URL("../../src/server.ts", import.meta.url), "utf8");
const routeStart = serverSource.indexOf('app.post("/api/v1/cognition/route"');
const routeEnd = serverSource.indexOf("// Multimodal readiness", routeStart);
const route = serverSource.slice(routeStart, routeEnd);

describe("cognition response-cache security contract", () => {
  it("validates input and rejects unscoped memory access before cache reads", () => {
    const inputLimit = route.indexOf('if (input.length > 20_000)');
    const memoryGuard = route.indexOf('if (typeof body.memoryQuery === "string" && body.memoryQuery.trim())');
    const cacheRead = route.indexOf("cognitionResponseCache.get(cacheKey)");
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(inputLimit).toBeGreaterThanOrEqual(0);
    expect(memoryGuard).toBeGreaterThan(inputLimit);
    expect(cacheRead).toBeGreaterThan(memoryGuard);
  });

  it("evaluates current governance and appends an evaluation event before cache reuse", () => {
    const policyDecision = route.indexOf("const decision = runtime.evaluate(");
    const evidenceEvent = route.indexOf('type: "COGNITIVE_EVALUATION"');
    const cacheRead = route.indexOf("cognitionResponseCache.get(cacheKey)");
    expect(policyDecision).toBeGreaterThanOrEqual(0);
    expect(evidenceEvent).toBeGreaterThan(policyDecision);
    expect(cacheRead).toBeGreaterThan(evidenceEvent);
  });

  it("binds cache entries to the governance method and never caches deterministic fallback", () => {
    expect(route).toContain("buildCognitionCacheKey(input, history, modelEngine, focusLens, methodId)");
    expect(route).toContain('(body as { responseEngine?: unknown }).responseEngine !== "sovereign-fallback"');
    expect(route).toContain("decision.admitted");
  });
});
