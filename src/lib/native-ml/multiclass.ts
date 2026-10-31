// state: draft | engine-generated
//
// Multiclass classification. The native engine only ships a binary logistic
// learner, so any task with three or more classes had no principled model.
// Softmax regression closes that gap deterministically: cross-entropy SGD,
// label-indexed weight matrix, argmax inference. Capability only — approval and
// production remain human decisions.

import { createHash } from 'node:crypto';

export interface SoftmaxModel {
  readonly numClasses: number;
  readonly numFeatures: number;
  /** weight[class][feature] */
  readonly weights: number[][];
  readonly bias: number[];
  readonly modelHash: string;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateMatrix(rows: readonly (readonly number[])[], width: number): void {
  if (rows.some((row) => row.length !== width || row.some((v) => !Number.isFinite(v))))
    throw new Error('invalid_feature_matrix');
}

function softmax(logits: readonly number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(Math.max(-40, Math.min(40, z - max))));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

export interface SoftmaxTrainOptions {
  epochs?: number;
  learningRate?: number;
  l2?: number;
}

/** Train softmax regression over integer labels in [0, numClasses). */
export function trainSoftmax(
  features: readonly (readonly number[])[],
  labels: readonly number[],
  numClasses: number,
  options: SoftmaxTrainOptions = {}
): SoftmaxModel {
  if (features.length === 0 || features.length !== labels.length)
    throw new Error('softmax_dataset_mismatch');
  if (!Number.isInteger(numClasses) || numClasses < 2) throw new Error('invalid_num_classes');
  const width = features[0]!.length;
  if (width === 0) throw new Error('empty_feature_row');
  validateMatrix(features, width);
  for (const label of labels) {
    if (!Number.isInteger(label) || label < 0 || label >= numClasses)
      throw new Error('label_out_of_range');
  }
  const epochs = options.epochs ?? 60;
  const lr = options.learningRate ?? 0.1;
  const l2 = options.l2 ?? 0;
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 5000) throw new Error('invalid_epochs');
  if (!(lr > 0) || !Number.isFinite(lr)) throw new Error('invalid_learning_rate');

  const weights = Array.from({ length: numClasses }, () => new Array<number>(width).fill(0));
  const bias = new Array<number>(numClasses).fill(0);

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Sequential SGD over one example at a time (deterministic order).
    for (let i = 0; i < features.length; i++) {
      const row = features[i]!;
      const y = labels[i]!;
      const logits = weights.map((w, c) => w.reduce((s, x, j) => s + x * row[j]!, bias[c]!));
      const probs = softmax(logits);
      for (let c = 0; c < numClasses; c++) {
        const err = probs[c]! - (c === y ? 1 : 0);
        const wRow = weights[c]!;
        for (let j = 0; j < width; j++) wRow[j] = wRow[j]! - lr * (err * row[j]! + l2 * wRow[j]!);
        bias[c] = bias[c]! - lr * err;
      }
    }
  }
  const modelHash = hash({ numClasses, width, weights, bias });
  return { numClasses, numFeatures: width, weights, bias, modelHash };
}

export interface SoftmaxPrediction {
  label: number;
  probabilities: number[];
  margin: number;
}

export function predictSoftmax(model: SoftmaxModel, row: readonly number[]): SoftmaxPrediction {
  if (row.length !== model.numFeatures) throw new Error('feature_width_mismatch');
  if (row.some((v) => !Number.isFinite(v))) throw new Error('non_finite_feature');
  const logits = model.weights.map((w, c) =>
    w.reduce((s, x, j) => s + x * row[j]!, model.bias[c]!)
  );
  const probabilities = softmax(logits);
  let best = 0;
  for (let c = 1; c < probabilities.length; c++)
    if (probabilities[c]! > probabilities[best]!) best = c;
  const sorted = probabilities.slice().sort((a, b) => b - a);
  return { label: best, probabilities, margin: sorted[0]! - (sorted[1] ?? 0) };
}
