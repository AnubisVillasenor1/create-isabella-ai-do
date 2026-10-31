/**
 * GAME OVER canonical constitution (UAGP-1).
 *
 * The machine-readable copy shipped with the Jenkins plugin lives at
 * `gameover-jenkins-plugin/src/main/resources/gameover/constitution.yml`. This
 * module mirrors it in typed form so the runtime engine and the CI gate share
 * one source of truth without a YAML parser dependency.
 *
 * state: draft | engine-generated.
 */
import type { EvidenceKind, RiskLevel, TrustMetrics } from './types';

export interface GameOverConstitution {
  readonly protocol: string;
  readonly version: string;
  readonly principles: readonly string[];
  readonly trustWeights: Readonly<Record<keyof TrustMetrics, number>>;
  readonly riskBaseByCriticality: Readonly<Record<RiskLevel, number>>;
  readonly riskLevelThresholds: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
  };
  readonly capabilityPenaltyPerItem: number;
  readonly capabilityPenaltyCap: number;
  readonly trustLevelThresholds: {
    readonly exemplary: number;
    readonly high: number;
    readonly moderate: number;
    readonly low: number;
  };
  readonly passportCertificationThresholds: {
    readonly certified: number;
    readonly provisional: number;
  };
  readonly highRiskActions: readonly string[];
  readonly sensitiveDataClasses: readonly string[];
  readonly defaultPassportValidityDays: number;
  readonly court: { readonly criticalTrustFloor: number; readonly highRiskTrustFloor: number };
}

export const KNOWN_EVIDENCE_KINDS: readonly EvidenceKind[] = [
  'BOOKPI_EVENT',
  'EXTERNAL_ATTESTATION',
  'HUMAN_APPROVAL',
  'TEST_RUN',
  'SPEC_REFERENCE',
];

export const GAMEOVER_CONSTITUTION: GameOverConstitution = {
  protocol: 'UAGP-1',
  version: '0.1.0',
  principles: [
    'HUMAN_AUTHORITY_PRIMACY',
    'NON_MALEFICENCE',
    'TRANSPARENCY',
    'ACCOUNTABILITY',
    'PROPORTIONALITY',
    'REVERSIBILITY_PREFERENCE',
    'EVIDENCE_BEFORE_TRUST',
    'FAIL_CLOSED',
  ],
  trustWeights: {
    integrity: 0.3,
    competence: 0.2,
    alignment: 0.15,
    transparency: 0.15,
    humanOversight: 0.1,
    incidentRecord: 0.1,
  },
  riskBaseByCriticality: {
    LOW: 0.1,
    MEDIUM: 0.35,
    HIGH: 0.65,
    CRITICAL: 0.9,
  },
  riskLevelThresholds: { low: 0.25, medium: 0.55, high: 0.8 },
  capabilityPenaltyPerItem: 0.08,
  capabilityPenaltyCap: 0.35,
  trustLevelThresholds: { exemplary: 90, high: 75, moderate: 50, low: 25 },
  passportCertificationThresholds: { certified: 85, provisional: 60 },
  highRiskActions: [
    'deploy',
    'delete',
    'drop',
    'destroy',
    'transfer_funds',
    'publish',
    'revoke',
    'execute',
    'modify_production',
    'rotate_credentials',
  ],
  sensitiveDataClasses: ['pii', 'phi', 'financial', 'credential', 'secret'],
  defaultPassportValidityDays: 365,
  court: { criticalTrustFloor: 85, highRiskTrustFloor: 70 },
};

export function isKnownEvidenceKind(value: string): value is EvidenceKind {
  return KNOWN_EVIDENCE_KINDS.includes(value as EvidenceKind);
}

export function riskLevelFor(score: number): RiskLevel {
  const t = GAMEOVER_CONSTITUTION.riskLevelThresholds;
  if (score < t.low) return 'LOW';
  if (score < t.medium) return 'MEDIUM';
  if (score < t.high) return 'HIGH';
  return 'CRITICAL';
}
