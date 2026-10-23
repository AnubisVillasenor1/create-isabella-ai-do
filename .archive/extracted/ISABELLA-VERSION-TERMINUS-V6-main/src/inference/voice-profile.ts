/**
 * state: draft
 * Isabella official-voice reference profile.
 *
 * Source: a user-provided reference sample (synthetic text-to-speech, ~21 s, Spanish).
 * Honesty: this is a MEASURED TARGET for choosing a voice and tuning prosody. It is NOT voice
 * cloning — no speaker model is trained or used, and no audio of the sample is stored in the repo.
 * CAPABILITY ≠ AUTHORITY: a profile selects how text is spoken; it grants nothing.
 */
export interface VoiceProfile {
  readonly id: string;
  readonly state: "draft";
  readonly language: "es";
  readonly cloning: false;
  readonly f0Hz: { readonly median: number; readonly p10: number; readonly p90: number; readonly std: number };
  readonly pauses: { readonly minMs: number; readonly meanMs: number };
  readonly speechFraction: number;
  readonly spectralCentroidHz: number;
}

export const ISABELLA_VOICE_PROFILE: VoiceProfile = Object.freeze({
  id: "isabella-reference-v1",
  state: "draft",
  language: "es",
  cloning: false,
  f0Hz: Object.freeze({ median: 205, p10: 172, p90: 281, std: 43 }),
  pauses: Object.freeze({ minMs: 250, meanMs: 707 }),
  speechFraction: 0.62,
  spectralCentroidHz: 548,
});

/** Browser/engine prosody derived from the profile: warm mid-female register, unhurried, clear pauses. */
export interface ProsodyPlan {
  readonly rate: number;
  readonly pitch: number;
  readonly sentencePauseMs: number;
  readonly clausePauseMs: number;
}

export const ISABELLA_PROSODY: ProsodyPlan = Object.freeze({
  rate: 0.93,
  pitch: 1.0,
  sentencePauseMs: 420,
  clausePauseMs: 140,
});

export interface VoiceCandidate {
  readonly name: string;
  readonly lang: string;
  readonly localService?: boolean;
}

const PREFERRED_LANGS = ["es-MX", "es-419", "es-US", "es-ES"] as const;
const PREFERRED_NAMES = ["sabina", "paulina", "monica", "mónica", "marisol", "helena", "luciana", "dalia", "elvira", "salome"] as const;

/** Higher is better; negative means "not Spanish, never use". Mirrors src/ui/app.js chooseIsabellaVoice. */
export function scoreVoiceCandidate(c: VoiceCandidate): number {
  const lang = c.lang.replace("_", "-");
  if (!lang.toLowerCase().startsWith("es")) return -1;
  const langIdx = PREFERRED_LANGS.findIndex((l) => l.toLowerCase() === lang.toLowerCase());
  const named = PREFERRED_NAMES.some((n) => c.name.toLowerCase().includes(n)) ? 100 : 0;
  return named + (langIdx >= 0 ? 40 - langIdx * 5 : 20) + (c.localService ? 2 : 0);
}

export function pickVoice<T extends VoiceCandidate>(candidates: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = scoreVoiceCandidate(c);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return best;
}

/** Split text into speakable chunks so playback starts after the first sentence and never hits engine length limits. */
export function chunkForSpeech(text: string, maxChunk = 220): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
  const out: string[] = [];
  for (const raw of sentences) {
    let s = raw.trim();
    while (s.length > maxChunk) {
      const cut = s.lastIndexOf(",", maxChunk) > 40 ? s.lastIndexOf(",", maxChunk) + 1 : s.lastIndexOf(" ", maxChunk);
      const at = cut > 0 ? cut : maxChunk;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}
