/**
 * Layer 2: Latent identity style + Layer 3: cognitive state.
 * The 12-axis emotion vector is inferred lexically (already implemented in the
 * TTS engine) and modulated by semantics and the profile's style baseline.
 * Explicit caller values always win. Nothing here is a trained latent model.
 */
import { EMOTION_AXES, type EmotionAxis, type EmotionVector } from '../tts/types';
import { inferEmotion } from '../tts/prosody';
import { clamp, clamp01, round } from './util';
import type {
  CognitiveState,
  EmphasisPolicy,
  IvccTier,
  SemanticInterpretation,
  VoiceTraits,
} from './types';

export interface CognitiveInput {
  readonly text: string;
  readonly semantic: SemanticInterpretation;
  readonly traits: VoiceTraits;
  readonly tier: IvccTier;
  readonly explicitEmotion?: Partial<Record<string, number>>;
}

function explicitAxes(explicit?: Partial<Record<string, number>>): Set<EmotionAxis> {
  const out = new Set<EmotionAxis>();
  if (!explicit) return out;
  for (const axis of EMOTION_AXES) {
    const value = explicit[axis];
    if (typeof value === 'number' && Number.isFinite(value)) out.add(axis);
  }
  return out;
}

export function deriveCognitiveState(input: CognitiveInput): CognitiveState {
  const { semantic, traits, tier } = input;
  const emotion: Record<EmotionAxis, number> = { ...inferEmotion(input.text) };

  const positive = Math.max(0, semantic.sentiment);
  const negative = Math.max(0, -semantic.sentiment);
  const question = semantic.intent === 'QUESTION' ? 1 : 0;

  emotion.urgency = clamp01(
    Math.max(emotion.urgency, semantic.urgency) * 0.82 + semantic.urgency * 0.18
  );
  emotion.concern = clamp01(
    emotion.concern +
      semantic.urgency * 0.18 +
      negative * 0.22 +
      (semantic.intent === 'WARN' ? 0.15 : 0)
  );
  emotion.empathy = clamp01(
    emotion.empathy + negative * 0.22 + (semantic.intent === 'APOLOGIZE' ? 0.2 : 0)
  );
  emotion.confidence = clamp01(
    emotion.confidence + semantic.certainty * 0.3 + (1 - semantic.urgency) * 0.05
  );
  emotion.calm = clamp01(emotion.calm + (1 - semantic.urgency) * 0.16 - semantic.urgency * 0.08);
  emotion.excitement = clamp01(
    emotion.excitement + positive * 0.26 + (semantic.intent === 'CELEBRATE' ? 0.22 : 0)
  );
  emotion.warmth = clamp01(emotion.warmth + positive * 0.14 + (traits.warmth - 0.5) * 0.5);
  emotion.formality = clamp01(emotion.formality + (traits.formality - 0.5) * 0.5);
  emotion.authority = clamp01(
    emotion.authority + semantic.certainty * 0.14 + traits.formality * 0.12
  );
  emotion.curiosity = clamp01(emotion.curiosity + question * 0.18);
  emotion.sadness = clamp01(
    emotion.sadness + negative * 0.28 + (semantic.intent === 'APOLOGIZE' ? 0.12 : 0)
  );
  emotion.excitement = clamp01(emotion.excitement + (traits.energy - 0.5) * 0.35);

  for (const axis of explicitAxes(input.explicitEmotion)) {
    emotion[axis] = clamp01(input.explicitEmotion![axis]!);
  }

  const cognitiveLoad = clamp01(
    0.16 +
      Math.min(0.36, semantic.tokens / 120) +
      semantic.clauses.length * 0.018 +
      semantic.urgency * 0.28 +
      (semantic.language === 'mixed' ? 0.1 : 0)
  );
  const attention = clamp01(
    0.55 + semantic.urgency * 0.22 + (semantic.intent === 'WARN' ? 0.1 : 0) - cognitiveLoad * 0.1
  );
  const certainty = clamp01(
    semantic.certainty * 0.78 + (1 - cognitiveLoad) * 0.1 + emotion.confidence * 0.12
  );
  const dominance = clamp01(
    emotion.authority * 0.55 + emotion.confidence * 0.3 + traits.formality * 0.15
  );
  const tempo = clamp(
    0.5 +
      (traits.rate - 0.5) * 0.6 +
      semantic.urgency * 0.2 +
      emotion.excitement * 0.12 -
      emotion.calm * 0.1,
    0.25,
    0.95
  );

  let emphasisPolicy: EmphasisPolicy = 'balanced';
  if (tier === 'S') emphasisPolicy = 'restrained';
  else if (emotion.excitement + semantic.urgency >= 0.9) emphasisPolicy = 'expressive';

  const rationale: string[] = [
    `intent=${semantic.intent}`,
    `urgency=${round(semantic.urgency)}`,
    `certainty=${round(certainty)}`,
    `cognitiveLoad=${round(cognitiveLoad)}`,
    `tempo=${round(tempo)}`,
  ];
  if (tier === 'S') rationale.push('tier=S mantiene énfasis restringido');
  if (explicitAxes(input.explicitEmotion).size > 0) {
    rationale.push(`explicitAxes=${[...explicitAxes(input.explicitEmotion)].sort().join(',')}`);
  }
  if (semantic.intent === 'WARN') rationale.push('warning-guard: entonación de alerta');

  return {
    emotion: Object.fromEntries(
      EMOTION_AXES.map((axis) => [axis, round(emotion[axis])])
    ) as EmotionVector,
    attention: round(attention),
    cognitiveLoad: round(cognitiveLoad),
    certainty: round(certainty),
    dominance: round(dominance),
    tempo: round(tempo),
    emphasisPolicy,
    rationale,
  };
}
