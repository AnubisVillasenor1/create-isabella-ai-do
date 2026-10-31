/**
 * REGALO 8 — SELECTOR DE MODELO (Model Selector).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: enrutar solo por latencia desaprovecha costo y calidad.
 * Dado un conjunto de modelos candidatos y un objetivo (máx. latencia, máx.
 * costo, mín. calidad, pesos), elige el mejor compromiso de forma determinista.
 *
 * Invariante (AGENTS.md): solo recomienda un recurso; no autoriza ni invoca
 * proveedores. Fail-closed: sin candidato factible no hay selección.
 */
import { clamp, digest, round } from './util';

export const MODEL_SELECTOR_VERSION = '1.0.0' as const;
export const MODEL_SELECTOR_METHOD_ID =
  'A.TWINS.LEGACY.model_selector.select.v1.0.0.LOW.AUTONOMOUS' as const;
export const MODEL_SELECTOR_DISCLAIMER =
  'El selector de modelo recomienda un recurso por latencia·costo·calidad; no concede autoridad ni ejecuta inferencia.';

export interface ModelCandidate {
  readonly id: string;
  readonly provider?: string;
  /** Latencia esperada en ms. */
  readonly latencyMs: number;
  /** Costo por 1K tokens (unidad consistente). */
  readonly costPer1kTokens: number;
  /** Calidad 0..1 (mayor = mejor). */
  readonly quality: number;
}

export interface SelectionWeights {
  readonly latency?: number;
  readonly cost?: number;
  readonly quality?: number;
}

export interface SelectionObjective {
  readonly maxLatencyMs?: number;
  readonly maxCostPer1kTokens?: number;
  readonly minQuality?: number;
  readonly weights?: SelectionWeights;
}

export interface RankedModel {
  readonly model: ModelCandidate;
  readonly score: number;
  readonly feasible: boolean;
  readonly excludedReason?: string;
}

export interface ModelSelection {
  readonly version: typeof MODEL_SELECTOR_VERSION;
  readonly selected?: ModelCandidate;
  readonly ranked: readonly RankedModel[];
  readonly feasible: boolean;
  readonly weights: Required<SelectionWeights>;
  readonly reason: string;
  readonly digest: string;
  readonly methodId: typeof MODEL_SELECTOR_METHOD_ID;
  readonly disclaimer: typeof MODEL_SELECTOR_DISCLAIMER;
}

const DEFAULT_WEIGHTS: Required<SelectionWeights> = { latency: 0.4, cost: 0.2, quality: 0.4 };

function normalizeWeights(weights: SelectionWeights | undefined): Required<SelectionWeights> {
  const merged: Required<SelectionWeights> = {
    latency: weights?.latency ?? DEFAULT_WEIGHTS.latency,
    cost: weights?.cost ?? DEFAULT_WEIGHTS.cost,
    quality: weights?.quality ?? DEFAULT_WEIGHTS.quality,
  };
  const sum = merged.latency + merged.cost + merged.quality;
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  return { latency: merged.latency / sum, cost: merged.cost / sum, quality: merged.quality / sum };
}

function feasibilityReason(
  model: ModelCandidate,
  objective: SelectionObjective
): string | undefined {
  if (objective.maxLatencyMs !== undefined && model.latencyMs > objective.maxLatencyMs)
    return 'LATENCY_EXCEEDED';
  if (
    objective.maxCostPer1kTokens !== undefined &&
    model.costPer1kTokens > objective.maxCostPer1kTokens
  )
    return 'COST_EXCEEDED';
  if (objective.minQuality !== undefined && model.quality < objective.minQuality)
    return 'QUALITY_BELOW_MINIMUM';
  return undefined;
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

export function selectModel(
  candidates: readonly ModelCandidate[],
  objective: SelectionObjective = {}
): ModelSelection {
  if (!Array.isArray(candidates) || candidates.length === 0)
    throw new Error('MODEL_SELECTOR_CANDIDATES_REQUIRED');
  for (const c of candidates) {
    if (!c.id || !c.id.trim()) throw new Error('MODEL_SELECTOR_ID_REQUIRED');
    if (!Number.isFinite(c.latencyMs) || c.latencyMs < 0)
      throw new Error('MODEL_SELECTOR_LATENCY_INVALID');
    if (!Number.isFinite(c.costPer1kTokens) || c.costPer1kTokens < 0)
      throw new Error('MODEL_SELECTOR_COST_INVALID');
    if (!Number.isFinite(c.quality) || c.quality < 0 || c.quality > 1)
      throw new Error('MODEL_SELECTOR_QUALITY_INVALID');
  }

  const weights = normalizeWeights(objective.weights);
  const latencies = candidates.map((c) => c.latencyMs);
  const costs = candidates.map((c) => c.costPer1kTokens);
  const qualities = candidates.map((c) => c.quality);
  const minLat = Math.min(...latencies),
    maxLat = Math.max(...latencies);
  const minCost = Math.min(...costs),
    maxCost = Math.max(...costs);
  const minQ = Math.min(...qualities),
    maxQ = Math.max(...qualities);

  const ranked: RankedModel[] = candidates.map((model) => {
    const lat = 1 - normalize(model.latencyMs, minLat, maxLat);
    const cost = 1 - normalize(model.costPer1kTokens, minCost, maxCost);
    const quality = normalize(model.quality, minQ, maxQ);
    const score = round(weights.latency * lat + weights.cost * cost + weights.quality * quality, 4);
    const excludedReason = feasibilityReason(model, objective);
    return {
      model,
      score,
      feasible: excludedReason === undefined,
      ...(excludedReason ? { excludedReason } : {}),
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  const chosen = ranked.find((r) => r.feasible);

  return {
    version: MODEL_SELECTOR_VERSION,
    selected: chosen ? chosen.model : undefined,
    ranked: Object.freeze(ranked),
    feasible: chosen !== undefined,
    weights,
    reason: chosen ? 'BEST_FEASIBLE_SCORE' : 'NO_FEASIBLE_MODEL',
    digest: digest({
      objective,
      weights,
      ranked: ranked.map((r) => ({ id: r.model.id, score: r.score, feasible: r.feasible })),
    }),
    methodId: MODEL_SELECTOR_METHOD_ID,
    disclaimer: MODEL_SELECTOR_DISCLAIMER,
  };
}
