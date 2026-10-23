/**
 * Máquina de estados de controles V5.
 * Estados: declared → wired → verified → blocked.
 * La densificación es un aumento de evidencia, no una autoproclamación.
 */
import type { ControlState } from "../core/types";

export const CONTROL_STATE_ORDER: ControlState[] = [
  "declared",
  "wired",
  "verified",
  "blocked",
];

export const MAX_EVIDENCE_INDEX = CONTROL_STATE_ORDER.indexOf("verified");

export function stateRank(state: ControlState): number {
  const rank = CONTROL_STATE_ORDER.indexOf(state);
  if (rank === -1) {
    throw new Error(`Estado desconocido: ${state}`);
  }
  return rank;
}

export function evolveControlState(previous: ControlState, next: ControlState): ControlState {
  if (previous === next) {
    return previous;
  }
  if (previous === "blocked" && next !== "declared") {
    throw new Error(`Un control 'blocked' sólo puede volver a 'declared': ${previous} → ${next}`);
  }
  if (previous === "verified" && (next === "wired" || next === "verified")) {
    throw new Error(`Un control 'verified' no puede degradarse a '${next}': exige archivo de evidencia`);
  }
  return next;
}