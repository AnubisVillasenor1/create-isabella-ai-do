// state: draft | engine-generated
//
// Distribution-drift detectors. The governed ML module currently flags drift by
// mean shift alone, which misses shape changes (variance, skew, multimodality)
// that keep the mean stable. These three complementary statistics — a two-sample
// Kolmogorov–Smirnov test, Population Stability Index and Jensen–Shannon
// divergence — detect those cases deterministically. A drift signal is a reason
// for human review, not an automatic retrain or rollback.

export interface KsResult {
  statistic: number;
  pValue: number;
  drifted: boolean;
}

function ecdf(sorted: readonly number[], x: number): number {
  // fraction of samples <= x via binary search.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo / sorted.length;
}

/**
 * Two-sample Kolmogorov–Smirnov test (asymptotic p-value). `alpha` is the
 * significance level below which we declare drift. Deterministic, no RNG.
 */
export function ksTwoSample(a: readonly number[], b: readonly number[], alpha = 0.05): KsResult {
  if (a.length === 0 || b.length === 0) throw new Error('ks_requires_samples');
  if ([...a, ...b].some((v) => !Number.isFinite(v))) throw new Error('non_finite_value');
  const sa = a.slice().sort((x, y) => x - y);
  const sb = b.slice().sort((x, y) => x - y);
  const all = [...new Set([...sa, ...sb])].sort((x, y) => x - y);
  let d = 0;
  for (const x of all) {
    const diff = Math.abs(ecdf(sa, x) - ecdf(sb, x));
    if (diff > d) d = diff;
  }
  const ne = (a.length * b.length) / (a.length + b.length);
  if (d === 0) return { statistic: 0, pValue: 1, drifted: false };
  const lam = (Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne)) * d;
  // Kolmogorov distribution survival function (Q_KS) via series expansion.
  let sum = 0;
  for (let k = 1; k <= 100; k++) sum += (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * lam * lam);
  const pValue = Math.max(0, Math.min(1, 2 * sum));
  return { statistic: d, pValue, drifted: pValue < alpha };
}

/**
 * Population Stability Index between reference and current buckets. Uses the
 * reference quantiles as bin edges. PSI thresholds: <0.1 stable, 0.1–0.25
 * moderate, >0.25 significant.
 */
export function populationStabilityIndex(
  reference: readonly number[],
  current: readonly number[],
  bins = 10
): { psi: number; level: 'stable' | 'moderate' | 'significant' } {
  if (reference.length === 0 || current.length === 0) throw new Error('psi_requires_samples');
  if (!Number.isInteger(bins) || bins < 2) throw new Error('invalid_bins');
  if ([...reference, ...current].some((v) => !Number.isFinite(v)))
    throw new Error('non_finite_value');
  const sorted = reference.slice().sort((x, y) => x - y);
  const edges: number[] = [];
  for (let i = 1; i < bins; i++) {
    const q = sorted[Math.floor((i / bins) * sorted.length)]!;
    if (edges.length === 0 || q > edges[edges.length - 1]!) edges.push(q);
  }
  const bucketOf = (x: number): number => {
    let idx = 0;
    while (idx < edges.length && x > edges[idx]!) idx++;
    return idx;
  };
  const refCounts = new Array<number>(edges.length + 1).fill(0);
  const curCounts = new Array<number>(edges.length + 1).fill(0);
  for (const v of reference) refCounts[bucketOf(v)]!++;
  for (const v of current) curCounts[bucketOf(v)]!++;
  let psi = 0;
  const eps = 1e-6;
  for (let i = 0; i < refCounts.length; i++) {
    const r = Math.max(refCounts[i]! / reference.length, eps);
    const c = Math.max(curCounts[i]! / current.length, eps);
    psi += (c - r) * Math.log(c / r);
  }
  const level = psi > 0.25 ? 'significant' : psi >= 0.1 ? 'moderate' : 'stable';
  return { psi, level };
}

/**
 * Jensen–Shannon divergence (base 2) between two discrete distributions over a
 * shared support; symmetric and bounded in [0, 1].
 */
export function jensenShannon(p: readonly number[], q: readonly number[]): number {
  if (p.length === 0 || p.length !== q.length) throw new Error('js_length_mismatch');
  const norm = (v: readonly number[]): number[] => {
    if (v.some((x) => x < 0 || !Number.isFinite(x))) throw new Error('invalid_distribution');
    const s = v.reduce((a, b) => a + b, 0);
    if (s === 0) throw new Error('zero_mass_distribution');
    return v.map((x) => x / s);
  };
  const pn = norm(p);
  const qn = norm(q);
  const kl = (a: readonly number[], b: readonly number[]): number => {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const ai = a[i]!;
      if (ai > 0) s += ai * Math.log2(ai / (b[i]! || 1e-12));
    }
    return s;
  };
  const m = pn.map((x, i) => (x + qn[i]!) / 2);
  return (kl(pn, m) + kl(qn, m)) / 2;
}
