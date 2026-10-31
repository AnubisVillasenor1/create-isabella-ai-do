/**
 * GAME OVER ExplainabilityEngine (UAGP-1).
 *
 * Produces a deterministic, human-readable rationale for a governance outcome.
 * state: draft | engine-generated. No natural-language model is invoked; the
 * text is assembled from the decision's own fields.
 */
import type { DecisionOutcome, RiskLevel } from './types';

export interface ExplanationInput {
  readonly outcome: DecisionOutcome;
  readonly rationale: readonly string[];
  readonly trustScore: number;
  readonly riskLevel: RiskLevel;
  readonly ethicsPassed: boolean;
  readonly humanApprovalRequired: boolean;
  readonly humanApprover: string | null;
}

export function explainDecision(input: ExplanationInput): string {
  const reasons = input.rationale.length > 0 ? input.rationale.join(', ') : 'no_specific_rule';
  const approval = input.humanApprovalRequired
    ? input.humanApprover
      ? `human approval recorded by ${input.humanApprover}`
      : 'human approval REQUIRED and not yet recorded'
    : 'no human approval mandated by policy';
  const ethics = input.ethicsPassed ? 'ethics rules passed' : 'ethics rules violated';
  return (
    `Outcome ${input.outcome}: ${reasons}. trust=${input.trustScore}/100, risk=${input.riskLevel}, ` +
    `${ethics}, ${approval}. Advisory to human authority; UAGP-1 does not execute the action.`
  );
}
