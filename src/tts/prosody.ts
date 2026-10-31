/**
 * state: engine-generated
 * Mexican Cognitive Prosody (rule-based) + Hyper Prosody planning.
 * HONESTY: cultural cues and emotion are LEXICAL/PUNCTUATION HEURISTICS with stated confidence, not a trained
 * comprehension model. The plan drives rate/pitch/volume/pauses of whichever voice backend is used.
 */
import {
  ISABELLA_PROSODY,
  ISABELLA_VOICE_PROFILE,
  chunkForSpeech,
} from '../inference/voice-profile';
import {
  EMOTION_AXES,
  type CulturalCue,
  type EmotionAxis,
  type EmotionVector,
  type PhrasePlan,
  type ProsodyPlan,
} from './types';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface CueRule {
  readonly id: string;
  readonly re: RegExp;
  readonly interpretation: string;
  readonly confidence: number;
  readonly emotion: Partial<Record<EmotionAxis, number>>;
  readonly rate?: number;
  readonly pitch?: number;
}

const CUE_RULES: readonly CueRule[] = [
  {
    id: 'litotes-elogio',
    re: /\bno (?:estuvo|esta|fue|es|quedo) tan mal\b/,
    interpretation: 'En español mexicano suele ser un elogio (fue bueno).',
    confidence: 0.7,
    emotion: { warmth: 0.5, humor: 0.2 },
    rate: -0.02,
    pitch: 0.03,
  },
  {
    id: 'ahorita-inmediato',
    re: /\bahorita (?:mismo|ya)\b|\bahorita\b.*\bahora mismo\b/,
    interpretation: '«Ahorita» = inmediato.',
    confidence: 0.8,
    emotion: { urgency: 0.5 },
    rate: 0.03,
  },
  {
    id: 'ahorita-posterior',
    re: /\bahorita\b.*\b(?:al rato|mas tarde|luego|manana|despues)\b|\b(?:al rato|mas tarde|luego|despues)\b.*\bahorita\b/,
    interpretation: '«Ahorita» = más tarde.',
    confidence: 0.65,
    emotion: { calm: 0.4 },
    rate: -0.03,
  },
  {
    id: 'ahorita-ambiguo',
    re: /\bahorita\b/,
    interpretation:
      '«Ahorita» sin contexto: puede significar ahora, en minutos o después (ambiguo).',
    confidence: 0.4,
    emotion: {},
  },
  {
    id: 'informal-mx',
    re: /\b(?:orale|chido|chida|padre|que onda|no manches|neta|wey|guey|chamba|chavo|chava)\b/,
    interpretation: 'Registro coloquial mexicano.',
    confidence: 0.85,
    emotion: { warmth: 0.4, formality: -0.3 },
    rate: 0.03,
    pitch: 0.02,
  },
  {
    id: 'empatia-hijole',
    re: /\b(?:hijole|ay no|que mal|lo siento|lamento)\b/,
    interpretation: 'Expresión de empatía o preocupación.',
    confidence: 0.75,
    emotion: { empathy: 0.6, concern: 0.4 },
    rate: -0.04,
    pitch: -0.02,
  },
  {
    id: 'sarcasmo-posible',
    re: /\b(?:si,? como no|claro,? como no|ajaja?|que bien\.\.\.|ya ni modo)\b/,
    interpretation: 'Posible sarcasmo o resignación (heurístico).',
    confidence: 0.45,
    emotion: { humor: 0.3 },
    rate: -0.04,
    pitch: -0.03,
  },
];

const LEX: ReadonlyArray<readonly [RegExp, Partial<Record<EmotionAxis, number>>]> = [
  [
    /\b(?:urgente|inmediat\w+|critic\w+|ya mismo|cuanto antes|ahora mismo)\b/,
    { urgency: 0.7, concern: 0.2 },
  ],
  [
    /\b(?:lamento|siento mucho|desafortunadamente|lastima|triste)\b/,
    { empathy: 0.7, sadness: 0.4 },
  ],
  [/\b(?:gracias|por favor|con gusto|bienvenid\w+|encantad\w+)\b/, { warmth: 0.6, calm: 0.2 }],
  [
    /\b(?:error|falla|fallo|riesgo|peligro|alerta|vulnerabilidad)\b/,
    { concern: 0.6, authority: 0.2 },
  ],
  [/\b(?:jaja\w*|jeje\w*)\b|[😂🤣😄]/u, { humor: 0.7, excitement: 0.3 }],
  [
    /\b(?:excelente|increible|genial|felicidades|logramos|listo)\b/,
    { excitement: 0.5, confidence: 0.4 },
  ],
  [
    /\b(?:arquitectura|protocolo|gobernanza|politica|sistema|evidencia|seguridad|auditoria)\b/,
    { authority: 0.4, formality: 0.4, confidence: 0.2 },
  ],
  [/\b(?:calma|tranquil\w+|con calma|poco a poco)\b/, { calm: 0.7 }],
];

export function emptyEmotion(): Record<EmotionAxis, number> {
  return Object.fromEntries(EMOTION_AXES.map((a) => [a, 0])) as Record<EmotionAxis, number>;
}

/** Merge lexical inference with an explicit user vector (explicit wins, clamped to 0..1). Unknown axes are ignored. */
export function inferEmotion(
  text: string,
  explicit?: Partial<Record<string, number>>
): EmotionVector {
  const e = emptyEmotion();
  const f = fold(text);
  for (const [re, axes] of LEX)
    if (re.test(f) || re.test(text))
      for (const [k, v] of Object.entries(axes) as [EmotionAxis, number][])
        e[k] = clamp(e[k] + v, 0, 1);
  const ex = (text.match(/!/g) ?? []).length;
  if (ex > 0) {
    e.excitement = clamp(e.excitement + 0.15 * ex, 0, 1);
    e.urgency = clamp(e.urgency + 0.05 * ex, 0, 1);
  }
  if (/\?/.test(text)) e.curiosity = clamp(e.curiosity + 0.4, 0, 1);
  if (explicit)
    for (const a of EMOTION_AXES) {
      const v = explicit[a];
      if (typeof v === 'number' && Number.isFinite(v)) e[a] = clamp(v, 0, 1);
    }
  return e;
}

export function detectCulturalCues(text: string): CulturalCue[] {
  const f = fold(text);
  const out: CulturalCue[] = [];
  const seenAhorita = { done: false };
  for (const rule of CUE_RULES) {
    const m = rule.re.exec(f);
    if (!m) continue;
    if (rule.id.startsWith('ahorita')) {
      if (seenAhorita.done) continue;
      seenAhorita.done = true;
    }
    out.push({
      id: rule.id,
      match: m[0],
      interpretation: rule.interpretation,
      confidence: rule.confidence,
    });
  }
  return out;
}

const cueDelta = (cues: readonly CulturalCue[], key: 'rate' | 'pitch'): number =>
  cues.reduce((a, c) => a + (CUE_RULES.find((r) => r.id === c.id)?.[key] ?? 0) * c.confidence, 0);

function splitPhrases(
  text: string
): Array<{ text: string; terminal: string; paragraphEnd: boolean }> {
  const out: Array<{ text: string; terminal: string; paragraphEnd: boolean }> = [];
  for (const para of text.split(/\n{2,}|\n/)) {
    const pieces = para.match(/[^.!?…;:]+[.!?…;:]*/g) ?? [];
    const chunks = pieces.flatMap((p) => chunkForSpeech(p, 220));
    chunks.forEach((c, i) => {
      const t = c.trim();
      if (!t) return;
      const terminal = /[.!?…;:]$/.test(t) ? t.slice(-1) : ',';
      out.push({ text: t, terminal, paragraphEnd: i === chunks.length - 1 });
    });
  }
  return out;
}

export function planProsody(
  text: string,
  opts: { emotion?: Partial<Record<string, number>>; mode?: string } = {}
): ProsodyPlan {
  const emotion = inferEmotion(text, opts.emotion);
  const cues = detectCulturalCues(text);
  const base = ISABELLA_PROSODY;
  const meanPause = ISABELLA_VOICE_PROFILE.pauses.meanMs;
  const modeRate = opts.mode === 'TIEMPO_REAL' ? 0.04 : opts.mode === 'PODCAST' ? -0.02 : 0;
  const rateGlobal =
    1 +
    0.1 * emotion.urgency +
    0.05 * emotion.excitement -
    0.08 * emotion.calm -
    0.06 * emotion.sadness -
    0.04 * emotion.authority +
    cueDelta(cues, 'rate') +
    modeRate;
  const pitchGlobal =
    1 +
    0.06 * emotion.excitement +
    0.03 * emotion.humor -
    0.05 * emotion.sadness -
    0.03 * emotion.authority +
    0.02 * emotion.warmth +
    cueDelta(cues, 'pitch');
  const phrases: PhrasePlan[] = [];
  const parts = splitPhrases(text);
  let prevParagraphEnd = false;
  parts.forEach((p, i) => {
    const q = p.terminal === '?';
    const ex = p.terminal === '!';
    const rate = clamp(base.rate * rateGlobal * (ex ? 1.02 : 1) * (q ? 0.99 : 1), 0.7, 1.3);
    const pitch = clamp(
      base.pitch * pitchGlobal +
        (q ? 0.05 : 0) +
        (ex ? 0.03 : 0) -
        (p.terminal === '.' && i === parts.length - 1 ? 0.02 : 0),
      0.8,
      1.25
    );
    const volume = clamp(
      0.88 + 0.08 * emotion.authority + 0.04 * emotion.excitement - 0.04 * emotion.calm,
      0.7,
      1
    );
    let pause = p.paragraphEnd
      ? meanPause
      : p.terminal === '…'
        ? 600
        : p.terminal === '?' || p.terminal === '!'
          ? Math.round(base.sentencePauseMs * 0.9)
          : p.terminal === '.'
            ? base.sentencePauseMs
            : base.clausePauseMs;
    pause = Math.round(clamp(pause * (1 - 0.3 * emotion.urgency + 0.2 * emotion.calm), 60, 900));
    if (i === parts.length - 1) pause = 0;
    const emphasis = (p.text.match(/\b[A-ZÁÉÍÓÚÑ]{3,}\b/g) ?? []).slice(0, 4);
    phrases.push({
      text: p.text,
      rate: round2(rate),
      pitch: round2(pitch),
      volume: round2(volume),
      pauseAfterMs: pause,
      breathBefore: prevParagraphEnd || p.text.length > 110,
      emphasis,
    });
    prevParagraphEnd = p.paragraphEnd;
  });
  const speakMs = phrases.reduce((a, ph) => a + (ph.text.length / (15 * ph.rate)) * 1000, 0);
  const pauseMs = phrases.reduce((a, ph) => a + ph.pauseAfterMs, 0);
  return { phrases, emotion, cues, estimatedDurationMs: Math.round(speakMs + pauseMs) };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
