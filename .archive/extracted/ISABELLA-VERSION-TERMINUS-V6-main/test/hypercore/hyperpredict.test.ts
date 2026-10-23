import { describe, expect, it } from "vitest";
import {
  DEFAULT_HYPERPREDICT_POLICY,
  createHyperPredict,
  type PrefetchTaskDefinition,
} from "../../src/hypercore/hyperpredict";
import type { HyperPredictSession } from "../../src/hypercore/types";

const session: HyperPredictSession = {
  subject: "edwin",
  role: "architect",
  deviceTrusted: true,
  openArtifacts: ["api.py", "schema.sql"],
  currentIntent: "generate.api",
  recentIntents: ["code.review"],
  risk: "low",
  territory: "real-del-monte",
};

describe("HyperPredict Ω", () => {
  it("predicts a prefetch for a strongly signalled intent", () => {
    const engine = createHyperPredict();
    const predictions = engine.predict(session);
    const api = predictions.find((prediction) => prediction.intent === "generate.api");
    expect(api?.decision).toBe("PREFETCH");
    expect(api?.confidence).toBeGreaterThanOrEqual(DEFAULT_HYPERPREDICT_POLICY.minimumConfidence);
  });

  it("prepares once and then serves the prepared artifacts from cache", () => {
    const engine = createHyperPredict();
    const api = engine.predict(session).find((prediction) => prediction.intent === "generate.api");
    expect(api).toBeDefined();
    const prepared = engine.prepare(session, api!);
    expect(prepared.status).toBe("prepared");
    expect(prepared.energyKwh).toBeGreaterThan(0);
    expect(engine.budgetUsed()).toBeGreaterThan(0);
    const cached = engine.prepare(session, api!);
    expect(cached.status).toBe("cache-hit");
  });

  it("never prefetches in observe-only mode", () => {
    const engine = createHyperPredict({ policy: { ...DEFAULT_HYPERPREDICT_POLICY, mode: "observe-only" } });
    const predictions = engine.predict(session);
    expect(predictions.some((prediction) => prediction.decision === "OBSERVE")).toBe(true);
    expect(predictions.some((prediction) => prediction.decision === "PREFETCH")).toBe(false);
  });

  it("denies an intent on the CROWN forbidden list", () => {
    const forbidden: PrefetchTaskDefinition = {
      intent: "secret.read",
      artifacts: [],
      energyKwh: 0.00001,
      latencyMs: 10,
      ttlSeconds: 60,
      value: 1,
      run: () => ({}),
    };
    const engine = createHyperPredict({ catalog: [forbidden] });
    const prediction = engine.predict(session)[0];
    expect(prediction?.decision).toBe("DENY");
    expect(prediction?.reason).toBe("PREFETCH_FORBIDDEN_BY_CROWN");
    expect(engine.prepare(session, prediction!).status).toBe("not-prepared");
  });

  it("reports decision counters", () => {
    const engine = createHyperPredict();
    engine.predict(session);
    const stats = engine.stats();
    expect(stats.observations + stats.denied + stats.deferred + stats.prefetchDecisions).toBe(engine.catalog().length);
  });
});
