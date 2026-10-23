/**
 * state: engine-generated
 * Emotion vector for speech. A small, explicit set (not a trained 128-dim matrix): each axis is clamped to 0..1,
 * inferred from text by transparent heuristics, optionally overridden by the caller, and mapped to prosody multipliers.
 */
export const EMOTION_AXES = ["authority", "confidence", "urgency", "humor", "empathy", "excitement", "calm", "warmth"] as const;
export type EmotionAxis = (typeof EMOTION_AXES)[number];
export type EmotionVector = Readonly<Record<EmotionAxis, number>>;

/** Isabella's resting character: composed, warm, confident. */
export const ISABELLA_BASELINE: EmotionVector = Object.freeze({ authority: 0.55, confidence: 0.8, urgency: 0.15, humor: 0.1, empathy: 0.6, excitement: 0.2, calm: 0.7, warmth: 0.7 });

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function sanitizeEmotion(partial: Partial<Record<string, unknown>> | undefined): Partial<Record<EmotionAxis, number>> {
  const out: Partial<Record<EmotionAxis, number>> = {};
  if (!partial) return out;
  for (const axis of EMOTION_AXES) {
    const v = partial[axis];
    if (typeof v === "number" && Number.isFinite(v)) out[axis] = clamp01(v);
  }
  return out;
}

export function inferEmotion(text: string): Partial<Record<EmotionAxis, number>> {
  const t = text.toLowerCase();
  const count = (re: RegExp): number => (t.match(re) ?? []).length;
  const out: Partial<Record<EmotionAxis, number>> = {};
  const bangs = count(/!/g);
  if (bangs > 0) out.excitement = clamp01(0.3 + 0.2 * bangs);
  if (/(urgente|inmediat|ahora mismo|cuanto antes|crític)/.test(t)) { out.urgency = 0.75; out.calm = 0.35; }
  if (/(lo siento|lamento|perdón|disculp|entiendo cómo|ánimo)/.test(t)) { out.empathy = 0.9; out.warmth = 0.85; out.excitement = 0.1; out.calm = 0.85; }
  if (/(jaja|jeje|😄|😂|qué padre|qué chido)/.test(t)) out.humor = 0.7;
  if (/(error|falla|riesgo|advertencia|peligro|seguridad|vulnerab)/.test(t)) { out.authority = 0.8; out.calm = Math.max(out.calm ?? 0, 0.6); }
  if (/(gracias|felicidades|excelente|bienvenid)/.test(t)) { out.warmth = 0.85; out.excitement = Math.max(out.excitement ?? 0, 0.4); }
  return out;
}

/** Baseline ← inferred ← caller override (later wins). */
export function resolveEmotion(text: string, override?: Partial<Record<string, unknown>>): EmotionVector {
  const merged: Record<EmotionAxis, number> = { ...ISABELLA_BASELINE };
  for (const [k, v] of Object.entries({ ...inferEmotion(text), ...sanitizeEmotion(override) })) {
    merged[k as EmotionAxis] = clamp01(v as number);
  }
  return Object.freeze(merged);
}

export interface ProsodyModifiers { readonly rateMul: number; readonly pitchMul: number; readonly pauseScale: number }

const bound = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function emotionToProsody(e: EmotionVector): ProsodyModifiers {
  const rateMul = bound(1 + 0.18 * (e.urgency - 0.15) + 0.1 * (e.excitement - 0.2) - 0.1 * (e.calm - 0.7), 0.82, 1.15);
  const pitchMul = bound(1 + 0.08 * (e.excitement - 0.2) + 0.05 * (e.humor - 0.1) + 0.03 * (e.warmth - 0.7) - 0.05 * (e.authority - 0.55), 0.92, 1.08);
  const pauseScale = bound(1 + 0.5 * (e.calm - 0.7) - 0.6 * (e.urgency - 0.15) + 0.2 * (e.empathy - 0.6), 0.6, 1.4);
  return { rateMul, pitchMul, pauseScale };
}
