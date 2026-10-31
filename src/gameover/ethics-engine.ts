/**
 * GAME OVER EthicsEngine (UAGP-1).
 *
 * Deterministic rule evaluation of a declared request. state: draft |
 * engine-generated. It reports rule violations; it does not measure intent and
 * does not claim accuracy.
 */
import { GAMEOVER_CONSTITUTION } from './constitution';
import type { AgentIdentity, EvidenceReference } from './types';

export interface EthicsInput {
  readonly agent: AgentIdentity;
  readonly objectiveTitle: string;
  readonly objectiveDescription?: string;
  readonly actions: readonly string[];
  readonly dataClasses?: readonly string[];
  readonly evidence: readonly EvidenceReference[];
}

export interface EthicsResult {
  readonly passed: boolean;
  readonly violations: readonly string[];
}

export const FORBIDDEN_INTENT_TOKENS: readonly string[] = [
  'exfiltrate',
  'exfiltration',
  'bypass_governance',
  'disable_audit',
  'tamper_audit',
  'destroy_evidence',
  'conceal',
];

export function evaluateEthics(input: EthicsInput): EthicsResult {
  const violations: string[] = [];

  if (!input.agent.id.trim() || !input.agent.name.trim() || !input.agent.owner.trim()) {
    violations.push('E_IDENTITY_INCOMPLETE');
  }
  if (!input.objectiveTitle.trim()) violations.push('E_OBJECTIVE_REQUIRED');
  if (input.actions.length === 0) violations.push('E_ACTION_REQUIRED');

  const intent =
    `${input.objectiveTitle} ${input.objectiveDescription ?? ''} ${input.actions.join(' ')}`.toLowerCase();
  for (const token of FORBIDDEN_INTENT_TOKENS) {
    if (intent.includes(token)) violations.push(`E_FORBIDDEN_INTENT:${token}`);
  }

  const dataClasses = (input.dataClasses ?? []).map((value) => value.toLowerCase());
  const touchesSensitive = dataClasses.some((cls) =>
    GAMEOVER_CONSTITUTION.sensitiveDataClasses.includes(cls)
  );
  if (touchesSensitive && input.evidence.length === 0) {
    violations.push('E_EVIDENCE_REQUIRED_FOR_SENSITIVE_DATA');
  }

  return Object.freeze({ passed: violations.length === 0, violations: Object.freeze(violations) });
}
