/**
 * Isabella Genesis Engine (IGE) — routing contract/prototype.
 * Ranks scores supplied by an inference adapter. It does not create embeddings,
 * train weights, run PyTorch/vLLM, or claim learned MoE inference.
 */
export const IGE_ROUTING_SCHEMA = "ige-routing/v1" as const;
export const IGE_HEAD_COUNT = 12;
export const IGE_EXPERT_COUNT = 24;
export type ExpertFamily = "thematic" | "functional" | "ethical" | "metacognitive";

export interface GenesisRoutingInput {
  requestId: string;
  headScores: readonly number[];
  expertScores: readonly number[];
  topHeads?: number;
  topK?: number;
}
export interface GenesisRoutingDecision {
  schemaVersion: typeof IGE_ROUTING_SCHEMA;
  requestId: string;
  activeHeads: number[];
  activeExperts: number[];
  weights: number[];
  confidence: number;
  expertFamilies: ExpertFamily[];
}
export function expertFamily(expertIndex: number): ExpertFamily {
  if (!Number.isInteger(expertIndex) || expertIndex < 0 || expertIndex >= IGE_EXPERT_COUNT) {
    throw new RangeError("IGE: expert index must be an integer in [0, 23]");
  }
  if (expertIndex < 6) return "thematic";
  if (expertIndex < 12) return "functional";
  if (expertIndex < 18) return "ethical";
  return "metacognitive";
}
function validateScores(scores: readonly number[], expectedLength: number, label: string): void {
  if (!Array.isArray(scores) || scores.length !== expectedLength) {
    throw new TypeError("IGE: " + label + " must contain exactly " + expectedLength + " scores");
  }
  if (scores.some((score) => typeof score !== "number" || !Number.isFinite(score))) {
    throw new TypeError("IGE: " + label + " must contain only finite numbers");
  }
}
function topIndices(scores: readonly number[], count: number): number[] {
  return scores.map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count).map(({ index }) => index);
}
function softmax(scores: readonly number[]): number[] {
  const max = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - max));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) throw new RangeError("IGE: unable to normalize expert scores");
  return exponentials.map((value) => value / total);
}
/** Deterministic post-processor for model-provided scores; no hidden score generation. */
export function routeGenesisExperts(input: GenesisRoutingInput): GenesisRoutingDecision {
  if (!input || typeof input.requestId !== "string" || input.requestId.trim().length === 0 || input.requestId.length > 128) {
    throw new TypeError("IGE: requestId must be a non-empty string of at most 128 characters");
  }
  validateScores(input.headScores, IGE_HEAD_COUNT, "headScores");
  validateScores(input.expertScores, IGE_EXPERT_COUNT, "expertScores");
  const topHeads = input.topHeads ?? 4;
  const topK = input.topK ?? 4;
  if (!Number.isInteger(topHeads) || topHeads < 1 || topHeads > IGE_HEAD_COUNT) {
    throw new RangeError("IGE: topHeads must be an integer in [1, 12]");
  }
  if (!Number.isInteger(topK) || topK < 2 || topK > 4) {
    throw new RangeError("IGE: topK must be an integer in [2, 4]");
  }
  const activeHeads = topIndices(input.headScores, topHeads);
  const activeExperts = topIndices(input.expertScores, topK);
  const weights = softmax(activeExperts.map((index) => input.expertScores[index]!));
  return {
    schemaVersion: IGE_ROUTING_SCHEMA, requestId: input.requestId, activeHeads, activeExperts,
    weights, confidence: Math.max(...weights), expertFamilies: activeExperts.map(expertFamily),
  };
}
