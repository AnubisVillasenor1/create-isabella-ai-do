import { describe, expect, it } from "vitest";
import { CognitiveRouter, routeFeatures } from "../../src/tts/router";
import type { ProsodyPlan, VoiceMode } from "../../src/tts/types";

const EMOTION = {
  neutrality: 0.5, excitement: 0.5, empathy: 0.5, humor: 0.1,
  concern: 0.1, reverence: 0.1, urgency: 0.1, sadness: 0.1,
  confidence: 0.5, warmth: 0.5, authority: 0.5, curiosity: 0.5,
} as unknown as ProsodyPlan["emotion"];

function plan(): ProsodyPlan {
  return { emotion: EMOTION, cues: [], segments: [] } as unknown as ProsodyPlan;
}

const EXPERTS = [
  { id: "native-fsim", available: true },
  { id: "server-tts", available: true },
  { id: "browser-speech", available: true },
] as const;

describe("TTS cognitive router · load-aware fairness", () => {
  it("β = 0 reproduces the static softmax behaviour", () => {
    const features = routeFeatures(plan(), "PODCAST" as VoiceMode, 300);
    const a = new CognitiveRouter(0.01, 3, 0).route(EXPERTS, features);
    const b = new CognitiveRouter(0.01, 3, 0).route(EXPERTS, features);
    expect(a.ranked).toEqual(b.ranked);
    expect(Object.values(a.loadPenalty).every((p) => p === 0)).toBe(true);
  });

  it("renormalises the top-k weights to sum to 1", () => {
    const features = routeFeatures(plan(), "CONVERSACION" as VoiceMode, 200);
    const decision = new CognitiveRouter(0.01, 3, 0.6).route(EXPERTS, features);
    const total = decision.ranked.reduce((sum, r) => sum + r.weight, 0);
    expect(total).toBeCloseTo(1, 2);
    expect(decision.ranked.length).toBeLessThanOrEqual(3);
  });

  it("shifts traffic away from an over-used backend over repeated identical requests", () => {
    const features = routeFeatures(plan(), "PODCAST" as VoiceMode, 300);
    const withFairness = new CognitiveRouter(0.01, 3, 3.0);
    const without = new CognitiveRouter(0.01, 3, 0);
    for (let i = 0; i < 60; i += 1) {
      withFairness.route(EXPERTS, features);
      without.route(EXPERTS, features);
    }
    const fair = withFairness.distribution();
    const unfair = without.distribution();
    const topFair = Math.max(...Object.values(fair));
    const topUnfair = Math.max(...Object.values(unfair));
    // Fairness must strictly reduce the dominant backend's share.
    expect(topFair).toBeLessThan(topUnfair);
    // And the observed shares must remain a valid distribution.
    expect(Object.values(fair).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("returns an empty ranking when no backend is available", () => {
    const features = routeFeatures(plan(), "CONVERSACION" as VoiceMode, 100);
    const decision = new CognitiveRouter().route([{ id: "native-fsim", available: false }], features);
    expect(decision.ranked).toHaveLength(0);
  });

  it("reports a deterministic, non-negative load-balance loss", () => {
    const features = routeFeatures(plan(), "CONVERSACION" as VoiceMode, 100);
    const router = new CognitiveRouter();
    for (let i = 0; i < 5; i += 1) router.route(EXPERTS, features);
    const decision = router.route(EXPERTS, features);
    expect(decision.loadBalanceLoss).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(decision.loadBalanceLoss)).toBe(true);
  });
});
