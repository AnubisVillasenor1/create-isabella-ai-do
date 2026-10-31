/**
 * GAME OVER CognitiveCourt (UAGP-1).
 *
 * Adjudicates a request from ethics, trust and risk signals. state: draft |
 * engine-generated. It emits a decision and its rationale; it does not execute,
 * and ESCALATE always means "route to human authority".
 */
import { GAMEOVER_CONSTITUTION } from './constitution';
import type { DecisionOutcome, RiskLevel } from './types';

export interface CourtInput {
  readonly ethicsPassed: boolean;
  readonly riskLevel: RiskLevel;
  readonly trustScore: number;
}

export interface CourtVerdict {
  readonly outcome: DecisionOutcome;
  readonly rationale: readonly string[];
}

export function adjudicate(input: CourtInput): CourtVerdict {
  const rationale: string[] = [];
  const { criticalTrustFloor, highRiskTrustFloor } = GAMEOVER_CONSTITUTION.court;

  if (!input.ethicsPassed) {
    rationale.push('ETHICS_VIOLATION');
    return Object.freeze({ outcome: 'REJECT', rationale: Object.freeze(rationale) });
  }

  if (input.riskLevel === 'CRITICAL' && input.trustScore < criticalTrustFloor) {
    rationale.push('CRITICAL_RISK_LOW_TRUST');
    return Object.freeze({ outcome: 'ESCALATE', rationale: Object.freeze(rationale) });
  }

  if (input.riskLevel === 'HIGH' && input.trustScore < highRiskTrustFloor) {
    rationale.push('HIGH_RISK_INSUFFICIENT_TRUST');
    return Object.freeze({ outcome: 'REJECT', rationale: Object.freeze(rationale) });
  }

  rationale.push('ETHICS_PASSED', `RISK_${input.riskLevel}_WITHIN_TRUST_FLOOR`);
  return Object.freeze({ outcome: 'ACCEPT', rationale: Object.freeze(rationale) });
}
