import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { routeGenesisExperts, IGE_EXPERT_COUNT, IGE_HEAD_COUNT } from "../../src/cognition/genesis-moe";
import { canonicalGenesisJson, buildGenesisChunk } from "../../src/cognition/genesis-chunk";
import { assessProductionReadiness } from "../../src/deployment/production-ops";

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
}

function benchmark(name: string, operation: () => unknown, warmup = 50, samples = 500) {
  for (let i = 0; i < warmup; i += 1) operation();
  const durations: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    operation();
    durations.push(performance.now() - start);
  }
  return {
    name,
    samples,
    p50Ms: Number(percentile(durations, 0.50).toFixed(4)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(4)),
    p99Ms: Number(percentile(durations, 0.99).toFixed(4)),
    maxMs: Number(Math.max(...durations).toFixed(4)),
  };
}

describe("critical-path CPU latency baseline (no network or model inference)", () => {
  it("benchmarks routing, canonicalization and readiness; emits p50/p95/p99", () => {
    const routingInput = {
      requestId: "latency-benchmark",
      headScores: Array.from({ length: IGE_HEAD_COUNT }, (_, i) => i / 3),
      expertScores: Array.from({ length: IGE_EXPERT_COUNT }, (_, i) => Math.sin(i)),
    };
    const routing = routeGenesisExperts(routingInput);
    const draft = {
      schemaVersion: "ige-chunk/v1" as const,
      requestId: "latency-benchmark",
      sessionId: "perf-session",
      sequence: 0,
      timestamp: "2026-10-10T12:00:00.000Z",
      latencyMs: 0,
      text: "CPU-only integrity benchmark",
      routing,
      ethicsTrace: { guardiansInvoked: ["privacy", "safety"], flags: [], arbitrationResult: "ALLOW" as const },
    };
    const readinessInput = [
      { name: "atlas", status: "healthy" as const, required: true },
      { name: "bookpi", status: "healthy" as const, required: true },
      { name: "ikes", status: "healthy" as const, required: true },
    ];

    const results = [
      benchmark("IGE routing", () => routeGenesisExperts(routingInput)),
      benchmark("Genesis canonical JSON + SHA-256", () => buildGenesisChunk(draft)),
      benchmark("Production readiness evaluation", () => assessProductionReadiness(readinessInput)),
      benchmark("Canonical JSON serialization", () => canonicalGenesisJson({ routing, readiness: readinessInput, text: draft.text })),
    ];
    console.info("[critical-latency-baseline]", JSON.stringify(results));
    for (const result of results) {
      expect(result.samples).toBe(500);
      // A broad regression ceiling catches catastrophic CPU stalls without pretending
      // to guarantee near-zero latency on variable shared CI runners.
      expect(result.p99Ms).toBeLessThan(100);
    }
  });
});
