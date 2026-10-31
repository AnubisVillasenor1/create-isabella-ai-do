// state: draft | engine-generated
//
// Explainability primitives. The governed platform requires that every decision
// be contestable, but the native engine only reported "linear_feature_contribution"
// as a label without computing it. This adds three real, model-agnostic exports:
// exact attribution for linear models, permutation importance for any predictor,
// and a minimal-change counterfactual for binary classifiers. Explanations
// support human review; they are not themselves authority.

import { mulberry32 } from './prng';

export interface FeatureAttribution {
  feature: number;
  value: number;
  contribution: number;
}

/** Exact additive decomposition of a linear score: bias + Σ wᵢxᵢ. */
export function linearAttribution(
  weights: readonly number[],
  bias: number,
  row: readonly number[]
): { contributions: FeatureAttribution[]; score: number } {
  if (weights.length !== row.length) throw new Error('attribution_length_mismatch');
  if ([...weights, ...row, bias].some((v) => !Number.isFinite(v)))
    throw new Error('non_finite_attribution');
  const contributions = weights.map((w, i) => ({
    feature: i,
    value: row[i]!,
    contribution: w * row[i]!,
  }));
  const score = contributions.reduce((s, c) => s + c.contribution, 0) + bias;
  return { contributions, score };
}

/**
 * Permutation importance: for each feature, shuffle its column across the
 * evaluation set and measure the drop in `score` (higher score = better).
 * Larger drops mean the model relies more on that feature. Deterministic seed.
 */
export function permutationImportance(
  predict: (rows: readonly (readonly number[])[]) => readonly number[],
  features: readonly (readonly number[])[],
  labels: readonly number[],
  score: (pred: readonly number[], truth: readonly number[]) => number,
  seed = 5
): number[] {
  if (features.length === 0 || features.length !== labels.length)
    throw new Error('importance_dataset_mismatch');
  const width = features[0]!.length;
  const base = score(predict(features), labels);
  const rng = mulberry32(seed >>> 0);
  const importances: number[] = [];
  for (let j = 0; j < width; j++) {
    const permuted = features.map((row) => row.slice());
    const col = permuted.map((row) => row[j]!);
    for (let i = permuted.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      const tmp = col[i]!;
      col[i] = col[k]!;
      col[k] = tmp;
    }
    permuted.forEach((row, i) => (row[j] = col[i]!));
    importances.push(base - score(predict(permuted), labels));
  }
  return importances;
}

export interface Counterfactual {
  changed: boolean;
  features: number[];
  flips: number;
}

/**
 * Coordinate-descent counterfactual for a binary scorer: try single-feature
 * moves across observed per-feature ranges and greedily apply the change that
 * flips the decision with the smallest L1 perturbation. Bounded passes; if no
 * flip is found within the grid, reports changed:false rather than inventing one.
 */
export function nearestCounterfactual(
  scoreOf: (row: readonly number[]) => number,
  origin: readonly number[],
  featureRanges: readonly (readonly [number, number])[],
  threshold = 0.5,
  gridSteps = 10
): Counterfactual {
  if (origin.length !== featureRanges.length) throw new Error('counterfactual_dim_mismatch');
  if (gridSteps < 2) throw new Error('invalid_grid_steps');
  const current = origin.slice();
  const originScore = scoreOf(current);
  const originSide = originScore >= threshold;
  let flips = 0;
  for (let pass = 0; pass < 3; pass++) {
    let bestIdx = -1;
    let bestVal = 0;
    let bestL1 = Infinity;
    for (let j = 0; j < current.length; j++) {
      const [lo, hi] = featureRanges[j]!;
      for (let g = 0; g <= gridSteps; g++) {
        const val = lo + ((hi - lo) * g) / gridSteps;
        if (val === current[j]) continue;
        const trial = current.slice();
        trial[j] = val;
        if (scoreOf(trial) >= threshold !== originSide) {
          const l1 = Math.abs(val - current[j]!);
          if (l1 < bestL1) {
            bestL1 = l1;
            bestIdx = j;
            bestVal = val;
          }
        }
      }
    }
    if (bestIdx < 0) break;
    current[bestIdx] = bestVal;
    flips++;
    if (scoreOf(current) >= threshold !== originSide) break;
  }
  return { changed: scoreOf(current) >= threshold !== originSide, features: current, flips };
}
