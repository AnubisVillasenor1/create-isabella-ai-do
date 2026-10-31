/**
 * Adaptive Model Router for HyperCore Ω² (state: draft).
 *
 * Ranks relevant experts by the declared objective:
 *   M* = argmin( cost + lambda * latency + mu * energy )
 * Relevance comes from Micro-MoE affinity. It never bypasses policy; it only
 * chooses WHICH experts prepare work.
 */
import { expertAffinities } from './micro-moe';
import {
  DEFAULT_ROUTER_POLICY,
  type CognitiveState,
  type HyperCoreExpert,
  type RouterPolicy,
} from './types';

export function routeExperts(
  experts: readonly HyperCoreExpert[],
  state: CognitiveState,
  policy: RouterPolicy = DEFAULT_ROUTER_POLICY
): readonly HyperCoreExpert[] {
  if (experts.length === 0) return Object.freeze([]);
  const scores = expertAffinities(experts, state);
  const affinityById = new Map(scores.map((score) => [score.expertId, score.affinity]));

  const relevant = experts.filter(
    (expert) => (affinityById.get(expert.id) ?? 0) >= policy.minAffinity
  );
  const pool =
    relevant.length > 0
      ? relevant
      : [...experts]
          .sort((a, b) => (affinityById.get(b.id) ?? 0) - (affinityById.get(a.id) ?? 0))
          .slice(0, 1);

  const ranked = [...pool].sort((a, b) => objective(a, policy) - objective(b, policy));
  const topK = Math.max(1, Math.floor(policy.topK));
  return Object.freeze(ranked.slice(0, topK));
}

function objective(expert: HyperCoreExpert, policy: RouterPolicy): number {
  return (
    expert.costUnits +
    policy.lambda * (expert.latencyMs / 1000) +
    policy.mu * (expert.energyKwh * 1000)
  );
}
