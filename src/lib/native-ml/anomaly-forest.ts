// state: draft | engine-generated
//
// Multivariate anomaly detection. The native core only has a per-column z-score
// detector, which fails when anomalies are joint (normal on every axis, bizarre
// in combination) and when the training data itself is contaminated. Isolation
// Forest isolates points by random recursive partitioning — anomalies need fewer
// splits — and robust MAD z-scores resist outliers. Deterministic under a seed.

import { createHash } from 'node:crypto';
import { mulberry32, randInt, type Rng } from './prng';

export interface IsolationTree {
  leaf: boolean;
  size: number;
  feature?: number;
  value?: number;
  left?: IsolationTree;
  right?: IsolationTree;
}

export interface IsolationForestModel {
  readonly trees: IsolationTree[];
  readonly numFeatures: number;
  readonly sampleSize: number;
  readonly modelHash: string;
}

const DEFAULT_HEIGHT = 8;

function buildITree(
  rows: readonly (readonly number[])[],
  depth: number,
  maxDepth: number,
  rng: Rng
): IsolationTree {
  if (depth >= maxDepth || rows.length <= 1) {
    return { leaf: true, size: rows.length };
  }
  const width = rows[0]!.length;
  const feature = randInt(rng, 0, width - 1);
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const v = row[feature]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return { leaf: true, size: rows.length };
  const value = min + rng() * (max - min);
  const leftRows: (readonly number[])[] = [];
  const rightRows: (readonly number[])[] = [];
  for (const row of rows) (row[feature]! < value ? leftRows : rightRows).push(row);
  return {
    leaf: false,
    size: rows.length,
    feature,
    value,
    left: buildITree(leftRows, depth + 1, maxDepth, rng),
    right: buildITree(rightRows, depth + 1, maxDepth, rng),
  };
}

/** Average path length of unsuccessful BST search, used to normalize depth. */
function harmonic(n: number): number {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

function pathLength(node: IsolationTree, row: readonly number[], depth: number): number {
  let cur = node;
  let d = depth;
  while (!cur.leaf) {
    cur = (row[cur.feature!]! < cur.value! ? cur.left : cur.right)!;
    d++;
  }
  return d + harmonic(cur.size);
}

export function trainIsolationForest(
  features: readonly (readonly number[])[],
  options: { trees?: number; sampleSize?: number } = {},
  seed = 42
): IsolationForestModel {
  if (features.length === 0) throw new Error('empty_dataset');
  const width = features[0]!.length;
  if (width === 0) throw new Error('empty_feature_row');
  if (features.some((row) => row.length !== width || row.some((v) => !Number.isFinite(v))))
    throw new Error('invalid_feature_matrix');
  const nTrees = options.trees ?? 64;
  const sampleSize = Math.min(options.sampleSize ?? 256, features.length);
  if (sampleSize < 2) throw new Error('insufficient_samples');
  const rng = mulberry32(seed >>> 0);
  const trees: IsolationTree[] = [];
  for (let t = 0; t < nTrees; t++) {
    const sample: (readonly number[])[] = [];
    for (let i = 0; i < sampleSize; i++)
      sample.push(features[randInt(rng, 0, features.length - 1)]!);
    trees.push(buildITree(sample, 0, Math.ceil(Math.log2(sampleSize)) + DEFAULT_HEIGHT, rng));
  }
  const modelHash = createHash('sha256')
    .update(JSON.stringify({ nTrees, sampleSize, width, seed }))
    .digest('hex');
  return { trees, numFeatures: width, sampleSize, modelHash };
}

/**
 * Anomaly score in [0, 1]; ~0.5 is normal, values approaching 1 are anomalous.
 */
export function isolationScore(model: IsolationForestModel, row: readonly number[]): number {
  if (row.length !== model.numFeatures) throw new Error('feature_width_mismatch');
  if (row.some((v) => !Number.isFinite(v))) throw new Error('non_finite_feature');
  const avg =
    model.trees.reduce((sum, tree) => sum + pathLength(tree, row, 0), 0) / model.trees.length;
  const c = harmonic(model.sampleSize);
  if (c === 0) return 0.5;
  return Math.pow(2, -avg / c);
}

export interface RobustAnomaly {
  index: number;
  score: number;
  isAnomaly: boolean;
}

/**
 * Robust univariate outlier detection via median absolute deviation (MAD). The
 * modified z-score uses 0.6745 (the 0.75 quantile of N(0,1)) so a threshold of
 * 3.5 follows the Iglewicz–Hoaglin convention. Resists masking by outliers.
 */
export function robustMadtected(values: readonly number[], threshold = 3.5): RobustAnomaly[] {
  if (values.length === 0) throw new Error('empty_series');
  if (values.some((v) => !Number.isFinite(v))) throw new Error('non_finite_value');
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  const devs = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const dmid = Math.floor(devs.length / 2);
  const mad = devs.length % 2 === 0 ? (devs[dmid - 1]! + devs[dmid]!) / 2 : devs[dmid]!;
  const scale = mad === 0 ? 1e-12 : mad / 0.6745;
  return values.map((v, index) => {
    const score = (v - median) / scale;
    return { index, score, isAnomaly: Math.abs(score) > threshold };
  });
}
