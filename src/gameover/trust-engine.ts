/**
 * GAME OVER TrustEngine (UAGP-1).
 *
 * Computes a weighted trust score from declared metrics. state: draft |
 * engine-generated. The weights come from the constitution; the resulting score
 * is a declared heuristic, not measured accuracy.
 */
import { GAMEOVER_CONSTITUTION } from './constitution';
import type { TrustMetrics, TrustScorecard } from './types';

function clampMetric(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function classify(score: number): TrustScorecard['level'] {
  const t = GAMEOVER_CONSTITUTION.trustLevelThresholds;
  if (score >= t.exemplary) return 'EXEMPLARY';
  if (score >= t.high) return 'HIGH';
  if (score >= t.moderate) return 'MODERATE';
  if (score >= t.low) return 'LOW';
  return 'UNTRUSTED';
}

/** Weighted trust scorecard from declared 0..100 metrics (missing => 0). */
export function scoreTrust(metrics: Partial<TrustMetrics>): TrustScorecard {
  const resolved: TrustMetrics = {
    integrity: clampMetric(metrics.integrity),
    competence: clampMetric(metrics.competence),
    alignment: clampMetric(metrics.alignment),
    transparency: clampMetric(metrics.transparency),
    humanOversight: clampMetric(metrics.humanOversight),
    incidentRecord: clampMetric(metrics.incidentRecord),
  };
  const weights = GAMEOVER_CONSTITUTION.trustWeights;
  const weighted =
    resolved.integrity * weights.integrity +
    resolved.competence * weights.competence +
    resolved.alignment * weights.alignment +
    resolved.transparency * weights.transparency +
    resolved.humanOversight * weights.humanOversight +
    resolved.incidentRecord * weights.incidentRecord;
  const score = Math.round(weighted * 100) / 100;
  const level = classify(score);
  return Object.freeze({
    score,
    metrics: Object.freeze(resolved),
    level,
    summary: `trust=${score}/100 (${level}) over declared weights; not measured accuracy`,
  });
}
