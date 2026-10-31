// state: draft | engine-generated
//
// Group-fairness diagnostics. governed-ml already reports disparate impact, but
// that single ratio cannot see differences in error balance across groups. This
// adds demographic parity difference, equalized-odds gaps (TPR and FPR) and a
// per-group calibration check. These are audit signals for a human reviewer: a
// fair metric is not a fairness guarantee, and passing a threshold is not
// authority to deploy.

export interface GroupSample {
  label: 0 | 1;
  prediction: 0 | 1;
  score: number;
  group: string;
}

function assertBinary(s: number, kind: 'label' | 'prediction'): void {
  if (s !== 0 && s !== 1) throw new Error(`non_binary_${kind}`);
}

function byGroup(samples: readonly GroupSample[]): Map<string, GroupSample[]> {
  if (samples.length === 0) throw new Error('empty_fairness_sample');
  const map = new Map<string, GroupSample[]>();
  for (const s of samples) {
    assertBinary(s.label, 'label');
    assertBinary(s.prediction, 'prediction');
    if (!Number.isFinite(s.score) || s.score < 0 || s.score > 1)
      throw new Error('score_out_of_range');
    if (!s.group) throw new Error('group_required');
    const bucket = map.get(s.group) ?? [];
    bucket.push(s);
    map.set(s.group, bucket);
  }
  return map;
}

function positiveRate(group: readonly GroupSample[]): number {
  const pos = group.reduce((s, x) => s + (x.prediction === 1 ? 1 : 0), 0);
  return group.length === 0 ? 0 : pos / group.length;
}

function tpr(group: readonly GroupSample[]): number {
  const truthy = group.filter((g) => g.label === 1);
  if (truthy.length === 0) return NaN;
  return truthy.reduce((s, g) => s + (g.prediction === 1 ? 1 : 0), 0) / truthy.length;
}

function fpr(group: readonly GroupSample[]): number {
  const falsy = group.filter((g) => g.label === 0);
  if (falsy.length === 0) return NaN;
  return falsy.reduce((s, g) => s + (g.prediction === 1 ? 1 : 0), 0) / falsy.length;
}

export interface GroupParity {
  /** Max minus min selection rate across groups. */
  demographicParityDifference: number;
  /** Min / max selection rate (the "disparate impact ratio" convention). */
  impactRatio: number;
  perGroup: Record<string, number>;
}

export function demographicParity(samples: readonly GroupSample[]): GroupParity {
  const groups = byGroup(samples);
  const perGroup: Record<string, number> = {};
  const rates: number[] = [];
  for (const [g, arr] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const r = positiveRate(arr);
    perGroup[g] = r;
    rates.push(r);
  }
  const max = Math.max(...rates);
  const min = Math.min(...rates);
  return {
    demographicParityDifference: max - min,
    impactRatio: max === 0 ? 1 : min / max,
    perGroup,
  };
}

export interface EqualizedOdds {
  tprGap: number;
  fprGap: number;
  /** True when any group lacks the positives/negatives needed to compute a rate. */
  partial: boolean;
  perGroup: Record<string, { tpr: number; fpr: number }>;
}

export function equalizedOdds(samples: readonly GroupSample[]): EqualizedOdds {
  const groups = byGroup(samples);
  const perGroup: Record<string, { tpr: number; fpr: number }> = {};
  let partial = false;
  const tprs: number[] = [];
  const fprs: number[] = [];
  for (const [g, arr] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const t = tpr(arr);
    const f = fpr(arr);
    perGroup[g] = { tpr: t, fpr: f };
    if (Number.isNaN(t) || Number.isNaN(f)) partial = true;
    else {
      tprs.push(t);
      fprs.push(f);
    }
  }
  const tprGap = tprs.length >= 2 ? Math.max(...tprs) - Math.min(...tprs) : 0;
  const fprGap = fprs.length >= 2 ? Math.max(...fprs) - Math.min(...fprs) : 0;
  return { tprGap, fprGap, partial, perGroup };
}

export interface GroupCalibrationRow {
  group: string;
  meanScore: number;
  observedRate: number;
  gap: number;
}

/**
 * Per-group calibration: mean predicted score versus observed positive rate. A
 * large gap flags that a threshold tuned on one group mis-estimates another.
 */
export function calibrationByGroup(samples: readonly GroupSample[]): GroupCalibrationRow[] {
  const groups = byGroup(samples);
  const rows: GroupCalibrationRow[] = [];
  for (const [g, arr] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const meanScore = arr.reduce((s, x) => s + x.score, 0) / arr.length;
    const observedRate = arr.reduce((s, x) => s + (x.label === 1 ? 1 : 0), 0) / arr.length;
    rows.push({ group: g, meanScore, observedRate, gap: Math.abs(meanScore - observedRate) });
  }
  return rows;
}
