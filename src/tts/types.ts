/** state: engine-generated — shared TTS types. */
export type VoiceMode = 'CONVERSACION' | 'PODCAST' | 'TIEMPO_REAL' | 'EDGE_LITE' | 'CROSS_LINGUAL';
export const VOICE_MODES: readonly VoiceMode[] = [
  'CONVERSACION',
  'PODCAST',
  'TIEMPO_REAL',
  'EDGE_LITE',
  'CROSS_LINGUAL',
];
export type MxRegion = 'norte' | 'occidente' | 'cdmx' | 'bajio' | 'sur' | 'peninsular';
export const MX_REGIONS: readonly MxRegion[] = [
  'norte',
  'occidente',
  'cdmx',
  'bajio',
  'sur',
  'peninsular',
];

/** Emotion axes actually implemented (a 12-axis subset of the spec's Ω-X128 — see docs/tts). */
export const EMOTION_AXES = [
  'authority',
  'confidence',
  'urgency',
  'humor',
  'empathy',
  'excitement',
  'calm',
  'warmth',
  'curiosity',
  'concern',
  'formality',
  'sadness',
] as const;
export type EmotionAxis = (typeof EMOTION_AXES)[number];
export type EmotionVector = Readonly<Record<EmotionAxis, number>>;

export interface SpeechRequest {
  readonly text: string;
  readonly actorId?: string;
  readonly nonce?: string;
  readonly mode?: VoiceMode;
  readonly region?: MxRegion;
  readonly emotionVector?: Partial<Record<string, number>>;
}

export interface CulturalCue {
  readonly id: string;
  readonly match: string;
  readonly interpretation: string;
  readonly confidence: number;
}

export interface PhrasePlan {
  readonly text: string;
  readonly rate: number;
  readonly pitch: number;
  readonly volume: number;
  readonly pauseAfterMs: number;
  readonly breathBefore: boolean;
  readonly emphasis: readonly string[];
}

export interface ProsodyPlan {
  readonly phrases: readonly PhrasePlan[];
  readonly emotion: EmotionVector;
  readonly cues: readonly CulturalCue[];
  readonly estimatedDurationMs: number;
}

export type ExpertKind = 'native-fsim' | 'server-tts' | 'browser-speech';
