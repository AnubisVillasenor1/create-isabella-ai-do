/**
 * Puntuación de riesgo R = 0.25·C + 0.25·S + 0.20·F + 0.15·P + 0.15·U y tiers de
 * activación de cabezas (Alpha/Beta) hasta modo EPIC (bloqueo hasta aprobación humana).
 *
 * state: draft | engine-generated. Los nombres semánticos de las dimensiones
 * (C=criticidad, S=alcance, F=irreversibilidad, P=privacidad, U=incertidumbre) son
 * una interpretación DOCUMENTADA como supuesto; la spec fija solo letras y pesos.
 * Distinto de `terminus/mandate` (vector de 8 dimensiones por mandato): este puntaje
 * es el selector de profundidad de deliberación, no una autorización.
 */
export interface RiskInputs {
  readonly C: number;
  readonly S: number;
  readonly F: number;
  readonly P: number;
  readonly U: number;
}

export type RiskTier = 'OBSERVE' | 'SELECTIVE' | 'RELEVANT_HEADS' | 'EPIC';

export const RISK_WEIGHTS = { C: 0.25, S: 0.25, F: 0.2, P: 0.15, U: 0.15 } as const;

export interface RiskAssessment {
  readonly score: number;
  readonly tier: RiskTier;
  readonly requiresHumanApproval: boolean;
  readonly description: string;
}

const KEYS = ['C', 'S', 'F', 'P', 'U'] as const;

export function riskScore(inputs: RiskInputs): number {
  let total = 0;
  for (const k of KEYS) {
    const v = inputs[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      throw new RangeError(`RISK: ${k} must be a finite number in [0,1]`);
    }
    total += RISK_WEIGHTS[k] * v;
  }
  return Math.round(total * 1e9) / 1e9;
}

export function riskTier(score: number): RiskTier {
  if (!Number.isFinite(score) || score < 0 || score > 1)
    throw new RangeError('RISK: score must be in [0,1]');
  if (score >= 0.85) return 'EPIC';
  if (score >= 0.65) return 'RELEVANT_HEADS';
  if (score >= 0.35) return 'SELECTIVE';
  return 'OBSERVE';
}

const DESCRIPTIONS: Record<RiskTier, string> = {
  OBSERVE: 'Alpha y Beta en modo observación',
  SELECTIVE: 'Beta selectivo',
  RELEVANT_HEADS: 'Beta con cabezas relevantes',
  EPIC: 'Modo EPIC: bloqueo hasta aprobación humana',
};

export function assessRisk(inputs: RiskInputs): RiskAssessment {
  const score = riskScore(inputs);
  const tier = riskTier(score);
  return { score, tier, requiresHumanApproval: tier === 'EPIC', description: DESCRIPTIONS[tier] };
}
