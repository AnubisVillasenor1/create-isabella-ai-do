/**
 * Energy Governor + mode profiles for HyperCore Ω² (state: draft).
 *
 * Selects an operating mode from a DECLARED energy/latency estimate against a
 * budget. Energy figures are estimates (expert metadata / callers), never
 * hardware measurements. OMEGA does not mean unlimited consumption: it means
 * expandable resources under maximum governance.
 */
import type {
  EnergyBudget,
  EnergyEstimate,
  HyperCoreExpert,
  HyperCoreMode,
  ModeDecision,
  ModeProfile,
} from "./types";

const MODE_PROFILES: Record<HyperCoreMode, ModeProfile> = {
  ECO: { mode: "ECO", cpuLimitPercent: 20, speculative: false, parallelBranches: 1, cacheBias: "maximum", governance: "standard" },
  CRUISE: { mode: "CRUISE", cpuLimitPercent: 40, speculative: false, parallelBranches: 2, cacheBias: "high", governance: "standard" },
  BOOST: { mode: "BOOST", cpuLimitPercent: 70, speculative: true, parallelBranches: 4, cacheBias: "high", governance: "elevated" },
  HYPERBOOST: { mode: "HYPERBOOST", cpuLimitPercent: 90, speculative: true, parallelBranches: 16, cacheBias: "maximum", governance: "elevated" },
  OMEGA: { mode: "OMEGA", cpuLimitPercent: 100, speculative: true, parallelBranches: 64, cacheBias: "total", governance: "maximum" },
};

export function modeProfile(mode: HyperCoreMode): ModeProfile {
  return MODE_PROFILES[mode];
}

export function modeProfiles(): readonly ModeProfile[] {
  return Object.values(MODE_PROFILES);
}

export function estimateFromExperts(experts: readonly HyperCoreExpert[]): EnergyEstimate {
  let energy = 0;
  let latency = 0;
  for (const expert of experts) {
    energy += expert.energyKwh;
    latency = Math.max(latency, expert.latencyMs);
  }
  return { estimatedEnergyKwh: energy, estimatedLatencyMs: latency };
}

export interface GovernModeInput {
  readonly estimate: EnergyEstimate;
  readonly budget: EnergyBudget;
  readonly critical: boolean;
  readonly authorizedCritical?: boolean;
}

export function governMode(input: GovernModeInput): ModeDecision {
  const { estimate, budget } = input;
  if (estimate.estimatedEnergyKwh > budget.maxEnergyKwh) {
    return { mode: "ECO", reason: "ENERGY_OVER_BUDGET" };
  }
  if (input.authorizedCritical) {
    return { mode: "OMEGA", reason: "AUTHORIZED_CRITICAL_OPERATION" };
  }
  if (input.critical && estimate.estimatedEnergyKwh <= budget.maxEnergyKwh) {
    return { mode: "HYPERBOOST", reason: "CRITICAL_WITHIN_BUDGET" };
  }
  if (estimate.estimatedLatencyMs <= budget.maxLatencyMs) {
    return { mode: "CRUISE", reason: "LATENCY_WITHIN_TARGET" };
  }
  return { mode: "BOOST", reason: "LATENCY_OVER_TARGET_WITHIN_ENERGY" };
}

export type DegradationStep =
  | "reduce_parallelism"
  | "disable_speculation"
  | "reduce_context"
  | "switch_to_eco_model"
  | "queue_non_critical_tasks"
  | "pause_prefetch";

export const DEGRADATION_ORDER: readonly DegradationStep[] = [
  "reduce_parallelism",
  "disable_speculation",
  "reduce_context",
  "switch_to_eco_model",
  "queue_non_critical_tasks",
  "pause_prefetch",
];

/**
 * Tracks a cumulative energy spend against a budget. Volatile, per-process.
 * This is an accounting aid, not a metering device.
 */
export class EnergyLedger {
  private readonly budget: EnergyBudget;
  private used = 0;

  constructor(budget: EnergyBudget) {
    this.budget = budget;
  }

  canSpend(energyKwh: number): boolean {
    return this.used + energyKwh <= this.budget.carbonBudgetDailyKwh;
  }

  spend(energyKwh: number): void {
    this.used += energyKwh;
  }

  usedEnergyKwh(): number {
    return this.used;
  }

  remainingKwh(): number {
    return Math.max(0, this.budget.carbonBudgetDailyKwh - this.used);
  }

  get maxPrefetchLatencyMs(): number {
    return this.budget.maxLatencyMs;
  }
}
