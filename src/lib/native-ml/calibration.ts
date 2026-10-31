// state: draft | engine-generated
//
// Probability calibration. Raw scores from logistic and softmax learners are
// not reliable probabilities; downstream governance and risk thresholds depend
// on them, so uncalibrated confidence is dangerous. This adds Platt scaling
// (binary) and temperature scaling (multiclass), fit by gradient descent on a
// held-out set. Calibrated confidence is still a capability, not a guarantee.

export interface PlattCalibrator {
  readonly a: number;
  readonly b: number;
  /** Map a raw score/logit to a calibrated probability. */
  calibrate(score: number): number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-clamp(x, -40, 40)));
}

/**
 * Fit Platt scaling p = sigmoid(a*logit + b) on held-out scores/labels by
 * gradient descent on cross-entropy. Deterministic; no RNG.
 */
export function fitPlattScaling(
  scores: readonly number[],
  labels: readonly number[],
  options: { iters?: number; lr?: number } = {}
): PlattCalibrator {
  if (scores.length === 0 || scores.length !== labels.length)
    throw new Error('calibration_length_mismatch');
  if (scores.some((s) => !Number.isFinite(s))) throw new Error('non_finite_score');
  const n = scores.length;
  let pos = 0;
  for (const label of labels) {
    if (label !== 0 && label !== 1) throw new Error('binary_label_required');
    if (label === 1) pos++;
  }
  if (pos === 0 || pos === n) throw new Error('calibration_requires_both_classes');
  const iters = options.iters ?? 500;
  const lr = options.lr ?? 0.1;
  // Target probabilities with Laplace smoothing (Lin's heuristic).
  const hi = (n + 1) / (n + 2);
  const lo = 1 / (n + 2);
  const targets = labels.map((l) => (l === 1 ? hi : lo));
  let a = 0;
  let b = 0;
  for (let it = 0; it < iters; it++) {
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(a * scores[i]! + b);
      const err = p - targets[i]!;
      ga += err * scores[i]!;
      gb += err;
    }
    a -= (lr * ga) / n;
    b -= (lr * gb) / n;
  }
  return { a, b, calibrate: (score) => sigmoid(a * score + b) };
}

export interface TemperatureCalibrator {
  readonly temperature: number;
  /** Rescale class logits by 1/T then softmax. T>1 softens, T<1 sharpens. */
  calibrate(logits: readonly number[]): number[];
}

/**
 * Fit a single temperature T by gradient descent on negative log-likelihood of
 * true labels over held-out logits. Multiclass (label index per example).
 */
export function fitTemperatureScaling(
  logits: readonly (readonly number[])[],
  labels: readonly number[],
  options: { iters?: number; lr?: number } = {}
): TemperatureCalibrator {
  if (logits.length === 0 || logits.length !== labels.length)
    throw new Error('calibration_length_mismatch');
  const classes = logits[0]!.length;
  if (classes < 2) throw new Error('temperature_requires_classes');
  if (logits.some((row) => row.length !== classes || row.some((v) => !Number.isFinite(v))))
    throw new Error('invalid_logits');
  const iters = options.iters ?? 300;
  const lr = options.lr ?? 0.05;
  let temp = 1;
  for (let it = 0; it < iters; it++) {
    let grad = 0;
    for (let i = 0; i < logits.length; i++) {
      const y = labels[i]!;
      if (!Number.isInteger(y) || y < 0 || y >= classes) throw new Error('label_out_of_range');
      const scaled = logits[i]!.map((z) => z / temp);
      const max = Math.max(...scaled);
      const exps = scaled.map((z) => Math.exp(clamp(z - max, -40, 40)));
      const sum = exps.reduce((s, e) => s + e, 0) || 1;
      const pTrue = exps[y]! / sum;
      grad += -(logits[i]![y]! / (temp * temp)) * (1 - pTrue);
    }
    temp = clamp(temp - (lr * grad) / logits.length, 0.05, 20);
  }
  return {
    temperature: temp,
    calibrate: (row) => {
      const scaled = row.map((z) => z / temp);
      const max = Math.max(...scaled);
      const exps = scaled.map((z) => Math.exp(clamp(z - max, -40, 40)));
      const sum = exps.reduce((s, e) => s + e, 0) || 1;
      return exps.map((e) => e / sum);
    },
  };
}

/**
 * Expected Calibration Error: bins predictions by confidence and measures the
 * weighted gap between average confidence and empirical accuracy.
 */
export function expectedCalibrationError(
  probabilities: readonly number[],
  labels: readonly number[],
  bins = 10
): number {
  if (probabilities.length === 0 || probabilities.length !== labels.length)
    throw new Error('ece_length_mismatch');
  if (probabilities.some((p) => p < 0 || p > 1 || !Number.isFinite(p)))
    throw new Error('probability_out_of_range');
  const totals = new Array<number>(bins).fill(0);
  const confSums = new Array<number>(bins).fill(0);
  const accSums = new Array<number>(bins).fill(0);
  for (let i = 0; i < probabilities.length; i++) {
    const idx = Math.min(bins - 1, Math.floor(probabilities[i]! * bins));
    totals[idx]!++;
    confSums[idx]! += probabilities[i]!;
    accSums[idx]! += labels[i] === 1 ? 1 : 0;
  }
  let ece = 0;
  const n = probabilities.length;
  for (let b = 0; b < bins; b++) {
    if (totals[b] === 0) continue;
    const avgConf = confSums[b]! / totals[b]!;
    const avgAcc = accSums[b]! / totals[b]!;
    ece += (totals[b]! / n) * Math.abs(avgConf - avgAcc);
  }
  return ece;
}
