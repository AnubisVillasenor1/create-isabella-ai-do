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
  readonly state: 'draft';
  readonly language: 'es';
  readonly cloning: false;
  readonly f0Hz: {
    readonly median: number;
    readonly p10: number;
    readonly p90: number;
    readonly std: number;
  };
  readonly pauses: { readonly minMs: number; readonly meanMs: number };
  readonly speechFraction: number;
  readonly spectralCentroidHz: number;
}

export const ISABELLA_VOICE_PROFILE: VoiceProfile = Object.freeze({
  id: 'isabella-reference-v1',
  state: 'draft',
  language: 'es',
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

/**
 * Canonical Isabella voice. Every backend (neural service, server TTS, browser)
 * must resolve to this single female es-MX identity; per-request overrides are
 * ignored by design. Operators may map the native service voice with
 * `ISABELLA_NATIVE_VOICE_ID`, but the public identity never changes.
 */
export const CANONICAL_VOICE_ID = 'isabella-esmx-female-v1';
export const CANONICAL_PROVIDER_VOICE = 'Celeste-PlayAI';
export const CANONICAL_NATIVE_VOICE_ID = 'isabella-esmx-v1';
export const CANONICAL_VOICE_LANGUAGE = 'es-MX';

export interface CanonicalVoice {
  readonly id: string;
  readonly label: string;
  readonly language: typeof CANONICAL_VOICE_LANGUAGE;
  readonly gender: 'female';
  readonly nativeVoiceId: string;
  readonly providerVoice: string;
}

// Only known female provider voices are accepted from configuration; a male or
// unknown value falls back to the canonical female voice instead of being used.
const FEMALE_PROVIDER_VOICE =
  /^(arista|celeste|cheyenne|deedee|gail|indigo|jennifer|judy|mamaw|nyla|ruby|shelby|tiffany)-playai$/i;

export function resolveCanonicalVoice(
  env: Record<string, string | undefined> = {}
): CanonicalVoice {
  const requestedProvider = (env.GROQ_TTS_VOICE ?? '').trim();
  const providerVoice = FEMALE_PROVIDER_VOICE.test(requestedProvider)
    ? requestedProvider
    : CANONICAL_PROVIDER_VOICE;
  const nativeVoiceId = (env.ISABELLA_NATIVE_VOICE_ID ?? '').trim() || CANONICAL_NATIVE_VOICE_ID;
  return Object.freeze({
    id: CANONICAL_VOICE_ID,
    label: 'Isabella — voz femenina es-MX',
    language: CANONICAL_VOICE_LANGUAGE,
    gender: 'female',
    nativeVoiceId,
    providerVoice,
  });
}

export interface VoiceCandidate {
  readonly name: string;
  readonly lang: string;
  readonly localService?: boolean;
}

const PREFERRED_LANGS = ['es-MX', 'es-419', 'es-US', 'es-ES'] as const;
const PREFERRED_NAMES = [
  'sabina',
  'paulina',
  'monica',
  'mónica',
  'marisol',
  'helena',
  'luciana',
  'dalia',
  'elvira',
  'salome',
  'ximena',
  'valentina',
  'camila',
  'lucia',
  'sofia',
  'sofía',
] as const;

// Known male or gender-ambiguous system voices. Browsers expose no gender
// metadata, so a name denylist is the only reliable guard against a male voice.
const MALE_VOICE_NAME =
  /\b(jorge|diego|carlos|pablo|javier|enrique|raul|raúl|miguel|pedro|juan|alvaro|álvaro|marcos|lucas|mateo|andres|andrés|ricardo|fernando|gonzalo|roberto|eduardo|alex|daniel|david|mark|george|james|fred|ralph|thomas|oliver|arthur|eric|liam|guy|ryan|brian|christopher|steffan|aaron|tony|mason|troy|atlas|briggs|calum|cillian|mikail|mitch|quinn|thunder|zubenelgenubi|sadachbia|sadaltager)\b/i;

/** Higher is better; negative means "not Spanish or not female, never use". Mirrors the shared browser policy. */
export function scoreVoiceCandidate(c: VoiceCandidate): number {
  const lang = c.lang.replace('_', '-');
  if (!lang.toLowerCase().startsWith('es')) return -1;
  if (MALE_VOICE_NAME.test(c.name)) return -1;
  const langIdx = PREFERRED_LANGS.findIndex((l) => l.toLowerCase() === lang.toLowerCase());
  const named = PREFERRED_NAMES.some((n) => c.name.toLowerCase().includes(n)) ? 100 : 0;
  return named + (langIdx >= 0 ? 40 - langIdx * 5 : 20) + (c.localService ? 2 : 0);
}

export function pickVoice<T extends VoiceCandidate>(candidates: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = scoreVoiceCandidate(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

/** Split text into speakable chunks so playback starts after the first sentence and never hits engine length limits. */
export function chunkForSpeech(text: string, maxChunk = 220): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
  const out: string[] = [];
  for (const raw of sentences) {
    let s = raw.trim();
    while (s.length > maxChunk) {
      const cut =
        s.lastIndexOf(',', maxChunk) > 40
          ? s.lastIndexOf(',', maxChunk) + 1
          : s.lastIndexOf(' ', maxChunk);
      const at = cut > 0 ? cut : maxChunk;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}
