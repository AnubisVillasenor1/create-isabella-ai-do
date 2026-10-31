import { describe, expect, it } from "vitest";
import {
  MoeNativeModel,
  createMoeNative,
  type MoeModelArtifact,
  type MoeNativeConfig,
} from "../../src/lib/native-ml/moe-native";

const CONFIG: MoeNativeConfig = {
  inputDim: 3,
  expertCount: 4,
  topK: 2,
  mode: "regression",
  seed: 7,
  epochs: 5,
};

describe("native MoE · artifact round-trip", () => {
  it("restores an exported artifact and reproduces identical routing", () => {
    const model = createMoeNative(CONFIG);
    const artifact = model.getArtifact();
    const restored = MoeNativeModel.fromArtifact(CONFIG, artifact);
    for (const input of [[0.1, 0.5, 0.9], [1, 0, 0], [0.3, 0.3, 0.3]]) {
      expect(restored.route(input)).toEqual(model.route(input));
      expect(restored.predict(input)).toEqual(model.predict(input));
    }
    expect(restored.getArtifact().artifactHash).toBe(artifact.artifactHash);
  });

  it("fails closed when the artifact hash does not match the weights", () => {
    const model = createMoeNative(CONFIG);
    const artifact: MoeModelArtifact = model.getArtifact();
    const tampered: MoeModelArtifact = {
      ...artifact,
      expertBias: artifact.expertBias.map((value, index) => (index === 0 ? value + 1 : value)),
    };
    expect(() => MoeNativeModel.fromArtifact(CONFIG, tampered)).toThrow("moe_artifact_hash_mismatch");
  });

  it("fails closed on shape mismatches", () => {
    const model = createMoeNative(CONFIG);
    const artifact = model.getArtifact();
    expect(() =>
      MoeNativeModel.fromArtifact(CONFIG, { ...artifact, routerBias: [1, 2] }),
    ).toThrow("moe_artifact_router_bias_invalid");
    expect(() =>
      MoeNativeModel.fromArtifact(CONFIG, { ...artifact, routerWeights: [[1, 2, 3]] }),
    ).toThrow("moe_artifact_router_weights_invalid");
  });
});

describe("native MoE · routing diagnostics", () => {
  it("reports bounded entropy, gini and load statistics from real routing", () => {
    const model = createMoeNative(CONFIG);
    const inputs = Array.from({ length: 40 }, (_, i) => [i / 40, (40 - i) / 40, 0.5]);
    const diagnostics = model.routingDiagnostics(inputs);
    expect(diagnostics.entropyNormalized).toBeGreaterThanOrEqual(0);
    expect(diagnostics.entropyNormalized).toBeLessThanOrEqual(1);
    expect(diagnostics.gini).toBeGreaterThanOrEqual(0);
    expect(diagnostics.gini).toBeLessThanOrEqual(1);
    expect(diagnostics.meanProbabilities).toHaveLength(CONFIG.expertCount);
    expect(diagnostics.hardLoads).toHaveLength(CONFIG.expertCount);
    expect(diagnostics.hardLoads.reduce((sum, load) => sum + load, 0)).toBeCloseTo(1, 10);
    const meanProbTotal = diagnostics.meanProbabilities.reduce((sum, p) => sum + p, 0);
    expect(meanProbTotal).toBeCloseTo(1, 10);
    expect(diagnostics.loadMax).toBeGreaterThanOrEqual(diagnostics.loadMin);
  });

  it("is deterministic for the same seed and inputs", () => {
    const inputs = [[0.2, 0.4, 0.6], [0.9, 0.1, 0.1], [0.5, 0.5, 0.5]];
    const a = createMoeNative(CONFIG).routingDiagnostics(inputs);
    const b = createMoeNative(CONFIG).routingDiagnostics(inputs);
    expect(a).toEqual(b);
  });

  it("rejects an empty batch", () => {
    expect(() => createMoeNative(CONFIG).routingDiagnostics([])).toThrow("moe_batch_empty");
  });
});
