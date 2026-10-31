/**
 * GAME OVER UagpGateway (UAGP-1).
 *
 * Orchestrates the governance pipeline: validate -> passport -> ethics -> trust
 * -> risk -> adjudicate -> human approval -> explain -> audit. state: draft |
 * engine-generated. It returns an authorization decision; it never executes the
 * governed action and never certifies it.
 */
import { createAuditService, type AuditService } from './audit';
import { adjudicate } from './cognitive-court';
import { GAMEOVER_CONSTITUTION } from './constitution';
import { evaluateEthics } from './ethics-engine';
import { explainDecision } from './explainability-engine';
import { evaluateHumanApproval } from './human-approval-gate';
import { createPassportAuthority, type PassportAuthority } from './passport-authority';
import { assessRisk } from './risk-engine';
import { scoreTrust } from './trust-engine';
import {
  GAMEOVER_DISCLAIMER,
  UAGP_PROTOCOL,
  type DecisionOutcome,
  type GovernanceDecision,
  type UagpRequestInput,
  type UagpResult,
} from './types';
import { validateRequest } from './validator';

export interface GovernContext {
  readonly authenticatedPrincipal?: string;
}

export interface UagpGateway {
  govern(input: UagpRequestInput, context?: GovernContext): UagpResult;
}

export interface UagpGatewayOptions {
  readonly passportAuthority?: PassportAuthority;
  readonly audit?: AuditService;
}

function trustLevelFor(score: number): 'UNTRUSTED' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXEMPLARY' {
  const thresholds = GAMEOVER_CONSTITUTION.trustLevelThresholds;
  if (score >= thresholds.exemplary) return 'EXEMPLARY';
  if (score >= thresholds.high) return 'HIGH';
  if (score >= thresholds.moderate) return 'MODERATE';
  if (score >= thresholds.low) return 'LOW';
  return 'UNTRUSTED';
}

function isHighRiskAction(actions: readonly string[]): boolean {
  const normalized = actions.map((action) => action.toLowerCase());
  return normalized.some((action) =>
    GAMEOVER_CONSTITUTION.highRiskActions.some(
      (token) => action === token || action.includes(token)
    )
  );
}

export function createUagpGateway(options: UagpGatewayOptions = {}): UagpGateway {
  const passportAuthority = options.passportAuthority ?? createPassportAuthority();
  const audit = options.audit ?? createAuditService();

  function govern(input: UagpRequestInput, context: GovernContext = {}): UagpResult {
    // Treat the HTTP boundary as untrusted even though the public TypeScript API is typed.
    const validation = validateRequest(input);
    const raw = input && typeof input === 'object' ? (input as Partial<UagpRequestInput>) : {};
    const rawAgent = raw.agent && typeof raw.agent === 'object' ? raw.agent : undefined;
    const capabilities = Array.isArray(rawAgent?.capabilities)
      ? rawAgent.capabilities.filter((value): value is string => typeof value === 'string')
      : [];
    const agent =
      rawAgent &&
      typeof rawAgent.id === 'string' &&
      typeof rawAgent.name === 'string' &&
      typeof rawAgent.owner === 'string'
        ? {
            ...rawAgent,
            organization:
              typeof rawAgent.organization === 'string' ? rawAgent.organization : 'unknown',
            createdAt: typeof rawAgent.createdAt === 'string' ? rawAgent.createdAt : '',
            capabilities,
          }
        : {
            id: 'unknown',
            name: 'unknown',
            organization: 'unknown',
            owner: 'unknown',
            createdAt: '',
            capabilities: [] as readonly string[],
          };
    const safeInput = {
      ...raw,
      requestId:
        typeof raw.requestId === 'string' && raw.requestId.trim()
          ? raw.requestId
          : 'invalid-request',
      protocol: typeof raw.protocol === 'string' ? raw.protocol : '',
      passportId: typeof raw.passportId === 'string' ? raw.passportId : '',
      objectiveTitle: typeof raw.objectiveTitle === 'string' ? raw.objectiveTitle : '',
      objectiveDescription:
        typeof raw.objectiveDescription === 'string' ? raw.objectiveDescription : '',
      agent,
      actions: Array.isArray(raw.actions)
        ? raw.actions.filter((value): value is string => typeof value === 'string')
        : [],
      dataClasses: Array.isArray(raw.dataClasses)
        ? raw.dataClasses.filter((value): value is string => typeof value === 'string')
        : [],
      evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    } as UagpRequestInput;

    const passport = passportAuthority.verify(safeInput.passportId);
    const passportRecord = passportAuthority.get(safeInput.passportId);
    const requestedCapabilities = new Set(agent.capabilities.map((value) => value.toLowerCase()));
    const passportCapabilities = new Set(
      (passportRecord?.agent.capabilities ?? []).map((value) => value.toLowerCase())
    );
    const identityMatches = Boolean(
      passportRecord &&
      passportRecord.agent.id === agent.id &&
      passportRecord.agent.name === agent.name &&
      passportRecord.agent.owner === agent.owner &&
      agent.capabilities.every((capability) => passportCapabilities.has(capability.toLowerCase()))
    );
    const undeclaredActions = safeInput.actions.filter(
      (action) => !requestedCapabilities.has(action.toLowerCase())
    );
    const declaredTrust = scoreTrust(safeInput.trustMetrics ?? {});
    // Request-supplied metrics are not authority. They can lower a score, but
    // cannot raise it above the score assigned by the trusted passport issuer.
    const effectiveTrustScore = Math.min(declaredTrust.score, passportRecord?.trustScore ?? 0);
    const trust = Object.freeze({
      ...declaredTrust,
      score: effectiveTrustScore,
      level: trustLevelFor(effectiveTrustScore),
      summary: `trust=${effectiveTrustScore}/100; capped by issuer-assigned passport score; declared metrics are untrusted input`,
    });
    const risk = assessRisk({
      criticality: safeInput.criticality,
      capabilityCount: agent.capabilities.length,
    });
    const ethics = evaluateEthics({
      agent,
      objectiveTitle: safeInput.objectiveTitle,
      objectiveDescription: safeInput.objectiveDescription,
      actions: safeInput.actions,
      dataClasses: safeInput.dataClasses,
      evidence: safeInput.evidence ?? [],
    });

    // The request may raise the approval bar, but can never lower a policy-derived bar.
    const humanApprovalRequired =
      risk.level !== 'LOW' ||
      isHighRiskAction(safeInput.actions) ||
      safeInput.humanApprovalRequired === true;
    const human = evaluateHumanApproval({
      required: humanApprovalRequired,
      requestedApprover: safeInput.humanApprover,
      authenticatedPrincipal: context.authenticatedPrincipal,
    });

    const rationale: string[] = [];
    let outcome: DecisionOutcome;

    if (!validation.valid) {
      outcome = 'REJECT';
      rationale.push(...validation.errors.map((error) => `INVALID:${error}`));
    } else if (!passport.valid) {
      outcome = 'REJECT';
      rationale.push(`PASSPORT:${passport.reason}`);
    } else if (!identityMatches) {
      outcome = 'REJECT';
      rationale.push('PASSPORT_AGENT_OR_CAPABILITY_MISMATCH');
    } else if (undeclaredActions.length > 0) {
      outcome = 'REJECT';
      rationale.push(
        ...undeclaredActions.map((action) => `ACTION_CAPABILITY_NOT_DECLARED:${action}`)
      );
    } else if (!ethics.passed) {
      outcome = 'REJECT';
      rationale.push(...ethics.violations);
    } else {
      const verdict = adjudicate({
        ethicsPassed: true,
        riskLevel: risk.level,
        trustScore: trust.score,
      });
      outcome = verdict.outcome;
      rationale.push(...verdict.rationale);
    }

    let approver: string | null = null;
    if (outcome === 'ACCEPT' && humanApprovalRequired) {
      if (human.satisfied) {
        approver = human.approver;
        rationale.push('HUMAN_APPROVED');
      } else {
        outcome = 'ESCALATE';
        rationale.push(human.reason);
      }
    }

    const explanation = explainDecision({
      outcome,
      rationale,
      trustScore: trust.score,
      riskLevel: risk.level,
      ethicsPassed: ethics.passed,
      humanApprovalRequired,
      humanApprover: approver,
    });

    const decision: GovernanceDecision = Object.freeze({
      requestId: safeInput.requestId,
      timestamp: new Date().toISOString(),
      outcome,
      rationale: Object.freeze(rationale),
      trustScore: trust.score,
      riskLevel: risk.level,
      ethicsPassed: ethics.passed,
      ethicsViolations: ethics.violations,
      humanApprovalRequired,
      humanApprover: approver,
      explainability: explanation,
    });

    const entry = audit.record({
      principal: approver ?? (agent.id || 'unknown'),
      riskTier: risk.level,
      status: `GOVERNANCE_${outcome}`,
    });
    const storage = audit.snapshot().storage;

    return Object.freeze({
      requestId: safeInput.requestId,
      protocol: UAGP_PROTOCOL,
      outcome,
      allowed: outcome === 'ACCEPT',
      decision,
      trust,
      risk,
      passport,
      validation,
      audit: Object.freeze({ hash: entry.hash, sequence: entry.sequence, storage }),
      disclaimer: GAMEOVER_DISCLAIMER,
    });
  }

  return { govern };
}
