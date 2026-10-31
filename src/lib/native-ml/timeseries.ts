// state: draft | engine-generated
//
// Native time-series forecasting. The platform lists 'timeseries' as a target
// capability but ships no forecaster, so trend/level reasoning had to be
// outsourced. These are the two foundational exponential-smoothing methods —
// simple exponential smoothing and Holt's linear trend — plus a residual-based
// prediction interval. Deterministic and dependency-free; forecast ≠ fact.

export interface SesModel {
  readonly alpha: number;
  readonly level: number;
  readonly sse: number;
  readonly n: number;
}

/** Simple Exponential Smoothing for a series with no trend/seasonality. */
export function fitSes(values: readonly number[], alpha?: number): SesModel {
  if (values.length === 0) throw new Error('empty_series');
  if (values.some((v) => !Number.isFinite(v))) throw new Error('non_finite_value');
  const a = alpha ?? estimateAlpha(values);
  if (!(a > 0 && a < 1)) throw new Error('invalid_alpha');
  let level = values[0]!;
  let sse = 0;
  for (let i = 1; i < values.length; i++) {
    const err = values[i]! - level;
    sse += err * err;
    level = level + a * err;
  }
  return { alpha: a, level, sse, n: values.length };
}

export interface HoltModel {
  readonly alpha: number;
  readonly beta: number;
  readonly level: number;
  readonly trend: number;
  readonly sse: number;
}

/** Holt's linear (double) exponential smoothing: level + trend components. */
export function fitHolt(values: readonly number[], alpha = 0.4, beta = 0.2): HoltModel {
  if (values.length < 2) throw new Error('holt_requires_two_points');
  if (values.some((v) => !Number.isFinite(v))) throw new Error('non_finite_value');
  if (!(alpha > 0 && alpha < 1) || !(beta > 0 && beta < 1)) throw new Error('invalid_smoothing');
  let level = values[0]!;
  let trend = values[1]! - values[0]!;
  let sse = 0;
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i]! + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    const forecast = prevLevel + trend;
    const err = values[i]! - forecast;
    sse += err * err;
  }
  return { alpha, beta, level, trend, sse };
}

/** h-step-ahead point forecasts from a Holt model. */
export function holtForecast(model: HoltModel, horizon: number): number[] {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 1000)
    throw new Error('invalid_horizon');
  return Array.from({ length: horizon }, (_, h) => model.level + (h + 1) * model.trend);
}

/**
 * One-step residual standard deviation, used to attach a nominal interval to a
 * forecast. This is an empirical dispersion estimate, not a coverage guarantee.
 */
export function residualStd(values: readonly number[], forecasts: readonly number[]): number {
  if (values.length === 0 || values.length !== forecasts.length)
    throw new Error('residual_length_mismatch');
  let sse = 0;
  for (let i = 0; i < values.length; i++) sse += (values[i]! - forecasts[i]!) ** 2;
  return Math.sqrt(sse / values.length);
}

/** Grid alpha over a fixed set and keep the one minimizing one-step SSE. */
function estimateAlpha(values: readonly number[]): number {
  const candidates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  let best = 0.3;
  let bestSse = Infinity;
  for (const a of candidates) {
    let level = values[0]!;
    let sse = 0;
    for (let i = 1; i < values.length; i++) {
      const err = values[i]! - level;
      sse += err * err;
      level = level + a * err;
    }
    if (sse < bestSse) {
      bestSse = sse;
      best = a;
    }
  }
  return best;
}
