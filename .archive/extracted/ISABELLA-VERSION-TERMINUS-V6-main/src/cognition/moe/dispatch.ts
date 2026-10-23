/**
 * MOE SOBERANO — dispatch a expertos seleccionados (dispatch.ts).
 * state: draft | auto_generated (pendiente revisión humana).
 *
 * ISA-005: solo se ejecutan los expertos seleccionados por el gate (top-k),
 *   nunca todos por defecto.
 * ISA-008 / ISA-011: expertos ausentes, no operativos o sin la modalidad
 *   requerida se bloquean de forma determinista, preservando auditoría.
 * ISA-016 (evidencia estructural): el resultado del dispatch no transporta
 *   permisos ni herramientas; el router no concede autoridad.
 * Coherencia semántica con `orchestrator.ts` vía `expertPlanForDispatched`.
 */
import { GENESIS_EXPERTS, planExperts, type ExpertPlan } from "../experts";
import type { ExpertId, ExpertRegistry, Modality } from "./contract";
import type { MoeGateDecision } from "./router";

export type DispatchBlockReason = "GHOST_PREVENTED" | "NON_OPERATIONAL" | "MODALITY_UNSUPPORTED";

export interface BlockedExpert {
  readonly expertId: ExpertId;
  readonly reason: DispatchBlockReason;
}

export interface DispatchResult {
  readonly executedExpertIds: readonly ExpertId[];
  readonly blocked: readonly BlockedExpert[];
  readonly usedFallback: boolean;
  readonly fallbackReason: string | undefined;
}

export const DISPATCH_AUTHORITY_FIELDS = ["permissions", "tools", "grants"] as const;

export function dispatch(
  decision: MoeGateDecision,
  registry: ExpertRegistry,
  requiredModality: Modality = "text",
): DispatchResult {
  if (decision.routing === "fallback") {
    return Object.freeze({
      executedExpertIds: Object.freeze([...decision.selectedExpertIds]),
      blocked: Object.freeze([]),
      usedFallback: true,
      fallbackReason: decision.fallbackReason,
    });
  }

  const executed: ExpertId[] = [];
  const blocked: BlockedExpert[] = [];
  for (const expertId of decision.selectedExpertIds) {
    const expert = registry.get(expertId);
    if (!expert) {
      blocked.push({ expertId, reason: "GHOST_PREVENTED" });
      continue;
    }
    if (!expert.operational) {
      blocked.push({ expertId, reason: "NON_OPERATIONAL" });
      continue;
    }
    if (!expert.artifact.modalities.includes(requiredModality)) {
      blocked.push({ expertId, reason: "MODALITY_UNSUPPORTED" });
      continue;
    }
    executed.push(expertId);
  }

  const usedFallback = executed.length < decision.selectedExpertIds.length;
  return Object.freeze({
    executedExpertIds: Object.freeze(executed),
    blocked: Object.freeze(blocked),
    usedFallback,
    fallbackReason: usedFallback ? "SELECTED_EXPERTS_UNAVAILABLE_OR_UNSUPPORTED" : undefined,
  });
}

/**
 * Traduce expertos ejecutados al plan del orquestador cognitivo existente.
 * Solo acepta ids reales del catálogo `GENESIS_EXPERTS`; lanza en caso contrario.
 */
export function expertPlanForDispatched(executed: readonly ExpertId[]): ExpertPlan {
  const genesis = new Set<string>(GENESIS_EXPERTS);
  for (const id of executed) {
    if (!genesis.has(id)) {
      throw new Error(`MOE: experto ejecutado '${id}' fuera del catálogo cognitivo del orquestador`);
    }
  }
  return planExperts(executed.map((id) => id as (typeof GENESIS_EXPERTS)[number]));
}