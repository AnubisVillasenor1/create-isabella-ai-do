import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(new URL("../../src/server.ts", import.meta.url), "utf8");
const routeStart = serverSource.search(/app\.post\(\s*["']\/api\/v1\/cognition\/route["']/);
const streamStart = serverSource.search(/app\.post\(\s*["']\/api\/v1\/cognition\/stream["']/);

function between(start: number, end: number): string {
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe("Ω∞ server integration contract", () => {
  it("imports and instantiates one runtime outside the request handlers", () => {
    expect(serverSource).toMatch(/from\s+["']\.\/omega-runtime["']/);
    expect(serverSource).toContain("const omegaRuntime = new OmegaRuntime();");
    const instantiation = serverSource.indexOf("const omegaRuntime = new OmegaRuntime();");
    expect(instantiation).toBeLessThan(routeStart);
  });

  it("runs prepare only after governance and the response-cache read", () => {
    const route = between(routeStart, streamStart);
    const policyDecision = route.indexOf("const decision = runtime.evaluate(");
    const cacheRead = route.indexOf("cognitionResponseCache.get(cacheKey)");
    const prepare = route.indexOf("omegaRuntime.prepare");
    expect(policyDecision).toBeGreaterThanOrEqual(0);
    expect(cacheRead).toBeGreaterThan(policyDecision);
    expect(prepare).toBeGreaterThan(cacheRead);
    expect(route).toContain("omegaRuntime.finalize(omegaPrepared, generativeNarrative)");
    expect(route).toContain("OMEGA_RUNTIME_BLOCK");
    expect(route).toMatch(
      /omegaRuntime:\s*omegaPrepared\s*\?\s*omegaRuntime\.publicSummary\(omegaPrepared,\s*omegaFinalized\)\s*:\s*null/,
    );
  });

  it("returns 403 and a non-cacheable safe answer when Ω∞ blocks the route", () => {
    const route = between(routeStart, streamStart);
    expect(route).toContain("success: decision.admitted && !omegaBlocked");
    expect(route).toContain("res.status(decision.admitted && !omegaBlocked ? 200 : 403)");
    expect(route).toContain("generativeNarrative = omegaPrepared?.blockedResponse ?? OMEGA_SAFE_BLOCKED_RESPONSE");
    expect(route).toContain("omegaBlocked,");
  });

  it("runs prepare before provider selection and finalizes before streaming chunks", () => {
    const stream = between(streamStart, serverSource.length);
    const prepare = stream.search(/omegaRuntime\s*\.\s*prepare\(/);
    const providerDecision = stream.indexOf("const willUseProvider");
    const finalize = stream.indexOf("omegaRuntime.finalize(omegaPrepared, answer)");
    const chunks = stream.indexOf("const chunks = splitStreamChunks(answer, 180)");
    expect(prepare).toBeGreaterThanOrEqual(0);
    expect(providerDecision).toBeGreaterThan(prepare);
    expect(finalize).toBeGreaterThan(providerDecision);
    expect(chunks).toBeGreaterThan(finalize);
    expect(stream).toContain("omegaBlocked: omegaFinalBlocked");
    expect(stream).toContain("success: decision.admitted && !omegaFinalBlocked");
  });

  it("publishes runtime status through the existing native-runtime endpoint", () => {
    const nativeStart = serverSource.search(
      /app\.get\(\s*["']\/api\/v1\/cognition\/native-runtime["']/,
    );
    const nativeEnd = routeStart;
    const native = between(nativeStart, nativeEnd);
    expect(native).toContain("omega: omegaRuntime.status()");
  });
});
