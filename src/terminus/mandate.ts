import { canonicalJson, sha256Hex } from '../bookpi/crypto';
import { BOOKPI_PROTOCOL } from '../bookpi/types';
import type { BookPiStorage, JsonValue } from '../bookpi/types';

export const RISK_DIMENSIONS = [
  'legal',
  'financial',
  'operational',
  'reputational',
  'cybersecurity',
  'privacy',
  'humanSafety',
  'systemic',
] as const;

export type RiskDimension = (typeof RISK_DIMENSIONS)[number];
export type Verdict = 'ALLOW' | 'DENY' | 'ESCALATE';
export type RiskVector = Record<RiskDimension, number>;

export interface AuthorityChain {
  requester: string;
  technicalReviewer: string;
  legalReviewer: string;
  securityReviewer: string;
  approver: string;
  executor: string;
  supervisor: string;
  auditor: string;
}

export interface EvidenceReference {
  id: string;
  sha256: string;
  source: string;
}

export interface HumanApproval {
  approverId: string;
  evidenceId: string;
  approvedAt: string;
  expiresAt: string;
}

export interface MandateBudget {
  latencyMs: number;
  toolCalls: number;
  bytes: number;
  energyMilliJoules: number;
}

export interface TerminusMandate {
  id: string;
  tenantId: string;
  subjectId: string;
  /** Untrusted precondition only; the runtime also calls verifyIdentity. */
  identityAuthenticated: boolean;
  capability: string;
  resources: string[];
  purpose: string;
  operations: string[];
  evidence: EvidenceReference[];
  risk: RiskVector;
  authorityChain: AuthorityChain;
  policyVersion: string;
  issuedAt: string;
  expiresAt: string;
  maxExecutions: number;
  remainingExecutions: number;
  budget: MandateBudget;
  humanApproval?: HumanApproval;
}

export interface TerminusPolicy {
  version: string;
  maxTtlMs: number;
  maxExecutionsPerMandate: number;
  maxEvidenceReferences: number;
  escalationRiskThreshold: number;
  riskLimits: RiskVector;
  budgetLimits: MandateBudget;
  allowedOperationsByCapability: Readonly<Record<string, readonly string[]>>;
  hardDeniedCapabilities: readonly string[];
  hardDeniedOperations: readonly string[];
}

export interface TerminusDecision {
  verdict: Verdict;
  mandateId: string;
  policyVersion: string;
  reasonCodes: string[];
  rationale: string;
  dossierHash: string;
  decidedAt: string;
}

export type EvidenceVerifier = (evidence: EvidenceReference, tenantId: string) => Promise<boolean>;
export type IdentityVerifier = (mandate: TerminusMandate) => Promise<boolean>;
export type HumanApprovalVerifier = (
  approval: HumanApproval,
  mandate: TerminusMandate
) => Promise<boolean>;
export type ExecutionCounter = {
  /** Must atomically decrement the remaining budget or fail; implementations must be durable. */
  consumeOne(mandateId: string, maxExecutions: number, expiresAt: string): Promise<boolean>;
};

const HEX_256 = /^[a-f0-9]{64}$/i;
const ACTOR_FIELDS: (keyof AuthorityChain)[] = [
  'requester',
  'technicalReviewer',
  'legalReviewer',
  'securityReviewer',
  'approver',
  'executor',
  'supervisor',
  'auditor',
];

function isFiniteBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function dateMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function uniqueNonBlank(values: readonly string[]): boolean {
  return (
    values.length > 0 &&
    values.every((value) => typeof value === 'string' && value.trim().length > 0) &&
    new Set(values).size === values.length
  );
}

function decisionFor(
  mandate: TerminusMandate,
  policy: TerminusPolicy,
  now: number,
  verdict: 'DENY' | 'ESCALATE',
  code: string,
  rationale: string
): TerminusDecision {
  const material = {
    mandateId: mandate?.id ?? 'unknown',
    tenantDigest: typeof mandate?.tenantId === 'string' ? sha256Hex(mandate.tenantId) : null,
    subjectDigest: typeof mandate?.subjectId === 'string' ? sha256Hex(mandate.subjectId) : null,
    capability: typeof mandate?.capability === 'string' ? mandate.capability : null,
    resourceDigest: Array.isArray(mandate?.resources)
      ? sha256Hex(canonicalJson(mandate.resources))
      : null,
    operationDigest: Array.isArray(mandate?.operations)
      ? sha256Hex(canonicalJson(mandate.operations))
      : null,
    risk: mandate?.risk ?? null,
    authorityChain: mandate?.authorityChain ?? null,
    issuedAt: mandate?.issuedAt ?? null,
    expiresAt: mandate?.expiresAt ?? null,
    policyVersion: policy.version,
    verdict,
    code,
    rationale,
    decidedAt: new Date(now).toISOString(),
  };
  return {
    verdict,
    mandateId: material.mandateId,
    policyVersion: policy.version,
    reasonCodes: [code],
    rationale,
    dossierHash: sha256Hex(canonicalJson(material as unknown as JsonValue)),
    decidedAt: material.decidedAt,
  };
}

function deny(
  mandate: TerminusMandate,
  policy: TerminusPolicy,
  now: number,
  code: string,
  rationale: string
): TerminusDecision {
  return decisionFor(mandate, policy, now, 'DENY', code, rationale);
}

function policyIsValid(policy: TerminusPolicy): boolean {
  if (
    !policy.version?.trim() ||
    !isFiniteBoundedInteger(policy.maxTtlMs, 1, Number.MAX_SAFE_INTEGER) ||
    !isFiniteBoundedInteger(policy.maxExecutionsPerMandate, 1, Number.MAX_SAFE_INTEGER) ||
    !isFiniteBoundedInteger(policy.maxEvidenceReferences, 1, 10000) ||
    !isFiniteBoundedInteger(policy.escalationRiskThreshold, 1, 100)
  )
    return false;
  for (const dimension of RISK_DIMENSIONS) {
    if (!isFiniteBoundedInteger(policy.riskLimits?.[dimension], 0, 100)) return false;
  }
  for (const key of ['latencyMs', 'toolCalls', 'bytes', 'energyMilliJoules'] as const) {
    if (!isFiniteBoundedInteger(policy.budgetLimits?.[key], 1, Number.MAX_SAFE_INTEGER))
      return false;
  }
  if (
    !policy.allowedOperationsByCapability ||
    !Array.isArray(policy.hardDeniedCapabilities) ||
    !Array.isArray(policy.hardDeniedOperations)
  )
    return false;
  return Object.entries(policy.allowedOperationsByCapability).every(
    ([capability, operations]) =>
      capability.trim().length > 0 &&
      Array.isArray(operations) &&
      new Set(operations).size === operations.length &&
      operations.every((operation) => typeof operation === 'string' && operation.trim().length > 0)
  );
}

/** Pure, deterministic except for supplied nowMs; fails closed on missing/inconsistent fields. */
export function evaluateMandate(
  mandate: TerminusMandate,
  policy: TerminusPolicy,
  nowMs = Date.now()
): TerminusDecision {
  const reject = (code: string, rationale: string) => deny(mandate, policy, nowMs, code, rationale);
  if (!policyIsValid(policy))
    return reject(
      'POLICY_CONFIGURATION_INVALID',
      'La política activa no tiene límites completos y válidos.'
    );
  if (mandate.policyVersion !== policy.version)
    return reject(
      'POLICY_VERSION_MISMATCH',
      'El mandato no corresponde a la versión de política activa.'
    );
  if (
    !mandate.id?.trim() ||
    !mandate.tenantId?.trim() ||
    !mandate.subjectId?.trim() ||
    !mandate.identityAuthenticated
  )
    return reject('IDENTITY_INVALID', 'Identidad ausente, no autenticada o sin tenant.');
  if (!mandate.capability?.trim() || !mandate.purpose?.trim())
    return reject('MANDATE_SCOPE_INCOMPLETE', 'Capacidad y propósito son obligatorios.');
  if (policy.hardDeniedCapabilities.includes(mandate.capability))
    return reject(
      'CAPABILITY_CONSTITUTIONALLY_DENIED',
      'La capacidad está prohibida por la política.'
    );
  if (
    !Array.isArray(mandate.resources) ||
    mandate.resources.length === 0 ||
    mandate.resources.some(
      (r) => typeof r !== 'string' || !r.trim() || r === '*' || r.includes('..')
    )
  ) {
    return reject(
      'RESOURCE_SCOPE_INVALID',
      'El alcance de recursos debe ser explícito, acotado y no contener comodines ni traversal.'
    );
  }
  if (
    !Array.isArray(mandate.operations) ||
    mandate.operations.length === 0 ||
    mandate.operations.some((op) => typeof op !== 'string') ||
    new Set(mandate.operations).size !== mandate.operations.length
  ) {
    return reject(
      'OPERATIONS_INVALID',
      'Las operaciones deben ser explícitas, no vacías y sin duplicados.'
    );
  }
  const allowed = policy.allowedOperationsByCapability[mandate.capability];
  if (!allowed)
    return reject(
      'CAPABILITY_NOT_REGISTERED',
      'La capacidad no tiene operaciones registradas en la política.'
    );
  if (
    mandate.operations.some(
      (op) => !op.trim() || policy.hardDeniedOperations.includes(op) || !allowed.includes(op)
    )
  ) {
    return reject(
      'OPERATION_NOT_ALLOWED',
      'Una o más operaciones no están autorizadas para esta capacidad.'
    );
  }

  const issuedAt = dateMs(mandate.issuedAt);
  const expiresAt = dateMs(mandate.expiresAt);
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > nowMs ||
    expiresAt <= nowMs ||
    expiresAt <= issuedAt
  ) {
    return reject(
      'MANDATE_EXPIRED_OR_INVALID',
      'Las fechas del mandato son inválidas, futuras o expiradas.'
    );
  }
  if (expiresAt - issuedAt > policy.maxTtlMs)
    return reject('MANDATE_TTL_EXCEEDED', 'El mandato supera el TTL máximo configurado.');

  if (
    !isFiniteBoundedInteger(mandate.maxExecutions, 1, policy.maxExecutionsPerMandate) ||
    !isFiniteBoundedInteger(mandate.remainingExecutions, 0, mandate.maxExecutions)
  ) {
    return reject(
      'EXECUTION_BUDGET_INVALID',
      'El presupuesto de ejecuciones está fuera de límites.'
    );
  }
  if (mandate.remainingExecutions === 0)
    return reject(
      'EXECUTION_BUDGET_EXHAUSTED',
      'El mandato agotó su número permitido de ejecuciones.'
    );

  for (const dimension of RISK_DIMENSIONS) {
    const value = mandate.risk?.[dimension];
    const limit = policy.riskLimits[dimension];
    if (!isFiniteBoundedInteger(value, 0, 100))
      return reject('RISK_VECTOR_INVALID', 'El vector de riesgo contiene valores inválidos.');
    if (value > limit)
      return reject(
        'RISK_LIMIT_EXCEEDED',
        'El riesgo supera el límite aceptado por política: ' + dimension + '.'
      );
  }

  for (const key of ['latencyMs', 'toolCalls', 'bytes', 'energyMilliJoules'] as const) {
    const value = mandate.budget?.[key];
    const limit = policy.budgetLimits[key];
    if (!isFiniteBoundedInteger(value, 1, Number.MAX_SAFE_INTEGER) || value > limit) {
      return reject(
        'RESOURCE_BUDGET_INVALID',
        'El presupuesto de recursos falta, es inválido o excede la política: ' + key + '.'
      );
    }
  }

  if (
    !Array.isArray(mandate.evidence) ||
    mandate.evidence.length === 0 ||
    mandate.evidence.length > policy.maxEvidenceReferences ||
    mandate.evidence.some(
      (entry) =>
        !entry ||
        typeof entry.id !== 'string' ||
        !entry.id.trim() ||
        typeof entry.source !== 'string' ||
        !entry.source.trim() ||
        typeof entry.sha256 !== 'string' ||
        !HEX_256.test(entry.sha256)
    )
  ) {
    return reject(
      'EVIDENCE_MISSING_OR_INVALID',
      'Se requiere evidencia identificable, acotada y con digest SHA-256 válido.'
    );
  }

  const chain = mandate.authorityChain;
  const actors = chain ? ACTOR_FIELDS.map((field) => chain[field]) : [];
  if (!chain || !uniqueNonBlank(actors) || chain.requester !== mandate.subjectId) {
    return reject(
      'AUTHORITY_SEPARATION_VIOLATION',
      'La cadena de autoridad está incompleta, contiene actores repetidos o no coincide con el sujeto solicitante.'
    );
  }

  const requiresHumanApproval = RISK_DIMENSIONS.some(
    (dimension) => mandate.risk[dimension] >= policy.escalationRiskThreshold
  );
  if (requiresHumanApproval) {
    const approval = mandate.humanApproval;
    const approvalExpiry = approval ? dateMs(approval.expiresAt) : Number.NaN;
    const approvedAt = approval ? dateMs(approval.approvedAt) : Number.NaN;
    const approvalEvidenceExists =
      approval && mandate.evidence.some((entry) => entry.id === approval.evidenceId);
    if (
      !approval ||
      approval.approverId !== chain.approver ||
      !approvalEvidenceExists ||
      !Number.isFinite(approvedAt) ||
      !Number.isFinite(approvalExpiry) ||
      approvedAt > nowMs ||
      approvalExpiry <= nowMs ||
      approvalExpiry < expiresAt
    ) {
      return decisionFor(
        mandate,
        policy,
        nowMs,
        'ESCALATE',
        'HUMAN_APPROVAL_REQUIRED',
        'El riesgo requiere aprobación humana contextual; se detiene la ejecución para arbitraje.'
      );
    }
  }

  const material = {
    mandateId: mandate.id,
    tenantDigest: sha256Hex(mandate.tenantId),
    subjectDigest: sha256Hex(mandate.subjectId),
    capability: mandate.capability,
    resources: [...mandate.resources].sort(),
    purposeDigest: sha256Hex(mandate.purpose),
    operations: [...mandate.operations].sort(),
    evidence: mandate.evidence
      .map((item) => ({ id: item.id, sha256: item.sha256 }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    risk: mandate.risk,
    authorityChain: chain,
    policyVersion: policy.version,
    issuedAt: mandate.issuedAt,
    expiresAt: mandate.expiresAt,
    budget: mandate.budget,
    verdict: 'ALLOW',
    decidedAt: new Date(nowMs).toISOString(),
  };
  return {
    verdict: 'ALLOW',
    mandateId: mandate.id,
    policyVersion: policy.version,
    reasonCodes: ['MANDATE_BOUNDED_AND_POLICY_COMPLIANT'],
    rationale:
      'Mandato acotado; la identidad, la evidencia, el contador durable y el registro BookPI se verifican por separado.',
    dossierHash: sha256Hex(canonicalJson(material as unknown as JsonValue)),
    decidedAt: material.decidedAt,
  };
}

function jsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

export interface TerminusRuntimeOptions {
  policy: TerminusPolicy;
  ledger: BookPiStorage;
  verifyIdentity: IdentityVerifier;
  verifyHumanApproval: HumanApprovalVerifier;
  verifyEvidence: EvidenceVerifier;
  executionCounter: ExecutionCounter;
  clock?: () => number;
}

/**
 * Runtime authorization gate. ALLOW is emitted only after independent identity
 * and evidence checks, a durable execution-budget reservation, and a successful
 * BookPI append. It does not perform the requested operation itself.
 */
export class TerminusRuntime {
  private readonly clock: () => number;

  constructor(private readonly options: TerminusRuntimeOptions) {
    this.clock = options.clock ?? Date.now;
  }

  async authorize(mandate: TerminusMandate): Promise<TerminusDecision> {
    const now = this.clock();
    let decision = evaluateMandate(mandate, this.options.policy, now);
    if (decision.verdict === 'ALLOW') {
      try {
        if (!(await this.options.verifyIdentity(mandate))) {
          decision = deny(
            mandate,
            this.options.policy,
            now,
            'IDENTITY_PROOF_INVALID',
            'La prueba de identidad no fue validada por el proveedor de confianza.'
          );
        } else {
          const evidenceResults = await Promise.all(
            mandate.evidence.map((item) => this.options.verifyEvidence(item, mandate.tenantId))
          );
          if (evidenceResults.some((valid) => !valid)) {
            decision = deny(
              mandate,
              this.options.policy,
              now,
              'EVIDENCE_VERIFICATION_FAILED',
              'La evidencia no pudo verificarse de forma independiente.'
            );
          } else {
            const requiresApproval = RISK_DIMENSIONS.some(
              (dimension) => mandate.risk[dimension] >= this.options.policy.escalationRiskThreshold
            );
            if (requiresApproval) {
              const approval = mandate.humanApproval;
              if (!approval || !(await this.options.verifyHumanApproval(approval, mandate))) {
                decision = deny(
                  mandate,
                  this.options.policy,
                  now,
                  'HUMAN_APPROVAL_PROOF_INVALID',
                  'La aprobación humana contextual no fue autenticada por el verificador de confianza.'
                );
              }
            }
            if (decision.verdict === 'ALLOW') {
              const consumed = await this.options.executionCounter.consumeOne(
                mandate.id,
                mandate.maxExecutions,
                mandate.expiresAt
              );
              if (!consumed)
                decision = deny(
                  mandate,
                  this.options.policy,
                  now,
                  'EXECUTION_RESERVATION_FAILED',
                  'No fue posible reservar atómicamente una ejecución del mandato.'
                );
            }
          }
        }
      } catch {
        decision = deny(
          mandate,
          this.options.policy,
          now,
          'GOVERNANCE_DEPENDENCY_UNAVAILABLE',
          'Falló la verificación de identidad/evidencia o el contador durable; se aplica fail-closed.'
        );
      }
    }

    try {
      await this.options.ledger.appendEvent(
        {
          header: {
            type: 'terminus.decision',
            source: 'isabella.terminus-omega',
            protocol: BOOKPI_PROTOCOL,
            hehepcontext: { hexagon: 'TERMINUS-OMEGA', domain: 'GOVERNANCE' },
          },
          schemaVersion: 'terminus-omega.v1',
          meta: { policyVersion: this.options.policy.version, reasonCodes: decision.reasonCodes },
          payload: jsonValue({
            mandateId: mandate.id,
            tenantDigest: sha256Hex(mandate.tenantId),
            subjectDigest: sha256Hex(mandate.subjectId),
            capability: mandate.capability,
            verdict: decision.verdict,
            reasonCodes: decision.reasonCodes,
            dossierHash: decision.dossierHash,
            decidedAt: decision.decidedAt,
          }),
        },
        { actorId: mandate.authorityChain?.auditor }
      );
    } catch {
      return deny(
        mandate,
        this.options.policy,
        this.clock(),
        'BOOKPI_UNAVAILABLE',
        'No se ejecuta sin registrar la decisión en BookPI durable.'
      );
    }
    return decision;
  }
}

/** Validates and freezes a policy envelope; provider identities and evidence verifiers are configured separately. */
export function createTerminusPolicy(input: TerminusPolicy): TerminusPolicy {
  if (!policyIsValid(input)) throw new Error('TERMINUS_POLICY_CONFIGURATION_INVALID');
  return Object.freeze({
    ...input,
    riskLimits: Object.freeze({ ...input.riskLimits }),
    budgetLimits: Object.freeze({ ...input.budgetLimits }),
    hardDeniedCapabilities: Object.freeze([...input.hardDeniedCapabilities]),
    hardDeniedOperations: Object.freeze([...input.hardDeniedOperations]),
    allowedOperationsByCapability: Object.freeze(
      Object.fromEntries(
        Object.entries(input.allowedOperationsByCapability).map(([capability, operations]) => [
          capability,
          Object.freeze([...operations]),
        ])
      )
    ),
  });
}
