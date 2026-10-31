/**
 * GAME OVER RiskEngine (UAGP-1).
 *
 * Maps declared criticality and capability count to a bounded heuristic score.
 * Invalid runtime input is treated as CRITICAL so malformed values cannot
 * lower the required controls. Scores are not measured probabilities.
 */
import { GAMEOVER_CONSTITUTION, riskLevelFor } from './constitution';
import type { RiskAssessment, RiskLevel } from './types';

const RISK_LEVELS: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface RiskInput {
  readonly criticality?: RiskLevel;
  readonly capabilityCount?: number;
}

/** Bounded risk score (0..1) + level for a governed action. */
export function assessRisk(input: RiskInput = {}): RiskAssessment {
  const requestedCriticality: unknown = input?.criticality;
  const criticality: RiskLevel =
    requestedCriticality === undefined
      ? 'MEDIUM'
      : RISK_LEVELS.includes(requestedCriticality as RiskLevel)
        ? (requestedCriticality as RiskLevel)
        : 'CRITICAL';

  const requestedCount = input?.capabilityCount;
  const capabilityCount =
    typeof requestedCount === 'number' && Number.isFinite(requestedCount)
      ? Math.min(10_000, Math.max(0, Math.trunc(requestedCount)))
      : requestedCount === undefined
        ? 0
        : 10_000;

  const base = GAMEOVER_CONSTITUTION.riskBaseByCriticality[criticality];
  const penalty = Math.min(
    GAMEOVER_CONSTITUTION.capabilityPenaltyCap,
    capabilityCount * GAMEOVER_CONSTITUTION.capabilityPenaltyPerItem
  );
  const score = Math.round(clamp01(base + penalty) * 100) / 100;
  const level = riskLevelFor(score);
  return Object.freeze({
    score,
    level,
    criticality,
    capabilityCount,
    summary: `risk=${score} (${level}) from criticality ${criticality} + ${capabilityCount} capabilities`,
  });
}
