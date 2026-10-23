/**
 * Speculative Draft Engine for HyperCore Ω² (state: draft).
 *
 * A draft is NEVER final: `finalized` is pinned to false and only Veritas Ω can
 * promote a candidate to a deliverable response. The speedup figure is the
 * declared acceptance-rate model 1 / ((1 - a) + a/gamma), not a measurement.
 */
import { DEFAULT_SPECULATIVE_CONFIG, type SpeculativeConfig, type SpeculativeDraft } from "./types";

export function estimateSpeedup(acceptanceRate: number, draftTokens: number): number {
  const alpha = Math.max(0, Math.min(1, acceptanceRate));
  const gamma = Math.max(1, Math.floor(draftTokens));
  const denominator = (1 - alpha) + alpha / gamma;
  if (denominator <= 0) return gamma;
  return 1 / denominator;
}

export function createDraft(
  candidate: Record<string, unknown>,
  config: SpeculativeConfig = DEFAULT_SPECULATIVE_CONFIG,
): SpeculativeDraft {
  return Object.freeze({
    candidate,
    acceptanceRate: Math.max(0, Math.min(1, config.acceptanceRate)),
    draftTokens: Math.max(1, Math.floor(config.draftTokens)),
    estimatedSpeedup: estimateSpeedup(config.acceptanceRate, config.draftTokens),
    finalized: false,
  });
}
