/**
 * GAME OVER — Universal Agent Governance Protocol (UAGP-1).
 *
 * state: draft | engine-generated. This module DECIDES (advisory to human
 * authority), SCORES and RECORDS. It does not execute the governed action, does
 * not certify, and does not claim measured accuracy. The human authority
 * decides, approves, arbitrates and executes.
 *
 * Fidelity contract: SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠
 * VERIFIED ≠ DEPLOYED ≠ CERTIFIED.
 */

export const GAMEOVER_MODULE = "GAMEOVER" as const;
export const UAGP_PROTOCOL = "UAGP-1" as const;
export const GAMEOVER_VERSION = "0.1.0" as const;

/** Canonical method id: [TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK].[GOV]. */
export const GAMEOVER_METHOD_IDS = {
  govern: "TINA.YUN.GAMEOVER.govern_agent_action.v0.1.0.HIGH.HUMAN_IN_THE_LOOP",
  validate: "TINA.YUN.GAMEOVER.validate_request.v0.1.0.MEDIUM.INSTITUTIONAL",
  issuePassport: "TINA.YUN.GAMEOVER.issue_passport.v0.1.0.MEDIUM.HUMAN_IN_THE_LOOP",
  revokePassport: "TINA.YUN.GAMEOVER.revoke_passport.v0.1.0.HIGH.HUMAN_IN_THE_LOOP",
  audit: "TINA.YUN.GAMEOVER.record_decision.v0.1.0.LOW.INSTITUTIONAL",
} as const;

export const GAMEOVER_DISCLAIMER =
  "UAGP-1 decides, scores and records; it does not execute the governed action or certify outcomes. " +
  "An ACCEPT outcome is an authorization recommendation subject to human authority. " +
  "Trust and risk figures are declared heuristic weights, not measured accuracy.";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DecisionOutcome = "ACCEPT" | "REJECT" | "ESCALATE";
export type CertificationState = "CERTIFIED" | "PROVISIONAL" | "REVOKED" | "UNKNOWN";
export type TrustLevel = "UNTRUSTED" | "LOW" | "MODERATE" | "HIGH" | "EXEMPLARY";

export interface AgentIdentity {
  readonly id: string;
  readonly name: string;
  readonly organization: string;
  readonly owner: string;
  readonly capabilities: readonly string[];
  readonly createdAt: string;
}

export type EvidenceKind = "BOOKPI_EVENT" | "EXTERNAL_ATTESTATION" | "HUMAN_APPROVAL" | "TEST_RUN" | "SPEC_REFERENCE";

export interface EvidenceReference {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly uri: string;
  /** Lowercase hex sha256 of the referenced artifact. 64 chars. */
  readonly sha256: string;
}

export interface TrustMetrics {
  readonly integrity: number;
  readonly competence: number;
  readonly alignment: number;
  readonly transparency: number;
  readonly humanOversight: number;
  readonly incidentRecord: number;
}

export interface RiskAssessment {
  readonly score: number;
  readonly level: RiskLevel;
  readonly criticality: RiskLevel;
  readonly capabilityCount: number;
  readonly summary: string;
}

export interface TrustScorecard {
  readonly score: number;
  readonly metrics: TrustMetrics;
  readonly level: TrustLevel;
  readonly summary: string;
}

export interface AIPassport {
  readonly id: string;
  readonly agent: AgentIdentity;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly issuer: string;
  readonly certification: CertificationState;
  readonly trustScore: number;
  readonly revokedAt?: string;
  readonly revokedReason?: string;
}

export interface PassportVerification {
  readonly id: string;
  readonly valid: boolean;
  readonly certification: CertificationState;
  readonly reason: string;
  readonly expiresAt: string;
}

export interface GovernanceDecision {
  readonly requestId: string;
  readonly timestamp: string;
  readonly outcome: DecisionOutcome;
  readonly rationale: readonly string[];
  readonly trustScore: number;
  readonly riskLevel: RiskLevel;
  readonly ethicsPassed: boolean;
  readonly ethicsViolations: readonly string[];
  readonly humanApprovalRequired: boolean;
  readonly humanApprover: string | null;
  readonly explainability: string;
}

export interface UagpRequestInput {
  readonly requestId: string;
  readonly protocol: string;
  readonly agent: AgentIdentity;
  readonly passportId: string;
  readonly objectiveTitle: string;
  readonly objectiveDescription?: string;
  readonly actions: readonly string[];
  readonly dataClasses?: readonly string[];
  readonly criticality?: RiskLevel;
  readonly trustMetrics?: Partial<TrustMetrics>;
  readonly evidence?: readonly EvidenceReference[];
  readonly humanApprovalRequired?: boolean;
  readonly humanApprover?: string | null;
}

export interface AuditReference {
  readonly id: string;
  readonly hash: string;
  readonly sequence: number;
  readonly storage: string;
  readonly durable: boolean;
}

export interface UagpResult {
  readonly requestId: string;
  readonly protocol: typeof UAGP_PROTOCOL;
  readonly outcome: DecisionOutcome;
  readonly allowed: boolean;
  readonly decision: GovernanceDecision;
  readonly trust: TrustScorecard;
  readonly risk: RiskAssessment;
  readonly passport: PassportVerification;
  readonly validation: { readonly valid: boolean; readonly errors: readonly string[] };
  readonly audit: { readonly hash: string; readonly sequence: number; readonly storage: string };
  readonly disclaimer: string;
}
