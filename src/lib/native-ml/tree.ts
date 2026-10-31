// state: draft | engine-generated
//
// Tree learners. Until now every native model was linear or centroid-based, so
// non-linear, axis-aligned decision boundaries had no representation and there
// was no feature-importance signal independent of coefficient magnitude. CART
// (Gini) plus a seeded random forest (bootstrap + feature subsampling) fill
// that gap. Deterministic under a fixed seed. Capability, not authority.

import { createHash } from 'node:crypto';
import { mulberry32, type Rng } from './prng';

export interface TreeNode {
  leaf: boolean;
  /** Class label when leaf; majority class of the training node. */
  prediction?: number;
  /** Class -> empirical probability at this leaf. */
  classProbs?: Record<number, number>;
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

export interface TreeOptions {
  maxDepth?: number;
  minSamplesSplit?: number;
  minSamplesLeaf?: number;
  featureSubset?: number;
}

function classCounts(labels: readonly number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const l of labels) m.set(l, (m.get(l) ?? 0) + 1);
  return m;
}

function gini(labels: readonly number[]): number {
  if (labels.length === 0) return 0;
  const counts = classCounts(labels);
  let sumSq = 0;
  for (const c of counts.values()) sumSq += (c / labels.length) ** 2;
  return 1 - sumSq;
}

function majority(labels: readonly number[]): number {
  const counts = classCounts(labels);
  let best = labels[0]!;
  let bestN = -1;
  for (const [label, n] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (n > bestN) {
      best = label;
      bestN = n;
    }
  }
  return best;
}

function leafNode(labels: readonly number[]): TreeNode {
  const counts = classCounts(labels);
  const classProbs: Record<number, number> = {};
  for (const [label, n] of counts.entries()) classProbs[label] = n / labels.length;
  return { leaf: true, prediction: majority(labels), classProbs };
}

function candidateSplits(values: readonly number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const thresholds: number[] = [];
  for (let i = 1; i < sorted.length; i++) thresholds.push((sorted[i - 1]! + sorted[i]!) / 2);
  return thresholds;
}

function buildNode(
  features: readonly (readonly number[])[],
  labels: readonly number[],
  indices: number[],
  depth: number,
  opts: Required<TreeOptions>,
  rng: Rng
): TreeNode {
  const current = indices.filter((i) => i >= 0);
  const curLabels = current.map((i) => labels[i]!);
  if (curLabels.length <= opts.minSamplesSplit || depth >= opts.maxDepth || gini(curLabels) === 0) {
    return leafNode(curLabels);
  }
  const numFeatures = features[0]!.length;
  const featureOrder = Array.from({ length: numFeatures }, (_, j) => j);
  // Deterministic feature subsample (mtry) for forest decorrelation.
  const chosen: number[] = [];
  if (opts.featureSubset >= numFeatures) {
    chosen.push(...featureOrder);
  } else {
    const pool = featureOrder.slice();
    for (let k = 0; k < opts.featureSubset && pool.length > 0; k++) {
      const pick = Math.floor(rng() * pool.length);
      chosen.push(pool[pick]!);
      pool.splice(pick, 1);
    }
  }
  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  const parentGini = gini(curLabels);
  for (const f of chosen) {
    const vals = current.map((i) => features[i]![f]!);
    for (const t of candidateSplits(vals)) {
      const leftLabels: number[] = [];
      const rightLabels: number[] = [];
      for (let p = 0; p < current.length; p++) {
        if (vals[p]! <= t) leftLabels.push(curLabels[p]!);
        else rightLabels.push(curLabels[p]!);
      }
      if (leftLabels.length < opts.minSamplesLeaf || rightLabels.length < opts.minSamplesLeaf)
        continue;
      const weighted =
        (leftLabels.length / curLabels.length) * gini(leftLabels) +
        (rightLabels.length / curLabels.length) * gini(rightLabels);
      const gain = parentGini - weighted;
      if (gain > bestGain + 1e-12) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = t;
      }
    }
  }
  if (bestFeature < 0) return leafNode(curLabels);
  const leftIdx: number[] = [];
  const rightIdx: number[] = [];
  for (const i of current) {
    if (features[i]![bestFeature]! <= bestThreshold) leftIdx.push(i);
    else rightIdx.push(i);
  }
  return {
    leaf: false,
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildNode(features, labels, leftIdx, depth + 1, opts, rng),
    right: buildNode(features, labels, rightIdx, depth + 1, opts, rng),
  };
}

function normalizeTreeOptions(opts: TreeOptions, numFeatures: number): Required<TreeOptions> {
  const featureSubset = opts.featureSubset ?? Math.max(1, Math.round(Math.sqrt(numFeatures)));
  return {
    maxDepth: opts.maxDepth ?? 12,
    minSamplesSplit: opts.minSamplesSplit ?? 2,
    minSamplesLeaf: opts.minSamplesLeaf ?? 1,
    featureSubset,
  };
}

export function trainDecisionTree(
  features: readonly (readonly number[])[],
  labels: readonly number[],
  options: TreeOptions = {},
  seed = 1
): TreeNode {
  if (features.length === 0 || features.length !== labels.length)
    throw new Error('tree_dataset_mismatch');
  const width = features[0]!.length;
  if (width === 0) throw new Error('empty_feature_row');
  if (features.some((row) => row.length !== width || row.some((v) => !Number.isFinite(v))))
    throw new Error('invalid_feature_matrix');
  if (labels.some((l) => !Number.isInteger(l) || l < 0)) throw new Error('invalid_label');
  const opts = normalizeTreeOptions(
    { ...options, featureSubset: options.featureSubset ?? width },
    width
  );
  const rng = mulberry32(seed >>> 0);
  const indices = Array.from({ length: features.length }, (_, i) => i);
  return buildNode(features, labels, indices, 0, opts, rng);
}

function walk(node: TreeNode, row: readonly number[]): TreeNode {
  let cur = node;
  while (!cur.leaf) {
    const value = row[cur.feature!]!;
    cur = (value <= cur.threshold! ? cur.left : cur.right)!;
  }
  return cur;
}

export function predictTree(node: TreeNode, row: readonly number[]): number {
  return walk(node, row).prediction!;
}

export interface RandomForestModel {
  readonly trees: TreeNode[];
  readonly numClasses: number;
  readonly modelHash: string;
}

export interface ForestOptions extends TreeOptions {
  trees?: number;
}

export function trainRandomForest(
  features: readonly (readonly number[])[],
  labels: readonly number[],
  options: ForestOptions = {},
  seed = 1
): RandomForestModel {
  if (features.length === 0 || features.length !== labels.length)
    throw new Error('forest_dataset_mismatch');
  const width = features[0]!.length;
  const nTrees = options.trees ?? 15;
  if (!Number.isInteger(nTrees) || nTrees < 1 || nTrees > 500)
    throw new Error('invalid_tree_count');
  const opts = normalizeTreeOptions(options, width);
  const rng = mulberry32(seed >>> 0);
  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    // Bootstrap sample with replacement (bagging).
    const idx: number[] = [];
    for (let i = 0; i < features.length; i++) idx.push(Math.floor(rng() * features.length));
    trees.push(buildNode(features, labels, idx, 0, opts, rng));
  }
  const numClasses = new Set(labels).size;
  const modelHash = createHash('sha256')
    .update(JSON.stringify({ nTrees, width, numClasses, seed }))
    .digest('hex');
  return { trees, numClasses, modelHash };
}

export function predictForest(
  model: RandomForestModel,
  row: readonly number[]
): { label: number; probabilities: Record<number, number> } {
  if (model.trees.length === 0) throw new Error('empty_forest');
  const acc = new Map<number, number>();
  for (const tree of model.trees) {
    const leaf = walk(tree, row);
    for (const [cls, p] of Object.entries(leaf.classProbs ?? {})) {
      acc.set(Number(cls), (acc.get(Number(cls)) ?? 0) + p);
    }
  }
  const probabilities: Record<number, number> = {};
  let best = -1;
  let bestVal = -1;
  for (const [cls, sum] of [...acc.entries()].sort((a, b) => a[0] - b[0])) {
    const avg = sum / model.trees.length;
    probabilities[cls] = avg;
    if (avg > bestVal) {
      bestVal = avg;
      best = cls;
    }
  }
  return { label: best, probabilities };
}
