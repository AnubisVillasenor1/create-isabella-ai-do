/**
 * Layer 5: multi-layer prosody (rate, pitch, volume, range, contour, pauses)
 * and Layer 5b: breathing planner. These are plans for a playback backend, not
 * neural audio: no breath sample and no vocoder is synthesized here.
 */
import {
  IVCC_TIER_FEATURES,
  type BreathEvent,
  type BreathPlan,
  type CognitiveState,
  type EmphasisPlan,
  type EmphasisSpan,
  type IvccProsodyPlan,
  type IvccSpeechPlan,
  type IvccTier,
  type PitchPoint,
  type PauseSpec,
  type SemanticInterpretation,
  type UnitProsody,
  type VoiceTraits,
} from './types';
import { averageRateOf } from './planner';
import { clamp, round } from './util';

export interface ProsodyInput {
  readonly plan: IvccSpeechPlan;
  readonly cognitive: CognitiveState;
  readonly semantic: SemanticInterpretation;
  readonly emphasis: EmphasisPlan;
  readonly traits: VoiceTraits;
  readonly tier: IvccTier;
}

function contourFor(
  basePitch: number,
  range: number,
  role: string,
  question: boolean
): PitchPoint[] {
  let shape: number[];
  if (question) shape = [-0.2, 0.1, 0.3, 0.55, 0.85];
  else if (role === 'warning') shape = [0.05, 0.3, 0.45, 0.28, 0.15];
  else if (role === 'closing') shape = [0.12, 0.02, -0.1, -0.24, -0.38];
  else shape = [-0.08, 0.16, 0.26, 0.02, -0.26];
  return shape.map((point, index) => ({
    at: round(index / (shape.length - 1), 2),
    pitchSemitones: round(basePitch + point * range, 2),
  }));
}

function internalPauses(text: string, durationMs: number): PauseSpec[] {
  if (durationMs < 800) return [];
  const pauses: PauseSpec[] = [];
  const length = Math.max(1, text.length);
  text.replace(/[,;:]/g, (mark, offset: number) => {
    const progress = offset / length;
    const duration = mark === ';' ? 130 : mark === ':' ? 110 : 75;
    pauses.push({
      atMs: Math.round(progress * durationMs),
      durationMs: duration,
      kind: mark === ';' ? 'phrase' : 'micro',
    });
    return mark;
  });
  return pauses.slice(0, 8);
}

function emphasisForUnit(unitEmphasis: readonly string[], plan: EmphasisPlan): EmphasisSpan[] {
  return plan.spans
    .filter((span) => unitEmphasis.includes(span.text))
    .map((span) => ({ text: span.text, strength: span.strength, reason: span.reason }))
    .slice(0, 4);
}

export function planProsody(input: ProsodyInput): IvccProsodyPlan {
  const { plan, cognitive, semantic, emphasis, traits } = input;
  const emotion = cognitive.emotion;
  const units: UnitProsody[] = plan.units.map((unit) => {
    const roleDelta =
      unit.role === 'warning'
        ? -0.02
        : unit.role === 'closing'
          ? -0.05
          : unit.role === 'opening'
            ? 0.01
            : 0;
    const rate = clamp(
      0.93 +
        (traits.rate - 0.5) * 0.24 +
        (cognitive.tempo - 0.5) * 0.26 +
        emotion.excitement * 0.06 +
        semantic.urgency * 0.08 -
        emotion.calm * 0.05 +
        roleDelta,
      0.72,
      1.28
    );
    const pitchSemitones = clamp(
      (traits.pitch - 0.5) * 2 +
        (cognitive.dominance - 0.5) * 1.2 +
        emotion.excitement * 0.8 -
        emotion.sadness * 0.6 +
        (unit.role === 'warning' ? 0.3 : 0),
      -2.5,
      3
    );
    const volume = clamp(
      0.82 +
        (traits.energy - 0.5) * 0.2 +
        emotion.excitement * 0.1 +
        semantic.urgency * 0.05 -
        emotion.calm * 0.03,
      0.7,
      1.1
    );
    const range = clamp(
      0.7 + emotion.excitement * 0.35 + semantic.urgency * 0.15 + emotion.empathy * 0.1,
      0.6,
      1.4
    );
    const unitQuestion = /\?/.test(unit.text) || (unit.terminal === '?' && unit.role === 'closing');
    return {
      unitId: unit.id,
      rate: round(rate, 3),
      pitchSemitones: round(pitchSemitones, 2),
      volume: round(volume, 3),
      range: round(range, 3),
      contour: contourFor(pitchSemitones, range, unit.role, unitQuestion),
      pauses: internalPauses(unit.text, unit.estimatedDurationMs),
      emphasis: emphasisForUnit(unit.emphasis, emphasis),
    };
  });
  return {
    units,
    estimatedDurationMs: plan.estimatedDurationMs,
    averageRate: averageRateOf(plan, cognitive.tempo),
  };
}

export function planBreathing(
  plan: IvccSpeechPlan,
  cognitive: CognitiveState,
  tier: IvccTier
): BreathPlan {
  const features = IVCC_TIER_FEATURES[tier];
  if (!features.breathing) {
    return {
      events: [],
      totalBreaths: 0,
      totalInhaleMs: 0,
      modeled: false,
      note: `La capa de respiración requiere tier L o X; tier ${tier} no la planifica. No se sintetiza audio de respiración.`,
    };
  }
  const events: BreathEvent[] = [];
  let cursor = 0;
  let totalInhale = 0;
  for (const unit of plan.units) {
    if (unit.breathBefore) {
      const inhaleMs = Math.round(
        clamp(280 + cognitive.cognitiveLoad * 220 + (unit.role === 'warning' ? 60 : 0), 240, 520)
      );
      const holdMs = Math.round(40 + cognitive.attention * 50);
      const intensity = round(
        clamp(0.25 + cognitive.cognitiveLoad * 0.5 + cognitive.emotion.urgency * 0.2, 0.2, 0.9),
        3
      );
      events.push({
        unitId: unit.id,
        atMs: cursor,
        inhaleMs,
        holdMs,
        intensity,
        audible: intensity >= 0.55,
      });
      cursor += inhaleMs + holdMs;
      totalInhale += inhaleMs + holdMs;
    }
    if (unit.estimatedDurationMs >= 9_000) {
      const inhaleMs = Math.round(clamp(220 + cognitive.cognitiveLoad * 160, 200, 400));
      events.push({
        unitId: unit.id,
        atMs: cursor + Math.round(unit.estimatedDurationMs / 2),
        inhaleMs,
        holdMs: 30,
        intensity: round(clamp(0.2 + cognitive.cognitiveLoad * 0.35, 0.15, 0.65), 3),
        audible: false,
      });
      totalInhale += inhaleMs + 30;
    }
    cursor += unit.estimatedDurationMs + unit.pauseAfterMs;
  }
  return {
    events,
    totalBreaths: events.length,
    totalInhaleMs: totalInhale,
    modeled: false,
    note: 'Plan de respiración (pausas e intensidad); no se sintetiza una muestra de aire ni se usa un modelo neuronal de respiración.',
  };
}
