// state: draft | engine-generated
//
// Reversible feature preprocessing. Today the native learners consume raw
// numeric matrices; there is no fitted, invertible transform to standardize
// scales, encode categories, or impute gaps. Without these, gradient learners
// are scale-sensitive and prediction-time inputs drift silently. Deterministic
// and dependency-free; a fitted transform is a data contract, not authority.

export interface FittedScaler {
  readonly kind: 'standard' | 'minmax';
  readonly center: readonly number[];
  readonly scale: readonly number[];
  transform(row: readonly number[]): number[];
  inverse(row: readonly number[]): number[];
}

function assertMatrix(rows: readonly (readonly number[])[]): number {
  if (rows.length === 0) throw new Error('empty_matrix');
  const width = rows[0]!.length;
  if (width === 0) throw new Error('empty_feature_row');
  if (rows.some((row) => row.length !== width)) throw new Error('ragged_matrix');
  return width;
}

function columnStats(
  rows: readonly (readonly number[])[],
  width: number
): { mean: number[]; std: number[]; min: number[]; max: number[] } {
  const mean = new Array<number>(width).fill(0);
  const std = new Array<number>(width).fill(0);
  const min = new Array<number>(width).fill(Infinity);
  const max = new Array<number>(width).fill(-Infinity);
  for (let j = 0; j < width; j++) {
    let s = 0;
    let mn = Infinity;
    let mx = -Infinity;
    for (const row of rows) {
      const v = row[j]!;
      if (!Number.isFinite(v)) throw new Error('non_finite_value');
      s += v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    const m = s / rows.length;
    let variance = 0;
    for (const row of rows) variance += (row[j]! - m) ** 2;
    mean[j] = m;
    std[j] = Math.sqrt(variance / rows.length);
    min[j] = mn;
    max[j] = mx;
  }
  return { mean, std, min, max };
}

/** Zero-mean, unit-variance scaling per column. Constant columns map to 0 scale (guarded). */
export function fitStandardScaler(rows: readonly (readonly number[])[]): FittedScaler {
  const width = assertMatrix(rows);
  const { mean, std } = columnStats(rows, width);
  const scale = std.map((s) => (s === 0 ? 1 : s));
  return {
    kind: 'standard',
    center: mean,
    scale,
    transform: (row) => row.map((v, j) => (v - mean[j]!) / scale[j]!),
    inverse: (row) => row.map((v, j) => v * scale[j]! + mean[j]!),
  };
}

/** Scales each column to [0, 1]. Constant columns map to 0 deterministically. */
export function fitMinMaxScaler(rows: readonly (readonly number[])[]): FittedScaler {
  const width = assertMatrix(rows);
  const { min, max } = columnStats(rows, width);
  const range = max.map((mx, j) => mx - min[j]!);
  return {
    kind: 'minmax',
    center: min,
    scale: range.map((r) => (r === 0 ? 1 : r)),
    transform: (row) => row.map((v, j) => (v - min[j]!) / (range[j] === 0 ? 1 : range[j]!)),
    inverse: (row) => row.map((v, j) => v * range[j]! + min[j]!),
  };
}

export interface LabelEncoder {
  encode(value: string): number;
  decode(index: number): string;
  readonly classes: readonly string[];
}

/** Deterministic label encoding: classes ordered lexicographically. */
export function fitLabelEncoder(values: readonly string[]): LabelEncoder {
  const classes = [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const index = new Map<string, number>();
  classes.forEach((c, i) => index.set(c, i));
  return {
    classes,
    encode: (value) => {
      const i = index.get(value);
      if (i === undefined) throw new Error('unknown_label_class');
      return i;
    },
    decode: (i) => {
      const c = classes[i];
      if (c === undefined) throw new Error('unknown_label_index');
      return c;
    },
  };
}

/** One-hot encode a single categorical value against a fixed class list. */
export function oneHot(value: string, classes: readonly string[]): number[] {
  return classes.map((c) => (c === value ? 1 : 0));
}

/**
 * Impute non-finite (NaN/Infinity) entries column-wise with the mean (numeric)
 * or, when requested, the median. Returns a new matrix; never mutates input.
 */
export function imputeMissing(
  rows: readonly (readonly number[])[],
  strategy: 'mean' | 'median' = 'mean'
): number[][] {
  const width = assertMatrix(rows);
  const fills = new Array<number>(width).fill(0);
  for (let j = 0; j < width; j++) {
    const present = rows.map((row) => row[j]!).filter((v) => Number.isFinite(v));
    if (present.length === 0) throw new Error('column_fully_missing');
    if (strategy === 'mean') {
      fills[j] = present.reduce((a, b) => a + b, 0) / present.length;
    } else {
      const sorted = present.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      fills[j] = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
    }
  }
  return rows.map((row) => row.map((v, j) => (Number.isFinite(v) ? v : fills[j]!)));
}
