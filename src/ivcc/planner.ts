/**
 * Layer 4: dynamic speech planner. Splits normalized text into speakable units,
 * assigns roles, pause budgets and breath candidates. Deterministic and
 * bounded by tier; oversized inputs are rejected, never silently truncated.
 */
import {
  IVCC_TIER_FEATURES,
  type CognitiveState,
  type EmphasisPlan,
  type IvccSpeechPlan,
  type IvccTier,
  type SemanticInterpretation,
  type SpeechUnit,
  type SpeechUnitRole,
  type VoiceTraits,
} from './types';
import { clamp, round } from './util';

const MAX_UNIT_CHARS = 220;
const CHARS_PER_SECOND_BASE = 11;

export class IvccPlanLimitError extends Error {
  constructor(
    readonly code: 'IVCC_TEXT_SIZE_LIMIT_EXCEEDED' | 'IVCC_PLAN_TOO_MANY_UNITS',
    message: string
  ) {
    super(message);
    this.name = 'IvccPlanLimitError';
  }
}

function packSegments(segments: readonly string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = '';
  const flush = (): void => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = '';
  };
  for (const segment of segments) {
    const text = segment.trim();
    if (!text) continue;
    if (text.length > maxChars) {
      flush();
      const words = text.split(/\s+/);
      let piece = '';
      for (const word of words) {
        const candidate = piece ? `${piece} ${word}` : word;
        if (candidate.length > maxChars && piece) {
          chunks.push(piece);
          piece = word;
        } else {
          piece = candidate;
        }
      }
      if (piece) chunks.push(piece);
      continue;
    }
    const candidate = current ? `${current} ${text}` : text;
    if (candidate.length > maxChars) {
      flush();
      current = text;
    } else {
      current = candidate;
    }
  }
  flush();
  return chunks.length ? chunks : [segments.join(' ').trim()].filter(Boolean);
}

function splitClause(text: string): string[] {
  const segments = text.match(/[^,;:]+[,;:]?\s*/g) ?? [text];
  return packSegments(segments, MAX_UNIT_CHARS);
}

function pauseForTerminal(
  terminal: string,
  tempo: number,
  style: VoiceTraits['pauseStyle']
): number {
  const base =
    terminal === '.'
      ? 260
      : terminal === '?'
        ? 300
        : terminal === '!'
          ? 230
          : terminal === '…'
            ? 330
            : terminal === ';'
              ? 180
              : terminal === ':'
                ? 160
                : 150;
  const tempoFactor = clamp(1.14 - tempo * 0.3, 0.82, 1.08);
  const styleFactor = style === 'compact' ? 0.8 : style === 'dramatic' ? 1.3 : 1;
  return Math.round(base * tempoFactor * styleFactor);
}

function roleFor(index: number, total: number, warning: boolean): SpeechUnitRole {
  if (warning) return 'warning';
  if (index === 0 && total > 1) return 'opening';
  if (index === total - 1) return 'closing';
  return 'core';
}

export interface PlannerInput {
  readonly text: string;
  readonly semantic: SemanticInterpretation;
  readonly cognitive: CognitiveState;
  readonly emphasis: EmphasisPlan;
  readonly traits: VoiceTraits;
  readonly tier: IvccTier;
}

export function buildSpeechPlan(input: PlannerInput): IvccSpeechPlan {
  const features = IVCC_TIER_FEATURES[input.tier];
  if (input.text.length > features.maxChars) {
    throw new IvccPlanLimitError(
      'IVCC_TEXT_SIZE_LIMIT_EXCEEDED',
      `text exceeds tier ${input.tier} limit`
    );
  }
  const drafts: Array<{
    text: string;
    terminal: string;
    clauseIndex: number;
    warning: boolean;
    emphasis: string[];
  }> = [];
  for (const clause of input.semantic.clauses) {
    const clauseWarning = clause.intent === 'WARN';
    const emphasis = input.emphasis.spans
      .filter((span) => clause.text.includes(span.text))
      .map((span) => span.text);
    const pieces = splitClause(clause.text);
    pieces.forEach((piece, index) => {
      const isLast = index === pieces.length - 1;
      drafts.push({
        text: piece,
        terminal: isLast ? clause.terminal : ',',
        clauseIndex: clause.index,
        warning: clauseWarning,
        emphasis,
      });
    });
  }
  if (!drafts.length) {
    throw new IvccPlanLimitError('IVCC_TEXT_SIZE_LIMIT_EXCEEDED', 'no speakable units');
  }
  if (drafts.length > features.maxUnits) {
    throw new IvccPlanLimitError(
      'IVCC_PLAN_TOO_MANY_UNITS',
      `unit count ${drafts.length} exceeds tier ${input.tier} limit ${features.maxUnits}`
    );
  }

  const cps = CHARS_PER_SECOND_BASE + input.cognitive.tempo * 7;
  const units: SpeechUnit[] = [];
  let total = 0;
  drafts.forEach((draft, index) => {
    const punctuationPauses = (draft.text.match(/[,;:]/g) ?? []).length * 40;
    const duration = Math.round((draft.text.length / cps) * 1000 + punctuationPauses);
    const role = roleFor(index, drafts.length, draft.warning);
    let pause = pauseForTerminal(draft.terminal, input.cognitive.tempo, input.traits.pauseStyle);
    if (role === 'warning') pause += 40;
    if (role === 'closing') pause += 80;
    if (index === drafts.length - 1) pause = 0;
    const breathBefore = index > 0 && (role === 'warning' || role === 'closing' || total >= 7_000);
    units.push({
      id: `u${index + 1}`,
      index,
      text: draft.text,
      role,
      terminal: draft.terminal,
      emphasis: draft.emphasis,
      pauseAfterMs: pause,
      breathBefore,
      estimatedDurationMs: duration,
    });
    total += duration + pause;
  });

  return {
    units,
    totalChars: input.text.length,
    estimatedDurationMs: total,
    tier: input.tier,
    maxUnits: features.maxUnits,
  };
}

export function averageRateOf(plan: IvccSpeechPlan, tempo: number): number {
  const cps =
    plan.units.length && plan.estimatedDurationMs > 0
      ? plan.totalChars / (plan.estimatedDurationMs / 1000)
      : 0;
  return round(clamp(cps / (CHARS_PER_SECOND_BASE + tempo * 7), 0.5, 1.5), 3);
}
