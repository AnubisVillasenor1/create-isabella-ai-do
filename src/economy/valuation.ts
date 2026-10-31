import type { Valuation, ValuationSignals } from './types';

// SCER Cognitive Asset Valuation (state: draft | engine-generated).
// Motor determinista y puro: las mismas señales producen siempre el mismo valor.
// Valuar NO concede autoridad, NO liquida y NO mueve fondos.

/** Peso relativo de cada señal en el puntaje compuesto (suman 1). */
export const VALUATION_WEIGHTS = {
  quality: 0.35,
  demand: 0.25,
  scarcity: 0.2,
  evidenceCoverage: 0.2,
} as const;

/** Valor máximo asignado a un activo cognitivo perfecto (unidades menores). */
export const VALUATION_UNIT_MINOR = 100_000;

function assertSignal(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Valuation signal "${name}" must be a finite number.`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`Valuation signal "${name}" must be within 0..100.`);
  }
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Valúa un activo cognitivo a partir de sus señales. Determinista:
 * `score` (0..100) pondera las señales; `baseValueMinor` lo escala al valor
 * unitario máximo; `confidence` privilegia la cobertura de evidencia.
 */
export function valuateAsset(signals: ValuationSignals): Valuation {
  assertSignal('quality', signals.quality);
  assertSignal('demand', signals.demand);
  assertSignal('scarcity', signals.scarcity);
  assertSignal('evidenceCoverage', signals.evidenceCoverage);

  const components = {
    quality: round4(signals.quality * VALUATION_WEIGHTS.quality),
    demand: round4(signals.demand * VALUATION_WEIGHTS.demand),
    scarcity: round4(signals.scarcity * VALUATION_WEIGHTS.scarcity),
    evidenceCoverage: round4(signals.evidenceCoverage * VALUATION_WEIGHTS.evidenceCoverage),
  };

  const score = round4(
    components.quality + components.demand + components.scarcity + components.evidenceCoverage
  );
  const baseValueMinor = Math.round((score / 100) * VALUATION_UNIT_MINOR);
  const confidence = round4((signals.evidenceCoverage / 100) * 0.6 + (signals.quality / 100) * 0.4);

  return { score, baseValueMinor, confidence, components };
}
