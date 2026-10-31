/** Layer 6: cognitive emphasis network (deterministic salience selection). */
import { clamp } from './util';
import {
  IVCC_TIER_FEATURES,
  type CognitiveState,
  type EmphasisPlan,
  type EmphasisSpan,
  type IvccTier,
  type SemanticInterpretation,
} from './types';

export function planEmphasis(
  semantic: SemanticInterpretation,
  cognitive: CognitiveState,
  tier: IvccTier
): EmphasisPlan {
  const features = IVCC_TIER_FEATURES[tier];
  if (!features.emphasis) {
    return { spans: [], density: 0, policy: cognitive.emphasisPolicy };
  }
  const scale =
    cognitive.emphasisPolicy === 'expressive'
      ? 1.12
      : cognitive.emphasisPolicy === 'restrained'
        ? 0.68
        : 1;
  const spans: EmphasisSpan[] = semantic.emphasis
    .map((target) => ({
      text: target.text,
      strength: clamp(target.strength * scale, 0, 1),
      reason: target.reasons[0] ?? 'saliencia semántica',
    }))
    .filter((span) => span.strength >= 0.32)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 24);
  const density = semantic.clauses.length === 0 ? 0 : spans.length / semantic.clauses.length;
  return { spans, density: clamp(density, 0, 1), policy: cognitive.emphasisPolicy };
}
