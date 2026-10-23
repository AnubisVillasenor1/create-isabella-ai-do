/**
 * SOPHIA — evaluador epistemológico y puerta de calidad.
 *
 * Clasifica el conocimiento en niveles E0_AXIOM, E1_VERIFIED, E2_INFERRED,
 * E3_HYPOTHETICAL, E4_UNFOUNDED e impone la puerta del Índice de Resonancia
 * Epistémica (ERI ≥ 95).
 *
 * Honestidad técnica: E0_AXIOM no se alcanza por puntuación automática. El
 * evaluador solo puede asignar hasta E1_VERIFIED de forma determinista; E0 exige
 * axioma declarado explícitamente. Un score no convierte una inferencia en verdad.
 */

export const SOPHIA_LEVELS = [
  "E0_AXIOM",
  "E1_VERIFIED",
  "E2_INFERRED",
  "E3_HYPOTHETICAL",
  "E4_UNFOUNDED",
] as const;

export type SophiaLevel = (typeof SOPHIA_LEVELS)[number];

export const ERI_THRESHOLD = 95;

export interface SophiaSignals {
  /** evidencia independiente verificable (fuentes/experimentos). */
  corroboratingSources: number;
  /** afirmaciones sin respaldo detectadas. */
  unsupportedClaims: number;
  /** contradicciones con el corpus canónico. */
  contradictions: number;
  /** reproducibilidad declarada [0..1]. */
  reproducibility: number;
  /** método explícito y trazable. */
  methodDeclared: boolean;
  /** axioma declarado explícitamente (único camino a E0). */
  declaredAxiom?: boolean;
}

export interface SophiaAssessment {
  level: SophiaLevel;
  eri: number;
  passesThreshold: boolean;
  reasons: readonly string[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Calcula el Índice de Resonancia Epistémica (ERI 0–100) y clasifica el nivel.
 * Fail-closed: información insuficiente nunca se eleva por encima de E3.
 */
export function assessEpistemicState(signals: SophiaSignals): SophiaAssessment {
  const reasons: string[] = [];
  // La corroboración satura a 4 fuentes independientes: 4+ fuentes = evidencia
  // plena. Así una afirmación fuertemente corroborada puede alcanzar la puerta ERI.
  const corroboration = clamp01(Math.max(0, signals.corroboratingSources) / 4);
  const reproducibility = clamp01(signals.reproducibility);
  const method = signals.methodDeclared ? 1 : 0;
  const unsupportedPenalty = clamp01(signals.unsupportedClaims / 5);
  const contradictionPenalty = clamp01(signals.contradictions / 3);

  const raw =
    corroboration * 0.4 +
    reproducibility * 0.35 +
    method * 0.25;

  const eri = Math.round(Math.max(0, raw - unsupportedPenalty * 0.3 - contradictionPenalty * 0.4) * 100);

  // El nivel epistemológico refleja la calidad de la evidencia. El ERI es una
  // métrica de resonancia separada (puerta de promoción), no un requisito del
  // nivel: una afirmación corroborada y reproducible es E1 aunque su ERI no
  // alcance 95. La puerta ERI se expone aparte en `passesThreshold`.
  let level: SophiaLevel;
  if (signals.declaredAxiom === true && signals.contradictions === 0 && eri >= ERI_THRESHOLD) {
    level = "E0_AXIOM";
    reasons.push("axioma declarado explícitamente");
  } else if (signals.corroboratingSources >= 2 && reproducibility >= 0.8 && signals.contradictions === 0) {
    level = "E1_VERIFIED";
    reasons.push("evidencia independiente y reproducible");
  } else if (signals.corroboratingSources >= 1 && signals.contradictions === 0) {
    level = "E2_INFERRED";
    reasons.push("inferencia con al menos una fuente");
  } else if (signals.unsupportedClaims > 0 || signals.contradictions > 0) {
    level = "E4_UNFOUNDED";
    reasons.push("afirmaciones sin respaldo o contradictorias");
  } else {
    level = "E3_HYPOTHETICAL";
    reasons.push("hipótesis sin corroboración suficiente");
  }

  if (signals.contradictions > 0) reasons.push(`${signals.contradictions} contradicciones`);
  if (signals.unsupportedClaims > 0) reasons.push(`${signals.unsupportedClaims} afirmaciones sin respaldo`);

  return { level, eri, passesThreshold: eri >= ERI_THRESHOLD, reasons };
}

/** ¿El resultado supera la puerta ERI que exige SOPHIA? */
export function passesEriGate(assessment: SophiaAssessment, threshold = ERI_THRESHOLD): boolean {
  return assessment.eri >= threshold;
}