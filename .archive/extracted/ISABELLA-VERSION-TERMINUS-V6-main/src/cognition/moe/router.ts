/**
 * MOE SOBERANO — gating parametrizable (router.ts).
 * state: draft | auto_generated (pendiente revisión humana).
 *
 * ISA-003: gating aprendible formalizado como logits = W·x (parámetros `GateParams`
 *   por experto), `softmax` y `top-k` verificables. Matemática determinista pura,
 *   sin aleatoriedad ni librerías nuevas.
 * ISA-005 / ISA-007: dispatch por lotes que solo envía cada token a los expertos
 *   seleccionados (top-k) y aplica capacidad por experto con overflow determinista.
 * ISA-009: pérdida de balance de carga (GShard-style) expuesta para evaluación.
 */
import { sha256Hex, stableStringify } from "./hash";
import type { ExpertId } from "./contract";

export const GATE_CONTRACT_VERSION = 1;

export interface GateParams {
  /** Matriz de pesos aprendibles: weights[experto][feature]. */
  readonly weights: readonly (readonly number[])[];
}

export function createGateParams(weights: readonly (readonly number[])[]): GateParams {
  if (weights.length === 0) throw new Error("MOE: gate sin expertos");
  const dim = weights[0]?.length ?? 0;
  if (dim === 0) throw new Error("MOE: gate sin features");
  for (const row of weights) {
    if (row.length !== dim) throw new Error("MOE: filas de weights con dimensionalidad inconsistente");
  }
  return Object.freeze({ weights: Object.freeze(weights.map((row) => Object.freeze([...row]))) });
}

export function uniformGateParams(expertCount: number, featureDim: number): GateParams {
  if (!Number.isInteger(expertCount) || expertCount < 1) throw new Error("MOE: expertCount inválido");
  if (!Number.isInteger(featureDim) || featureDim < 1) throw new Error("MOE: featureDim inválido");
  return createGateParams(Array.from({ length: expertCount }, () => Array.from({ length: featureDim }, () => 0)));
}

export function gateParamsDigest(params: GateParams): string {
  return `sha256:${sha256Hex(`moegate-v${GATE_CONTRACT_VERSION}:${stableStringify(params.weights)}`)}`;
}

function dot(row: readonly number[], features: readonly number[]): number {
  let acc = 0;
  for (let j = 0; j < row.length; j += 1) {
    const w = row[j];
    const f = features[j];
    if (w === undefined || f === undefined) throw new Error("MOE: característica ausente en el dot product");
    acc += w * f;
  }
  return acc;
}

export function computeLogits(params: GateParams, features: readonly number[]): readonly number[] {
  const dim = params.weights[0]?.length ?? 0;
  if (dim === 0) throw new Error("MOE: gate vacío");
  if (features.length !== dim) throw new Error(`MOE: dimensionalidad features ${features.length} != gate ${dim}`);
  return Object.freeze(params.weights.map((row) => dot(row, features)));
}

/** Softmax numéricamente estable (resta del máximo); determinista. */
export function softmax(logits: readonly number[]): readonly number[] {
  if (logits.length === 0) return Object.freeze([]);
  let max = Number.NEGATIVE_INFINITY;
  for (const l of logits) {
    if (!Number.isFinite(l)) throw new Error("MOE: logits no finitos");
    if (l > max) max = l;
  }
  const exps = logits.map((l) => Math.exp(l - max));
  let sum = 0;
  for (const e of exps) sum += e;
  if (!Number.isFinite(sum) || sum <= 0) throw new Error("MOE: softmax degenerado");
  return Object.freeze(exps.map((e) => e / sum));
}

/** Índices ordenados por logit desc; empate se resuelve por índice ascendente. */
export function topKIndices(logits: readonly number[], k: number): readonly number[] {
  if (!Number.isInteger(k) || k < 1) throw new Error(`MOE: topK inválido '${k}'`);
  const order = logits
    .map((logit, i) => ({ i, logit }))
    .sort((a, b) => (b.logit - a.logit) || (a.i - b.i));
  return Object.freeze(order.slice(0, k).map((entry) => entry.i));
}

export interface TokenInput {
  readonly tokenId: string;
  readonly features: readonly number[];
}

export interface MoeOverflow {
  readonly expertId: ExpertId;
  readonly tokenIndex: number;
  readonly reason: "CAPACITY_EXCEEDED";
}

export interface GateContribution {
  readonly expertId: ExpertId;
  readonly weight: number;
}

export interface MoeGateDecision {
  readonly routing: "experts" | "fallback";
  readonly tokenId: string;
  readonly expertIds: readonly ExpertId[];
  readonly topK: number;
  readonly capacity: number;
  readonly logits: readonly number[];
  readonly weights: readonly number[];
  readonly contributions: readonly GateContribution[];
  readonly selectedExpertIds: readonly ExpertId[];
  readonly overflow: readonly MoeOverflow[];
  readonly fallbackReason: string | undefined;
}

export interface GateOptions {
  readonly expertIds: readonly ExpertId[];
  readonly topK: number;
  readonly capacityPerExpert: number;
  readonly fallbackExpert: ExpertId;
}

export interface BatchDecision {
  readonly tokenIndex: number;
  readonly token: TokenInput;
  readonly decision: MoeGateDecision;
}

function assertGateOptions(options: GateOptions): void {
  if (options.expertIds.length === 0) throw new Error("MOE: dispatch sin expertos");
  const seen = new Set<string>();
  for (const id of options.expertIds) {
    if (id.trim() === "") throw new Error("MOE: expertId vacío");
    if (seen.has(id)) throw new Error(`MOE: expertId duplicado ${id}`);
    seen.add(id);
  }
  if (!Number.isInteger(options.topK) || options.topK < 1) throw new Error(`MOE: topK inválido '${options.topK}'`);
  if (!Number.isInteger(options.capacityPerExpert) || options.capacityPerExpert < 1) {
    throw new Error(`MOE: capacityPerExpert inválido '${options.capacityPerExpert}'`);
  }
  if (options.fallbackExpert.trim() === "") throw new Error("MOE: fallbackExpert vacío");
}

/** Guard estructural (ISA-002): solo un objeto con logits/weights/top-k es un gate MoE. */
export function isMoeGateDecision(value: unknown): value is MoeGateDecision {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const routing = v.routing;
  if (routing !== "experts" && routing !== "fallback") return false;
  return Array.isArray(v.logits) && Array.isArray(v.weights) && Array.isArray(v.selectedExpertIds);
}

/**
 * Dispatch por lotes, capacidad y overflow deterministas (procesa en orden).
 * Un token solo se enruta a sus mejores expertos disponibles; agotada la
 * capacidad, ésta queda registrada como overflow y el token cae al fallback
 * gobernado. Nunca ejecuta todos los expertos por defecto (ISA-005).
 */
export function dispatchBatch(
  inputs: readonly TokenInput[],
  params: GateParams,
  options: GateOptions,
): readonly BatchDecision[] {
  assertGateOptions(options);
  if (params.weights.length !== options.expertIds.length) {
    throw new Error("MOE: el número de filas de gate no coincide con el número de expertos");
  }
  const used = new Map<number, number>();
  const decisions: BatchDecision[] = [];

  inputs.forEach((token, tokenIndex) => {
    const logits = computeLogits(params, token.features);
    const weights = softmax(logits);
    const ranked = topKIndices(logits, options.expertIds.length);
    const contributions: GateContribution[] = [];
    const overflow: MoeOverflow[] = [];

    for (const index of ranked) {
      if (contributions.length >= options.topK) break;
      const expertId = options.expertIds[index];
      const weight = weights[index];
      if (expertId === undefined || weight === undefined) throw new Error("MOE: índice de experto fuera de rango");
      const count = used.get(index) ?? 0;
      if (count >= options.capacityPerExpert) {
        overflow.push({ expertId, tokenIndex, reason: "CAPACITY_EXCEEDED" });
        continue;
      }
      used.set(index, count + 1);
      contributions.push({ expertId, weight });
    }

    const routing = contributions.length > 0 ? "experts" : "fallback";
    const decision: MoeGateDecision = Object.freeze({
      routing,
      tokenId: token.tokenId,
      expertIds: options.expertIds,
      topK: options.topK,
      capacity: options.capacityPerExpert,
      logits,
      weights,
      contributions: Object.freeze(
        routing === "experts"
          ? contributions
          : [{ expertId: options.fallbackExpert, weight: 1 } satisfies GateContribution],
      ),
      selectedExpertIds: Object.freeze(
        routing === "experts" ? contributions.map((c) => c.expertId) : [options.fallbackExpert],
      ),
      overflow: Object.freeze(overflow),
      fallbackReason: routing === "fallback" ? "NO_EXPERT_CAPACITY_AVAILABLE" : undefined,
    });
    decisions.push(Object.freeze({ tokenIndex, token, decision }));
  });

  return Object.freeze(decisions);
}

export interface LoadBalanceReport {
  readonly loss: number;
  readonly counts: readonly number[];
  readonly meanGateProbability: readonly number[];
}

/**
 * ISA-009 — pérdida auxiliar de balance (GShard-style):
 *   loss = N * Σ_i f_i * P_i, f_i = fracción despachada a i, P_i = gate medio de i.
 * Balance perfecto ⇒ 1; desbalance ⇒ > 1. Solo cuenta tokens enrutados a expertos.
 */
export function computeLoadBalancingLoss(
  decisions: readonly MoeGateDecision[],
  expertCount: number,
): LoadBalanceReport {
  if (!Number.isInteger(expertCount) || expertCount < 1) throw new Error("MOE: expertCount inválido");
  const routed = decisions.filter((d) => d.routing === "experts");
  const counts = new Array<number>(expertCount).fill(0);
  const probSums = new Array<number>(expertCount).fill(0);

  for (const decision of routed) {
    for (let i = 0; i < expertCount; i += 1) {
      const expertId = decision.expertIds[i];
      const weight = decision.weights[i];
      if (expertId === undefined || weight === undefined) throw new Error("MOE: índice de experto fuera de rango");
      if (decision.selectedExpertIds.includes(expertId)) counts[i] = (counts[i] ?? 0) + 1;
      probSums[i] = (probSums[i] ?? 0) + weight;
    }
  }

  if (routed.length === 0) {
    return Object.freeze({
      loss: 1,
      counts: Object.freeze(counts),
      meanGateProbability: Object.freeze(probSums.map(() => 0)),
    });
  }

  let sum = 0;
  for (let i = 0; i < expertCount; i += 1) {
    const f = (counts[i] ?? 0) / routed.length;
    const p = (probSums[i] ?? 0) / routed.length;
    sum += f * p;
  }
  return Object.freeze({
    loss: expertCount * sum,
    counts: Object.freeze(counts),
    meanGateProbability: Object.freeze(probSums.map((s) => s / routed.length)),
  });
}