/** ORION SANDBOX — evaluación representativa sin influencia en producción. */

import type { EvolutionControl } from "../core/types";
import type { ApprovalRef } from "../identity/approval";
import type { ChangeProposal } from "./proposal";

export interface SandboxContext {
  controlsSnapshot: readonly EvolutionControl[];
  approval?: ApprovalRef;
}

export interface SandboxResult {
  passed: boolean;
  reason: string;
  controlsTouched: number;
  replayedIds: readonly string[];
  replayedAt: string;
}

const NOT_REPLAYABLE = new Set(["CRITICAL", "HIGH", "MEDIUM"]);

/**
 * ORION equivale a un plano paralelo: la propuesta se replica contra la
 * instantánea de controles, jamás contra el estado vivo. Un control que está
 * en `blocked` no puede ser satisfecho; riesgo MEDIUM+ no se reaprovecha sin
 * aprobación humana (EARLY_EXIT / gobernanza).
 */
export function runSandbox(proposal: ChangeProposal, ctx: SandboxContext): SandboxResult {
  const replayed: string[] = [];
  const matches = ctx.controlsSnapshot.filter(
    (c) =>
      c.state !== "blocked" &&
      (c.domain === proposal.domain || c.plane.name === proposal.plane),
  );

  for (const control of matches) {
    const satisfied = control.contract.length > 0 && control.verification.length > 0;
    if (!satisfied) {
      replayed.push(control.id);
      return {
        passed: false,
        reason: `el control ${control.id} falla en representación (contract/verification vacíos)`,
        controlsTouched: matches.length,
        replayedIds: replayed,
        replayedAt: new Date().toISOString(),
      };
    }
    replayed.push(control.id);
  }

  if (replayed.length === 0) {
    return {
      passed: false,
      reason: "la propuesta no toca ningún control del catálogo (insuficiente)",
      controlsTouched: 0,
      replayedIds: [],
      replayedAt: new Date().toISOString(),
    };
  }

  if (NOT_REPLAYABLE.has(proposal.riskTier) && ctx.approval?.decision !== "ALLOW") {
    return {
      passed: false,
      reason: `riesgo ${proposal.riskTier} requiere aprobación humana para representar la propuesta`,
      controlsTouched: matches.length,
      replayedIds: replayed,
      replayedAt: new Date().toISOString(),
    };
  }

  return {
    passed: true,
    reason: `${replayed.length} controles representados sin desviaciones en el plano paralelo`,
    controlsTouched: matches.length,
    replayedIds: replayed,
    replayedAt: new Date().toISOString(),
  };
}