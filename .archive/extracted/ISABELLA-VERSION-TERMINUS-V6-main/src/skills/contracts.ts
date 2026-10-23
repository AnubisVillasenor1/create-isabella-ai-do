/**
 * Canonical skill capability contract types (CSF-Ω / HyperCore Ω).
 *
 * A skill is not a function: it is a governed capability contract. These types
 * express identity, authority, evidence, limits and rollback so that execution,
 * verification and audit are inseparable.
 */
import type { RiskTier } from "../authority/method-id";

export type { RiskTier };

export interface SkillAuthority {
  readonly requiredScopes: readonly string[];
  readonly requiresStepUp: boolean;
  readonly requiresQuorum: boolean;
  readonly quorumSize?: number;
}

export interface EvidencePolicy {
  readonly required: boolean;
  readonly piiRedaction: boolean;
  readonly retentionDays: number;
  readonly allowedEvidenceTypes?: readonly string[];
}

export interface SkillLimits {
  readonly maxLatencyMs: number;
  readonly maxMemoryMb: number;
  readonly maxCallsPerMinute: number;
  readonly maxEnergyUnits: number;
}

export type RollbackStrategy = "none" | "compensating-action" | "state-restore" | "manual-approval";

export interface RollbackPlan {
  readonly supported: boolean;
  readonly strategy: RollbackStrategy;
}

export interface SkillContract {
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly authority: SkillAuthority;
  readonly evidencePolicy: EvidencePolicy;
  readonly limits: SkillLimits;
  readonly rollback: RollbackPlan;
}

export interface EvidenceRef {
  readonly type: string;
  readonly digest: string;
}
