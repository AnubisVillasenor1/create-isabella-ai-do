/**
 * Veritas Ω multi-verifier consensus for HyperCore Ω² (state: draft).
 *
 * Consensus thresholds by risk class. Any hard-verifier failure (safety,
 * policy, or financial side-effect at high/critical risk) is an immediate DENY.
 * Missing required verifiers yield RETRY_SAFE, never ALLOW.
 */
import type {
  HyperCoreVerifierCheck,
  HyperCoreVerifierName,
  RiskClass,
  VeritasVerdict,
  VeritasVerdictCode,
} from './types';

const REQUIRED_BY_RISK: Record<RiskClass, number> = {
  low: 2,
  medium: 3,
  high: 4,
  critical: 4,
};

export function consideredVerifiers(risk: RiskClass): readonly HyperCoreVerifierName[] {
  const names: HyperCoreVerifierName[] = ['safety', 'policy', 'security', 'provenance'];
  if (risk === 'medium' || risk === 'high' || risk === 'critical') names.push('factuality');
  if (risk === 'high' || risk === 'critical') names.push('financial');
  return Object.freeze(names);
}

export function requiredApprovals(risk: RiskClass): number {
  return REQUIRED_BY_RISK[risk];
}

export function deriveChecks(
  candidate: Record<string, unknown>,
  risk: RiskClass
): readonly HyperCoreVerifierCheck[] {
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
  const checks: HyperCoreVerifierCheck[] = [
    { name: 'safety', passed: candidate.safety === 'pass' },
    { name: 'policy', passed: candidate.policy === 'pass' },
    { name: 'security', passed: candidate.security === 'pass' },
    { name: 'provenance', passed: evidence.length > 0 },
  ];
  if (risk === 'medium' || risk === 'high' || risk === 'critical') {
    checks.push({ name: 'factuality', passed: candidate.factuality === 'pass' });
  }
  if (risk === 'high' || risk === 'critical') {
    checks.push({ name: 'financial', passed: candidate.financialExecution === false });
  }
  return Object.freeze(checks);
}

export interface VerifyInput {
  readonly checks: readonly HyperCoreVerifierCheck[];
  readonly risk: RiskClass;
}

function freezeVerdict(
  verdict: VeritasVerdictCode,
  approvals: number,
  required: number,
  checks: readonly HyperCoreVerifierCheck[],
  failed: readonly HyperCoreVerifierName[],
  reason: string
): VeritasVerdict {
  return Object.freeze({
    verdict,
    approvals,
    required,
    checks,
    failed: Object.freeze([...failed]),
    reason,
  });
}

export function verifyCandidate(input: VerifyInput): VeritasVerdict {
  const { checks, risk } = input;
  const expected = consideredVerifiers(risk);
  const present = new Set(checks.map((check) => check.name));
  const missing = expected.filter((name) => !present.has(name));
  const approvals = checks.filter((check) => check.passed).length;
  const required = requiredApprovals(risk);
  const failed = checks.filter((check) => !check.passed).map((check) => check.name);

  const hardFailures = checks.filter(
    (check) =>
      !check.passed &&
      (check.name === 'safety' || check.name === 'policy' || check.name === 'financial')
  );

  if (hardFailures.length > 0) {
    return freezeVerdict(
      'DENY',
      approvals,
      required,
      checks,
      failed,
      `HARD_VERIFIER_FAILED:${hardFailures.map((c) => c.name).join(',')}`
    );
  }

  let verdict: VeritasVerdictCode;
  let reason: string;
  if (approvals >= required) {
    verdict = 'ALLOW';
    reason = 'CONSENSUS_REACHED';
  } else if (approvals >= required - 1) {
    verdict = 'ESCALATE';
    reason = 'PARTIAL_CONSENSUS';
  } else if (missing.length > 0) {
    verdict = 'RETRY_SAFE';
    reason = `VERIFIERS_MISSING:${missing.join(',')}`;
  } else {
    verdict = 'DENY';
    reason = 'CONSENSUS_NOT_REACHED';
  }

  return Object.freeze({
    verdict,
    approvals,
    required,
    checks,
    failed: Object.freeze(failed),
    reason,
  });
}

export function consensusLabel(verdict: VeritasVerdict): string {
  return `${verdict.approvals}/${verdict.checks.length}`;
}

export function isDeliverable(verdict: VeritasVerdictCode): boolean {
  return verdict === 'ALLOW';
}
