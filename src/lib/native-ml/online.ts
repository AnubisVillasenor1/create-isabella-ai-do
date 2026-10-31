// state: draft | engine-generated
//
// Online / incremental learning. Every native learner is batch: it must be
// retrained from scratch to incorporate new data, which is impossible on the
// edge and wasteful in continuous streams. This adds a warm-startable logistic
// classifier that folds in one example at a time (partial fit), keeps a bounded
// regret by optional L2 shrink, and can emit a hash-compatible artifact for the
// governed registry. Incremental adaptation is a capability, never self-granted
// authority to change a deployed model.

import { createHash } from 'node:crypto';

export interface OnlineState {
  weights: number[];
  bias: number;
  numFeatures: number;
  updates: number;
  sumLoss: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, x))));
}

export function createOnlineClassifier(numFeatures: number): OnlineState {
  if (!Number.isInteger(numFeatures) || numFeatures < 1) throw new Error('invalid_num_features');
  return {
    weights: new Array<number>(numFeatures).fill(0),
    bias: 0,
    numFeatures,
    updates: 0,
    sumLoss: 0,
  };
}

export interface PartialFitOptions {
  learningRate?: number;
  l2?: number;
}

/** Fold a single labeled example into the state (SGD step). Mutates and returns it. */
export function partialFit(
  state: OnlineState,
  row: readonly number[],
  label: number,
  options: PartialFitOptions = {}
): OnlineState {
  if (row.length !== state.numFeatures) throw new Error('feature_width_mismatch');
  if (label !== 0 && label !== 1) throw new Error('binary_label_required');
  if (row.some((v) => !Number.isFinite(v))) throw new Error('non_finite_feature');
  const lr = options.learningRate ?? 0.05;
  const l2 = options.l2 ?? 0;
  if (!(lr > 0) || !Number.isFinite(lr)) throw new Error('invalid_learning_rate');
  const score = row.reduce((s, x, j) => s + x * state.weights[j]!, state.bias);
  const p = sigmoid(score);
  const err = p - label;
  for (let j = 0; j < state.numFeatures; j++) {
    state.weights[j] = state.weights[j]! - lr * (err * row[j]! + l2 * state.weights[j]!);
  }
  state.bias -= lr * err;
  const loss = -(
    label * Math.log(Math.max(p, 1e-9)) +
    (1 - label) * Math.log(Math.max(1 - p, 1e-9))
  );
  state.sumLoss += loss;
  state.updates += 1;
  return state;
}

export function predictOnline(
  state: OnlineState,
  row: readonly number[]
): { probability: number; label: 0 | 1 } {
  if (row.length !== state.numFeatures) throw new Error('feature_width_mismatch');
  if (row.some((v) => !Number.isFinite(v))) throw new Error('non_finite_feature');
  const probability = sigmoid(row.reduce((s, x, j) => s + x * state.weights[j]!, state.bias));
  return { probability, label: probability >= 0.5 ? 1 : 0 };
}

export function meanOnlineLoss(state: OnlineState): number {
  return state.updates === 0 ? 0 : state.sumLoss / state.updates;
}

/** Snapshot into a weights/bias artifact plus its deterministic hash. */
export function onlineArtifact(state: OnlineState): {
  weights: number[];
  bias: number;
  artifactHash: string;
} {
  const weights = state.weights.slice();
  const bias = state.bias;
  const artifactHash = createHash('sha256').update(JSON.stringify({ weights, bias })).digest('hex');
  return { weights, bias, artifactHash };
}
