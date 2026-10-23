// Ω∞-20 · COGNITIVE CAPITAL ENGINE (state: draft | engine-generated).
// Evoluciona "Intelligence-as-an-Asset" a "Intelligence-as-Capital". El valor es
// dinámico y explicable. Valuar NO transfiere capital: sólo produce una medida
// auditable. Reutiliza el dominio económico (SCER) sin duplicar primitivas.

export interface CognitiveCapital {
  value: number;
  trust: number;
  evidence: number;
  utility: number;
  demand: number;
  rarity: number;
  reproducibility: number;
}

export interface CognitiveCapitalInput {
  readonly utility: number;
  readonly trust: number;
  readonly demand: number;
  readonly evidence: number;
  readonly reputation: number;
  readonly rarity?: number;
  readonly reproducibility?: number;
}

function unit(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`CAPITAL_${name}_OUT_OF_RANGE`);
  }
  return value;
}

/**
 * Calcula el capital cognitivo:
 *   Capital = Utilidad + Confianza + Demanda + Evidencia + Reputación
 * Acotado a [0, 500]. `rarity` y `reproducibility` son señales informativas
 * (0..100) que contextualizan el valor, no lo inflan de forma opaca.
 */
export function valuateCapital(input: CognitiveCapitalInput): CognitiveCapital {
  const utility = unit(input.utility, "UTILITY");
  const trust = unit(input.trust, "TRUST");
  const demand = unit(input.demand, "DEMAND");
  const evidence = unit(input.evidence, "EVIDENCE");
  const reputation = unit(input.reputation, "REPUTATION");
  const rarity = unit(input.rarity ?? 50, "RARITY");
  const reproducibility = unit(input.reproducibility ?? 50, "REPRODUCIBILITY");

  return {
    value: utility + trust + demand + evidence + reputation,
    trust,
    evidence,
    utility,
    demand,
    rarity,
    reproducibility,
  };
}
