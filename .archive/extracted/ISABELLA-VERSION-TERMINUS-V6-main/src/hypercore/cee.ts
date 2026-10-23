/**
 * Cognitive Energy Efficiency (CEE) for HyperCore Ω² (state: draft).
 *
 * CEE = cognitive value produced / energy consumed. Weights are DECLARED
 * (default equal), not learned. When energy is zero CEE is reported as 0 to
 * avoid a division artifact; it is not a measured scientific quantity.
 */
import type { CeeComponents, CeeInput, CeeResult } from "./types";

export const CEE_COMPONENT_KEYS: readonly (keyof CeeComponents)[] = [
  "taskSuccess",
  "evidenceQuality",
  "decisionAccuracy",
  "userValue",
  "reuseValue",
  "riskReduction",
];

export const DEFAULT_CEE_WEIGHTS: readonly number[] = [1, 1, 1, 1, 1, 1];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeCee(input: CeeInput, weights: readonly number[] = DEFAULT_CEE_WEIGHTS): CeeResult {
  const components: CeeComponents = Object.freeze({
    taskSuccess: clamp01(input.taskSuccess),
    evidenceQuality: clamp01(input.evidenceQuality),
    decisionAccuracy: clamp01(input.decisionAccuracy),
    userValue: clamp01(input.userValue),
    reuseValue: clamp01(input.reuseValue),
    riskReduction: clamp01(input.riskReduction),
  });
  const values: readonly number[] = CEE_COMPONENT_KEYS.map((key) => components[key]);
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
  const weightedValue =
    totalWeight === 0
      ? 0
      : values.reduce((acc, value, index) => acc + (weights[index] ?? 0) * value, 0) / totalWeight;
  const energyKwh = Math.max(0, input.energyKwh);
  const cee = energyKwh > 0 ? weightedValue / energyKwh : 0;

  return Object.freeze({
    components,
    weightedValue,
    energyKwh,
    cee,
    weights: Object.freeze([...weights]),
  });
}
