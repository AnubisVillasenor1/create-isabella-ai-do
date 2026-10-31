// state: draft | engine-generated
//
// Generalization protocol. The engine today only scores the training set, so a
// model cannot honestly demonstrate held-out performance. These are the missing
// evaluation primitives: seeded stratified split, k-fold cross-validation and a
// bootstrap confidence interval. They measure capability; they do not grant
// authority or production status.

import { mulberry32, permutation, type Rng } from './prng';

export interface TrainTestSplit<T> {
  train: T[];
  test: T[];
}

/**
 * Stratified train/test split preserving class proportions. `labels` drive the
 * strata; pairs stay bound. Deterministic under a seed.
 */
export function stratifiedSplit<T>(
  items: readonly T[],
  labels: readonly number[],
  testFraction: number,
  seed = 1
): TrainTestSplit<T> {
  if (items.length === 0 || items.length !== labels.length)
    throw new Error('split_length_mismatch');
  if (!(testFraction > 0 && testFraction < 1)) throw new Error('invalid_test_fraction');
  const rng = mulberry32(seed >>> 0);
  const byClass = new Map<number, number[]>();
  labels.forEach((label, i) => {
    const bucket = byClass.get(label) ?? [];
    bucket.push(i);
    byClass.set(label, bucket);
  });
  const train: T[] = [];
  const test: T[] = [];
  for (const bucket of byClass.values()) {
    const shuffled = permutation(bucket.length, rng).map((p) => bucket[p]!);
    const nTest = Math.floor(shuffled.length * testFraction);
    for (let i = 0; i < shuffled.length; i++) {
      if (i < nTest) test.push(items[shuffled[i]!]!);
      else train.push(items[shuffled[i]!]!);
    }
  }
  if (train.length === 0 || test.length === 0) throw new Error('degenerate_split');
  return { train, test };
}

/** A single shuffled index partition into k roughly equal folds. */
export function kFoldIndices(n: number, k: number, rng: Rng): number[][] {
  if (!Number.isInteger(k) || k < 2 || k > n) throw new Error('invalid_fold_count');
  const order = permutation(n, rng);
  const folds: number[][] = Array.from({ length: k }, () => []);
  order.forEach((idx, pos) => folds[pos % k]!.push(idx));
  return folds;
}

export interface CrossValidationResult {
  k: number;
  scores: number[];
  mean: number;
  std: number;
}

/**
 * k-fold cross-validation over an index->score function. `evaluateFold` receives
 * (trainIndices, testIndices) and returns a scalar score (higher is better).
 */
export function crossValidate(
  n: number,
  k: number,
  evaluateFold: (trainIndices: number[], testIndices: number[]) => number,
  seed = 7
): CrossValidationResult {
  if (n === 0) throw new Error('empty_dataset');
  const rng = mulberry32(seed >>> 0);
  const folds = kFoldIndices(n, k, rng);
  const scores: number[] = [];
  for (let f = 0; f < folds.length; f++) {
    const testIndices = folds[f]!;
    const trainIndices = folds.filter((_, f2) => f2 !== f).flat();
    scores.push(evaluateFold(trainIndices, testIndices));
  }
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return { k, scores, mean, std: Math.sqrt(variance) };
}

export interface BootstrapCI {
  mean: number;
  lower: number;
  upper: number;
  confidence: number;
}

/**
 * Non-parametric bootstrap confidence interval for the mean of `values`.
 * Deterministic under a seed. Percentile method.
 */
export function bootstrapMeanCI(
  values: readonly number[],
  {
    samples = 1000,
    confidence = 0.95,
    seed = 13,
  }: { samples?: number; confidence?: number; seed?: number } = {}
): BootstrapCI {
  if (values.length === 0) throw new Error('empty_sample');
  if (!(confidence > 0 && confidence < 1)) throw new Error('invalid_confidence');
  const rng = mulberry32(seed >>> 0);
  const n = values.length;
  const means: number[] = [];
  for (let s = 0; s < samples; s++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[Math.floor(rng() * n)]!;
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const alpha = (1 - confidence) / 2;
  const lower = means[Math.floor(alpha * samples)]!;
  const upper = means[Math.min(samples - 1, Math.floor((1 - alpha) * samples))]!;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return { mean, lower, upper, confidence };
}
