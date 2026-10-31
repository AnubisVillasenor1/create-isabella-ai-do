import { describe, expect, it } from "vitest";
import { clusterKMeans, createDataCard, createModelCard, detectAnomalies, deterministicFallback, trainDeterministicRegression } from "../../src/lib/native-ml";
import type { DatasetIdentity, ModelIdentity } from "../../src/lib/native-ml";

const dataset: DatasetIdentity = { datasetId: "ds", version: "1", territoryId: "rdm", source: "local", license: "MIT", schemaHash: "schema", contentHash: "content", createdAt: new Date(0).toISOString() };

describe("native ML sovereign core", () => {
  it("trains regression with a reproducible artifact and cards", () => {
    const trained = trainDeterministicRegression({ dataset, features: [[0], [1], [2]], labels: [0, 2, 4] }, "owner", "rdm");
    expect(trained.artifactHash).toHaveLength(64);
    expect(createDataCard(dataset, [[0], [1]], "forecasting").quality.rows).toBe(2);
    expect(createModelCard(trained.model, ["regression", "explainability"], { mae: 0 }).fallback).toBe(true);
  });

  it("detects anomalies and clusters deterministically", () => {
    const rows = [[0, 0], [0.1, 0.1], [10, 10]];
    expect(detectAnomalies(rows, 1.2).anomalies[2]).toBe(true);
    const clusters = clusterKMeans([[0], [0.1], [10], [10.1]], 2);
    expect(clusters.assignments).toHaveLength(4);
    expect(clusters.centroids).toHaveLength(2);
  });

  it("provides a provenance-bearing offline fallback", () => {
    const fallback = deterministicFallback([[1, 2]], "provider_down");
    expect(fallback.degraded).toBe(true);
    expect(fallback.provenanceHash).toHaveLength(64);
  });
});
