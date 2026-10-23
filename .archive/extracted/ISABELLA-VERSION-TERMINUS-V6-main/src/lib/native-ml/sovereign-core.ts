import { createHash } from "node:crypto";
import type { DatasetIdentity, ModelIdentity, PredictionResult } from "./types";

export type NativeCapability =
  | "classification"
  | "regression"
  | "anomaly"
  | "clustering"
  | "timeseries"
  | "ranking"
  | "recommendation"
  | "online"
  | "federated"
  | "explainability";

export interface ModelCard {
  model: ModelIdentity;
  capabilities: NativeCapability[];
  limitations: string[];
  evaluation: Record<string, number>;
  fallback: boolean;
  createdAt: string;
}

export interface DataCard {
  dataset: DatasetIdentity;
  intendedUse: string;
  outOfScopeUses: string[];
  quality: { rows: number; dimensions: number; missingValues: number };
  createdAt: string;
}

export interface RegressionModel {
  model: ModelIdentity;
  weights: number[];
  bias: number;
  artifactHash: string;
}

export interface AnomalyResult {
  scores: number[];
  anomalies: boolean[];
  threshold: number;
  degraded: boolean;
}

export interface ClusterResult {
  assignments: number[];
  centroids: number[][];
  iterations: number;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const finite = (row: number[]) => row.length > 0 && row.every(Number.isFinite);
function validateMatrix(rows: number[][]): number {
  const width = rows[0]?.length ?? 0;
  if (!width || rows.some((row) => row.length !== width || !finite(row))) throw new Error("invalid_feature_matrix");
  return width;
}
function dot(a: number[], b: number[], bias = 0) { return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), bias); }

export function trainDeterministicRegression(
  dataset: { dataset: DatasetIdentity; features: number[][]; labels: number[] },
  ownerId: string,
  territoryId: string,
  epochs = 80,
): RegressionModel {
  const width = validateMatrix(dataset.features);
  if (dataset.features.length !== dataset.labels.length || dataset.labels.some((v) => !Number.isFinite(v))) throw new Error("invalid_regression_dataset");
  const weights = Array<number>(width).fill(0); let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch++) for (let i = 0; i < dataset.features.length; i++) {
    const error = dot(dataset.features[i]!, weights, bias) - dataset.labels[i]!;
    const rate = 0.01 / Math.sqrt(epoch + 1);
    for (let j = 0; j < width; j++) weights[j] -= rate * error * dataset.features[i]![j]!;
    bias -= rate * error;
  }
  const artifactHash = digest({ weights, bias });
  return {
    weights, bias, artifactHash,
    model: { modelId: `native-regression-${artifactHash.slice(0, 16)}`, version: "1.0.0", territoryId, ownerId, task: "regression", algorithm: "deterministic-linear-sgd", datasetIds: [dataset.dataset.datasetId], modelHash: artifactHash, createdAt: new Date().toISOString(), approvalStatus: "PENDING_REVIEW" },
  };
}

export function predictRegression(model: RegressionModel, features: number[][], approved = false): PredictionResult<number> {
  if (!approved && model.model.approvalStatus !== "APPROVED") throw new Error("model_not_approved");
  validateMatrix(features); if (features.some((row) => row.length !== model.weights.length)) throw new Error("feature_width_mismatch");
  const predictions = features.map((row) => dot(row, model.weights, model.bias));
  return { model: model.model, predictions, confidence: predictions.map(() => 1), explanation: { method: "linear_feature_contribution", weights: [...model.weights] }, riskScore: 0, requiresReview: false, degraded: true };
}

export function detectAnomalies(rows: number[][], threshold = 3): AnomalyResult {
  const width = validateMatrix(rows); const means = Array(width).fill(0).map((_, j) => rows.reduce((s, row) => s + row[j]!, 0) / rows.length);
  const deviations = means.map((mean, j) => Math.sqrt(rows.reduce((s, row) => s + (row[j]! - mean) ** 2, 0) / rows.length) || 1);
  const scores = rows.map((row) => Math.sqrt(row.reduce((s, value, j) => s + ((value - means[j]!) / deviations[j]!) ** 2, 0) / width));
  return { scores, anomalies: scores.map((score) => score >= threshold), threshold, degraded: true };
}

export function clusterKMeans(rows: number[][], k: number, maxIterations = 50): ClusterResult {
  const width = validateMatrix(rows); if (!Number.isInteger(k) || k < 1 || k > rows.length) throw new Error("invalid_cluster_count");
  let centroids = rows.slice(0, k).map((row) => [...row]); let assignments = Array(rows.length).fill(-1); let iterations = 0;
  const nearest = (row: number[]) => centroids.reduce((best, centroid, i) => { const distance = row.reduce((s, v, j) => s + (v - centroid[j]!) ** 2, 0); return distance < best.distance ? { i, distance } : best; }, { i: 0, distance: Infinity }).i;
  for (; iterations < maxIterations; iterations++) { const next = rows.map(nearest); if (next.every((v, i) => v === assignments[i])) break; assignments = next; centroids = centroids.map((centroid, c) => { const members = rows.filter((_, i) => assignments[i] === c); return members.length ? Array.from({ length: width }, (_, j) => members.reduce((s, row) => s + row[j]!, 0) / members.length) : centroid; }); }
  return { assignments, centroids, iterations };
}

export function createDataCard(dataset: DatasetIdentity, rows: number[][], intendedUse: string): DataCard {
  const dimensions = rows[0]?.length ?? 0; return { dataset, intendedUse, outOfScopeUses: ["decisiones de alto impacto sin revisión humana"], quality: { rows: rows.length, dimensions, missingValues: rows.flat().filter((value) => !Number.isFinite(value)).length }, createdAt: new Date().toISOString() };
}

export function createModelCard(model: ModelIdentity, capabilities: NativeCapability[], evaluation: Record<string, number>): ModelCard {
  return { model, capabilities, evaluation, limitations: ["requiere aprobación humana", "no sustituye políticas CROWN"], fallback: true, createdAt: new Date().toISOString() };
}

export function deterministicFallback(features: number[][], reason = "provider_unavailable") {
  validateMatrix(features); return { provider: "native-fallback", reason, predictions: features.map((row) => row.reduce((sum, value) => sum + value, 0)), degraded: true, provenanceHash: digest({ features, reason }) };
}
