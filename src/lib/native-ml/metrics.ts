// state: draft | engine-generated
//
// Held-out evaluation metrics for the native learners. Today the engine only
// reports training-set accuracy and log-loss; without these there is no way to
// measure generalization, so a model could never honestly pass a review gate.
// Deterministic, dependency-free, fail-closed on malformed input.

export interface BinaryMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
}

export interface RegressionMetrics {
  mae: number;
  rmse: number;
  r2: number;
}

function assertSameLength<T>(a: readonly T[], b: readonly T[]): void {
  if (a.length === 0 || a.length !== b.length) throw new Error('metric_length_mismatch');
}

function binary(label: number): 0 | 1 {
  if (label === 0 || label === 1) return label;
  throw new Error('binary_label_required');
}

/** Confusion counts and derived scores for a binary task with positive class = 1. */
export function binaryClassificationMetrics(
  yTrue: readonly number[],
  yPred: readonly number[]
): BinaryMetrics {
  assertSameLength(yTrue, yPred);
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const t = binary(yTrue[i]!);
    const p = binary(yPred[i]!);
    if (t === 1 && p === 1) tp++;
    else if (t === 0 && p === 1) fp++;
    else if (t === 0 && p === 0) tn++;
    else fn++;
  }
  const n = yTrue.length;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    accuracy: (tp + tn) / n,
    precision,
    recall,
    f1,
    truePositive: tp,
    falsePositive: fp,
    trueNegative: tn,
    falseNegative: fn,
  };
}

/**
 * Area under the ROC curve via the Mann-Whitney U statistic (rank-based).
 * Handles ties with the average-rank convention. `scores` are continuous
 * decision scores or probabilities; `yTrue` are 0/1 labels.
 */
export function rocAuc(yTrue: readonly number[], scores: readonly number[]): number {
  assertSameLength(yTrue, scores);
  if (scores.some((value) => !Number.isFinite(value))) throw new Error('non_finite_score');
  const pairs = yTrue
    .map((label, i) => ({ label: binary(label), score: scores[i]! }))
    .sort((a, b) => a.score - b.score);
  // Assign average ranks over ties.
  const ranks = new Array<number>(pairs.length).fill(0);
  let i = 0;
  while (i < pairs.length) {
    let j = i;
    while (j < pairs.length && pairs[j]!.score === pairs[i]!.score) j++;
    const avgRank = (i + (j - 1)) / 2 + 1; // 1-based
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  let sumRanksPositive = 0;
  let positives = 0;
  for (let k = 0; k < pairs.length; k++)
    if (pairs[k]!.label === 1) {
      sumRanksPositive += ranks[k]!;
      positives++;
    }
  const negatives = pairs.length - positives;
  if (positives === 0 || negatives === 0) throw new Error('roc_auc_requires_both_classes');
  const u = sumRanksPositive - (positives * (positives + 1)) / 2;
  return u / (positives * negatives);
}

export function regressionMetrics(
  yTrue: readonly number[],
  yPred: readonly number[]
): RegressionMetrics {
  assertSameLength(yTrue, yPred);
  const n = yTrue.length;
  let sumAbs = 0;
  let sumSq = 0;
  let mean = 0;
  for (let i = 0; i < n; i++) {
    const t = yTrue[i]!;
    const p = yPred[i]!;
    if (!Number.isFinite(t) || !Number.isFinite(p)) throw new Error('non_finite_value');
    const err = p - t;
    sumAbs += Math.abs(err);
    sumSq += err * err;
    mean += t;
  }
  mean /= n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) ssTot += (yTrue[i]! - mean) ** 2;
  const r2 = ssTot === 0 ? 0 : 1 - sumSq / ssTot;
  return { mae: sumAbs / n, rmse: Math.sqrt(sumSq / n), r2 };
}

function euclidean(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(sum);
}

/**
 * Mean silhouette coefficient in [-1, 1]. Points must share a feature width;
 * a single cluster yields 0 (undefined separation). O(n^2) but n is small in
 * the native/edge regime this package targets.
 */
export function silhouetteScore(rows: readonly number[][], assignments: readonly number[]): number {
  if (rows.length === 0 || rows.length !== assignments.length)
    throw new Error('metric_length_mismatch');
  if (rows.some((row) => row.some((value) => !Number.isFinite(value))))
    throw new Error('non_finite_row');
  const width = rows[0]!.length;
  if (width === 0) throw new Error('empty_feature_row');
  if (rows.some((row) => row.length !== width)) throw new Error('ragged_matrix');
  const clusters = [...new Set(assignments)];
  if (clusters.length < 2) return 0;
  const members = (c: number): number[] =>
    assignments.map((a, idx) => (a === c ? idx : -1)).filter((idx) => idx >= 0);
  const memberCache = new Map<number, number[]>();
  for (const c of clusters) memberCache.set(c, members(c));
  let total = 0;
  for (let p = 0; p < rows.length; p++) {
    const own = assignments[p]!;
    const ownMembers = memberCache.get(own)!.filter((idx) => idx !== p);
    const a =
      ownMembers.length === 0
        ? 0
        : ownMembers.reduce((sum, idx) => sum + euclidean(rows[p]!, rows[idx]!), 0) /
          ownMembers.length;
    let b = Infinity;
    for (const c of clusters) {
      if (c === own) continue;
      const other = memberCache.get(c)!;
      if (other.length === 0) continue;
      const dist =
        other.reduce((sum, idx) => sum + euclidean(rows[p]!, rows[idx]!), 0) / other.length;
      if (dist < b) b = dist;
    }
    const denom = Math.max(a, b) || 1;
    total += b === Infinity ? 0 : (b - a) / denom;
  }
  return total / rows.length;
}

/**
 * Top-K accuracy for ranking / recommendation: fraction of ground-truth sets
 * whose at least one relevant item appears in the top K of the ranking.
 */
export function topKAccuracy(
  groundTruth: readonly (readonly string[])[],
  rankings: readonly (readonly string[])[],
  k: number
): number {
  assertSameLength(groundTruth, rankings);
  if (!Number.isInteger(k) || k < 1) throw new Error('invalid_k');
  let hits = 0;
  for (let i = 0; i < groundTruth.length; i++) {
    const truth = new Set(groundTruth[i]!);
    const top = rankings[i]!.slice(0, k);
    if (top.some((item) => truth.has(item))) hits++;
  }
  return hits / groundTruth.length;
}
