export const INVARIANT_SLOTS = [
  "capability",
  "authority",
  "execution",
  "evidence",
  "learning",
  "production",
] as const;

export type InvariantSlot = (typeof INVARIANT_SLOTS)[number];

/**
 * Invariante Operativo:
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 *
 * Las inteligencias sugieren, calculan y evalúan; la conciencia humana decide,
 * aprueba, arbitra y ejecuta. Ninguna entidad del sistema puede reclamar dos
 * roles como si fueran el mismo.
 */
export interface OperativeInvariant {
  capability: string;
  authority: string;
  execution: string;
  evidence: string;
  learning: string;
  production: string;
}

export const INVARIANT_DIAGRAM =
  "CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION";

export const invariantViewModel: OperativeInvariant = {
  capability: "suggest_compute_evaluate",
  authority: "human_decides_approves_arbitrates",
  execution: "human_executes_or_explicitly_delegates",
  evidence: "reproducible_human_verified",
  learning: "proposed_evaluated_approved_versioned",
  production: "gated_provenance_canary_observed_slo",
};

/** Verifica que el modelo de invariante no confunda dos roles como iguales. */
export function isInvariantPreserved(
  model: OperativeInvariant = invariantViewModel,
): boolean {
  const values = INVARIANT_SLOTS.map((slot) => model[slot]);
  const unique = new Set(values);
  if (unique.size !== values.length) {
    return false;
  }
  return !Object.values(model).some((v) => !v || v === "self_granted");
}