/**
 * Compuerta de niveles de autonomía A0–A5.
 *
 * state: draft | engine-generated. Los topes por impacto son una POLÍTICA PROPUESTA
 * (supuesto documentado), pendiente de arbitraje humano; la spec solo fija que A5 está
 * prohibido para alto impacto y que los actos irreversibles exigen confirmación,
 * control dual, límite de tiempo y plan de reversión/compensación.
 *
 *  A0 solo humano · A1 sugiere · A2 ejecuta con aprobación por acto
 *  A3 ejecuta con supervisión y revisión posterior · A4 autónomo dentro de límites
 *  A5 autonomía plena
 */
export type AutonomyLevel = "A0" | "A1" | "A2" | "A3" | "A4" | "A5";
export type ImpactClass = "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const ORDER: readonly AutonomyLevel[] = ["A0", "A1", "A2", "A3", "A4", "A5"];

/** Nivel máximo permitido por clase de impacto (política propuesta, draft). */
export const MAX_AUTONOMY_BY_IMPACT: Readonly<Record<ImpactClass, AutonomyLevel>> = {
  NEGLIGIBLE: "A5",
  LOW: "A4",
  MEDIUM: "A4",
  HIGH: "A3",
  CRITICAL: "A2",
};

export interface AutonomyRequest {
  readonly level: AutonomyLevel;
  readonly impact: ImpactClass;
  readonly irreversible: boolean;
  readonly humanConfirmed: boolean;
  readonly dualControl: boolean;
  readonly timeLimitMs?: number;
  readonly rollbackPlan: boolean;
}

export interface AutonomyDecision {
  readonly allowed: boolean;
  /** true si el único obstáculo es una confirmación/control pendiente (no una prohibición). */
  readonly needsHuman: boolean;
  readonly reasons: readonly string[];
}

export function levelIndex(level: AutonomyLevel): number {
  const i = ORDER.indexOf(level);
  if (i < 0) throw new RangeError("AUTONOMY: unknown level");
  return i;
}

export function evaluateAutonomy(req: AutonomyRequest): AutonomyDecision {
  const prohibited: string[] = [];
  const pending: string[] = [];
  const level = levelIndex(req.level);
  const cap = MAX_AUTONOMY_BY_IMPACT[req.impact];
  if (cap === undefined) throw new RangeError("AUTONOMY: unknown impact class");
  if (req.level === "A5" && (req.impact === "HIGH" || req.impact === "CRITICAL")) {
    prohibited.push("A5_PROHIBITED_FOR_HIGH_IMPACT");
  } else if (level > levelIndex(cap)) {
    prohibited.push(`LEVEL_EXCEEDS_CAP_${cap}_FOR_${req.impact}`);
  }
  if (req.level === "A0") prohibited.push("A0_HUMAN_ONLY_NO_MACHINE_EXECUTION");
  if (req.level === "A1") prohibited.push("A1_SUGGEST_ONLY_NO_EXECUTION");
  if (req.level === "A2" && !req.humanConfirmed) pending.push("A2_REQUIRES_PER_ACT_HUMAN_APPROVAL");
  if (req.irreversible) {
    if (!req.humanConfirmed) pending.push("IRREVERSIBLE_REQUIRES_CONFIRMATION");
    if (!req.dualControl) pending.push("IRREVERSIBLE_REQUIRES_DUAL_CONTROL");
    if (req.timeLimitMs === undefined || !Number.isFinite(req.timeLimitMs) || req.timeLimitMs <= 0) {
      prohibited.push("IRREVERSIBLE_REQUIRES_TIME_LIMIT");
    }
    if (!req.rollbackPlan) prohibited.push("IRREVERSIBLE_REQUIRES_ROLLBACK_OR_COMPENSATION_PLAN");
  }
  const reasons = [...prohibited, ...pending];
  return { allowed: reasons.length === 0, needsHuman: prohibited.length === 0 && pending.length > 0, reasons };
}
