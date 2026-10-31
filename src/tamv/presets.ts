/**
 * state: draft | engine-generated — TAMV Kaos Audio System: fábrica de presets.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * Once presets de fábrica sobre la matriz de cinco ejes. Son datos: describen una cadena DSP,
 * una geometría espacial y un patrón háptico. No instancian filtros ni hablan con un
 * actuador. La distancia entre presets es una métrica determinista sobre la matriz, no una
 * "sensación" del modelo.
 */
import {
  ACOUSTIC_ENVIRONMENTS,
  CONTENT_TYPES,
  EMOTIONAL_PROFILES,
  HAPTIC_INTENSITIES,
  SPATIAL_COMPLEXITIES,
  TAMV_PRESET_SCHEMA_VERSION,
  type AcousticEnvironment,
  type ContentType,
  type DspStage,
  type DspStageKind,
  type EmotionalProfile,
  type HapticIntensity,
  type HapticPattern,
  type HapticSyncTrigger,
  type PresetMatrix,
  type SpatialComplexity,
  type SpatialConfig,
  type TamvPreset,
} from './types';

/** Agrupación acústica usada por la métrica de similitud. */
export const ACOUSTIC_ENVIRONMENT_GROUP: Readonly<Record<AcousticEnvironment, string>> =
  Object.freeze({
    cathedral: 'indoor_vast',
    concert_hall: 'indoor_large',
    jazz_club: 'indoor_small',
    broadcast_studio: 'indoor_small',
    amphitheater: 'outdoor_semi',
    open_field: 'outdoor_wide',
    urban_street: 'reflective_narrow',
    vr_space: 'synthetic',
  });

type StageParams = Readonly<Record<string, number | boolean | string>>;

function stage(kind: DspStageKind, order: number, parameters: StageParams): DspStage {
  return { kind, order, parameters };
}

function preset(input: {
  readonly presetId: string;
  readonly displayName: string;
  readonly classification: ContentType;
  readonly matrix: PresetMatrix;
  readonly chain: readonly DspStage[];
  readonly spatial: SpatialConfig;
  readonly pattern: HapticPattern;
  readonly syncTrigger: HapticSyncTrigger;
  readonly note: string;
}): TamvPreset {
  return Object.freeze({
    presetId: input.presetId,
    displayName: input.displayName,
    schemaVersion: TAMV_PRESET_SCHEMA_VERSION,
    source: 'factory',
    classification: input.classification,
    matrix: Object.freeze({ ...input.matrix }),
    processingChain: Object.freeze([...input.chain]),
    spatialConfig: Object.freeze({ ...input.spatial }),
    haptic: Object.freeze({
      pattern: input.pattern,
      intensity: input.matrix.hapticIntensity,
      syncTrigger: input.syncTrigger,
    }),
    usageCount: 0,
    userRating: null,
    note: input.note,
  });
}

/**
 * Cadena base compartida: ganancia → paso alto → EQ de presencia → compresor → reverberación
 * → delay → ancho → saturación → limitador. Cada preset fija sus propios parámetros.
 */
function chain(input: {
  readonly gainDb: number;
  readonly highpassHz: number;
  readonly presenceHz: number;
  readonly presenceGainDb: number;
  readonly thresholdDbfs: number;
  readonly ratio: number;
  readonly reverbSeconds: number;
  readonly reverbMix: number;
  readonly delayMs: number;
  readonly width: number;
  readonly saturationDrive: number;
  readonly ceilingDbfs: number;
}): readonly DspStage[] {
  return [
    stage('gain', 1, { gainDb: input.gainDb }),
    stage('highpass', 2, { hz: input.highpassHz, order: 2 }),
    stage('presence_eq', 3, { hz: input.presenceHz, gainDb: input.presenceGainDb, q: 0.9 }),
    stage('compressor', 4, {
      thresholdDbfs: input.thresholdDbfs,
      ratio: input.ratio,
      attackMs: 12,
      releaseMs: 180,
    }),
    stage('reverb', 5, { rt60Seconds: input.reverbSeconds, mix: input.reverbMix }),
    stage('delay', 6, { timeMs: input.delayMs, feedback: 0.18, mix: 0.12 }),
    stage('width', 7, { factor: input.width }),
    stage('saturation', 8, { drive: input.saturationDrive, mode: 'soft_clip' }),
    stage('limiter', 9, { ceilingDbfs: input.ceilingDbfs, lookAheadMs: 2 }),
  ];
}

export const TAMV_FACTORY_PRESETS: readonly TamvPreset[] = Object.freeze([
  preset({
    presetId: 'cathedral_reverence',
    displayName: 'Cathedral Reverence',
    classification: 'ambient',
    matrix: {
      environment: 'cathedral',
      content: 'ambient',
      emotion: 'reverent',
      spatialComplexity: 'rich',
      hapticIntensity: 'moderate',
    },
    chain: chain({
      gainDb: 0.5,
      highpassHz: 45,
      presenceHz: 2600,
      presenceGainDb: 1.5,
      thresholdDbfs: -20,
      ratio: 2,
      reverbSeconds: 8.5,
      reverbMix: 0.42,
      delayMs: 180,
      width: 1.55,
      saturationDrive: 0.04,
      ceilingDbfs: -1.0,
    }),
    spatial: {
      width: 1.55,
      depth: 0.78,
      height: 0.62,
      focus: 0.32,
      roomSizeSeconds: 8.5,
      absorption: 0.14,
      diffusion: 0.86,
    },
    pattern: 'breath',
    syncTrigger: 'ambient',
    note: 'RT60 de 8.5 s: la cola domina por diseño. Sin medidor de RT60 real en este runtime; el valor es objetivo, no medición.',
  }),
  preset({
    presetId: 'concert_hall_vienna',
    displayName: 'Concert Hall Vienna',
    classification: 'music',
    matrix: {
      environment: 'concert_hall',
      content: 'music',
      emotion: 'expansive',
      spatialComplexity: 'dense',
      hapticIntensity: 'subtle',
    },
    chain: chain({
      gainDb: 0,
      highpassHz: 35,
      presenceHz: 3200,
      presenceGainDb: 1.0,
      thresholdDbfs: -18,
      ratio: 2.2,
      reverbSeconds: 2.0,
      reverbMix: 0.26,
      delayMs: 60,
      width: 1.4,
      saturationDrive: 0.02,
      ceilingDbfs: -0.8,
    }),
    spatial: {
      width: 1.4,
      depth: 0.66,
      height: 0.5,
      focus: 0.46,
      roomSizeSeconds: 2.0,
      absorption: 0.22,
      diffusion: 0.72,
    },
    pattern: 'presence',
    syncTrigger: 'transient',
    note: 'Apertura declarada de 180° expresada como factor de ancho 1.4. La geometría real depende de un downstream que aquí no existe.',
  }),
  preset({
    presetId: 'intimate_jazz_club',
    displayName: 'Intimate Jazz Club',
    classification: 'music',
    matrix: {
      environment: 'jazz_club',
      content: 'music',
      emotion: 'intimate',
      spatialComplexity: 'moderate',
      hapticIntensity: 'subtle',
    },
    chain: chain({
      gainDb: 1.2,
      highpassHz: 55,
      presenceHz: 2200,
      presenceGainDb: 1.8,
      thresholdDbfs: -16,
      ratio: 1.8,
      reverbSeconds: 0.6,
      reverbMix: 0.16,
      delayMs: 28,
      width: 0.92,
      saturationDrive: 0.08,
      ceilingDbfs: -1.2,
    }),
    spatial: {
      width: 0.92,
      depth: 0.42,
      height: 0.24,
      focus: 0.72,
      roomSizeSeconds: 0.6,
      absorption: 0.48,
      diffusion: 0.4,
    },
    pattern: 'heartbeat',
    syncTrigger: 'kick',
    note: 'Fuente frontal cercana: focus alto y cola corta.',
  }),
  preset({
    presetId: 'electronic_hyperspace',
    displayName: 'Electronic Hyperspace',
    classification: 'music',
    matrix: {
      environment: 'vr_space',
      content: 'music',
      emotion: 'energetic',
      spatialComplexity: 'dense',
      hapticIntensity: 'immersive',
    },
    chain: chain({
      gainDb: 1.8,
      highpassHz: 28,
      presenceHz: 4200,
      presenceGainDb: 2.2,
      thresholdDbfs: -14,
      ratio: 3,
      reverbSeconds: 2.6,
      reverbMix: 0.3,
      delayMs: 120,
      width: 2,
      saturationDrive: 0.16,
      ceilingDbfs: -0.6,
    }),
    spatial: {
      width: 2,
      depth: 0.85,
      height: 0.85,
      focus: 0.2,
      roomSizeSeconds: 2.6,
      absorption: 0.1,
      diffusion: 0.95,
    },
    pattern: 'sub_impact',
    syncTrigger: 'kick',
    note: 'Envoltura 360° declarada (width 2.0). Sin render binaural ni HRTF en este runtime.',
  }),
  preset({
    presetId: 'classical_orchestration',
    displayName: 'Classical Orchestration',
    classification: 'music',
    matrix: {
      environment: 'concert_hall',
      content: 'music',
      emotion: 'warm',
      spatialComplexity: 'rich',
      hapticIntensity: 'none',
    },
    chain: chain({
      gainDb: -0.5,
      highpassHz: 30,
      presenceHz: 2800,
      presenceGainDb: 0.6,
      thresholdDbfs: -22,
      ratio: 1.6,
      reverbSeconds: 1.8,
      reverbMix: 0.24,
      delayMs: 40,
      width: 1.28,
      saturationDrive: 0,
      ceilingDbfs: -1.0,
    }),
    spatial: {
      width: 1.28,
      depth: 0.6,
      height: 0.38,
      focus: 0.5,
      roomSizeSeconds: 1.8,
      absorption: 0.26,
      diffusion: 0.68,
    },
    pattern: 'presence',
    syncTrigger: 'off',
    note: 'Rango dinámico priorizado sobre presión: compresión suave y sin saturación.',
  }),
  preset({
    presetId: 'hiphop_urban_soundscape',
    displayName: 'Hip-Hop Urban Soundscape',
    classification: 'music',
    matrix: {
      environment: 'urban_street',
      content: 'music',
      emotion: 'energetic',
      spatialComplexity: 'moderate',
      hapticIntensity: 'strong',
    },
    chain: chain({
      gainDb: 2.4,
      highpassHz: 22,
      presenceHz: 3600,
      presenceGainDb: 1.4,
      thresholdDbfs: -12,
      ratio: 4,
      reverbSeconds: 0.9,
      reverbMix: 0.14,
      delayMs: 90,
      width: 1.1,
      saturationDrive: 0.2,
      ceilingDbfs: -0.5,
    }),
    spatial: {
      width: 1.1,
      depth: 0.4,
      height: 0.3,
      focus: 0.66,
      roomSizeSeconds: 0.9,
      absorption: 0.4,
      diffusion: 0.36,
    },
    pattern: 'kick_pulse',
    syncTrigger: 'kick',
    note: 'Sub prioritizado; el patrón háptico `kick_pulse` se sincroniza por transitorios de grave, no por red neuronal.',
  }),
  preset({
    presetId: 'ambient_transcendence',
    displayName: 'Ambient Transcendence',
    classification: 'ambient',
    matrix: {
      environment: 'open_field',
      content: 'ambient',
      emotion: 'expansive',
      spatialComplexity: 'rich',
      hapticIntensity: 'moderate',
    },
    chain: chain({
      gainDb: 0.8,
      highpassHz: 40,
      presenceHz: 2400,
      presenceGainDb: 1.2,
      thresholdDbfs: -20,
      ratio: 2,
      reverbSeconds: 5.2,
      reverbMix: 0.38,
      delayMs: 210,
      width: 1.7,
      saturationDrive: 0.03,
      ceilingDbfs: -1.0,
    }),
    spatial: {
      width: 1.7,
      depth: 0.8,
      height: 0.7,
      focus: 0.24,
      roomSizeSeconds: 5.2,
      absorption: 0.16,
      diffusion: 0.9,
    },
    pattern: 'respiratory',
    syncTrigger: 'ambient',
    note: 'Pensado para material sin pulso; la densidad transitoria esperada es baja.',
  }),
  preset({
    presetId: 'film_dialog_clarity',
    displayName: 'Film Dialog Clarity',
    classification: 'dialogue',
    matrix: {
      environment: 'broadcast_studio',
      content: 'dialogue',
      emotion: 'neutral',
      spatialComplexity: 'minimal',
      hapticIntensity: 'none',
    },
    chain: chain({
      gainDb: 3.0,
      highpassHz: 95,
      presenceHz: 2800,
      presenceGainDb: 3.5,
      thresholdDbfs: -18,
      ratio: 3,
      reverbSeconds: 0.25,
      reverbMix: 0.05,
      delayMs: 0,
      width: 0.7,
      saturationDrive: 0.02,
      ceilingDbfs: -1.5,
    }),
    spatial: {
      width: 0.7,
      depth: 0.2,
      height: 0.1,
      focus: 0.9,
      roomSizeSeconds: 0.25,
      absorption: 0.6,
      diffusion: 0.25,
    },
    pattern: 'presence',
    syncTrigger: 'voice',
    note: 'Inteligibilidad sobre espacialidad: cola mínima y foco frontal máximo.',
  }),
  preset({
    presetId: 'gaming_battle_mode',
    displayName: 'Gaming Battle Mode',
    classification: 'sfx',
    matrix: {
      environment: 'vr_space',
      content: 'sfx',
      emotion: 'tense',
      spatialComplexity: 'dense',
      hapticIntensity: 'immersive',
    },
    chain: chain({
      gainDb: 2.0,
      highpassHz: 60,
      presenceHz: 4500,
      presenceGainDb: 4.0,
      thresholdDbfs: -14,
      ratio: 3.5,
      reverbSeconds: 0.7,
      reverbMix: 0.12,
      delayMs: 35,
      width: 1.6,
      saturationDrive: 0.14,
      ceilingDbfs: -0.7,
    }),
    spatial: {
      width: 1.6,
      depth: 0.7,
      height: 0.75,
      focus: 0.4,
      roomSizeSeconds: 0.7,
      absorption: 0.3,
      diffusion: 0.6,
    },
    pattern: 'impact',
    syncTrigger: 'transient',
    note: 'Localización de impactos: privilegia transitorios y agudos por encima de musicalidad.',
  }),
  preset({
    presetId: 'vr_presence_maximizer',
    displayName: 'VR Presence Maximizer',
    classification: 'ambient',
    matrix: {
      environment: 'vr_space',
      content: 'ambient',
      emotion: 'expansive',
      spatialComplexity: 'dense',
      hapticIntensity: 'strong',
    },
    chain: chain({
      gainDb: 1.0,
      highpassHz: 35,
      presenceHz: 3000,
      presenceGainDb: 2.0,
      thresholdDbfs: -19,
      ratio: 2.4,
      reverbSeconds: 3.4,
      reverbMix: 0.34,
      delayMs: 140,
      width: 1.85,
      saturationDrive: 0.05,
      ceilingDbfs: -1.0,
    }),
    spatial: {
      width: 1.85,
      depth: 0.88,
      height: 0.92,
      focus: 0.18,
      roomSizeSeconds: 3.4,
      absorption: 0.18,
      diffusion: 0.94,
    },
    pattern: 'breath',
    syncTrigger: 'ambient',
    note: 'Altura declarada 0.92. Requiere un renderer ambisonic/binaural externo para ser audible como 3D.',
  }),
  preset({
    presetId: 'broadcast_studio',
    displayName: 'Broadcast Studio',
    classification: 'dialogue',
    matrix: {
      environment: 'broadcast_studio',
      content: 'dialogue',
      emotion: 'neutral',
      spatialComplexity: 'minimal',
      hapticIntensity: 'subtle',
    },
    chain: chain({
      gainDb: 2.2,
      highpassHz: 110,
      presenceHz: 3100,
      presenceGainDb: 2.6,
      thresholdDbfs: -16,
      ratio: 4,
      reverbSeconds: 0.2,
      reverbMix: 0.04,
      delayMs: 0,
      width: 0.62,
      saturationDrive: 0.03,
      ceilingDbfs: -2.0,
    }),
    spatial: {
      width: 0.62,
      depth: 0.15,
      height: 0.08,
      focus: 0.94,
      roomSizeSeconds: 0.2,
      absorption: 0.65,
      diffusion: 0.2,
    },
    pattern: 'heartbeat',
    syncTrigger: 'voice',
    note: 'Cadena de emisión: techo de -2 dBFS y compresión agresiva por norma de loudness, no por estética.',
  }),
]);

export const TAMV_FACTORY_PRESET_IDS: readonly string[] = Object.freeze(
  TAMV_FACTORY_PRESETS.map((item) => item.presetId)
);

const FACTORY_INDEX: ReadonlyMap<string, TamvPreset> = new Map(
  TAMV_FACTORY_PRESETS.map((item) => [item.presetId, item])
);

export function listFactoryPresets(): readonly TamvPreset[] {
  return TAMV_FACTORY_PRESETS;
}

export function getFactoryPreset(presetId: string): TamvPreset | null {
  return FACTORY_INDEX.get(presetId) ?? null;
}

export function isFactoryPresetId(presetId: string): boolean {
  return FACTORY_INDEX.has(presetId);
}

/** Orden canónico de los ejes: las comparaciones no dependen del orden de declaración. */
function indexOfAxis<T extends string>(axis: readonly T[], value: T): number {
  return Math.max(0, axis.indexOf(value));
}

const ENVIRONMENT_ADIACENCY: Readonly<Record<string, readonly string[]>> = Object.freeze({
  indoor_vast: ['indoor_large'],
  indoor_large: ['indoor_vast', 'indoor_small'],
  indoor_small: ['indoor_large', 'reflective_narrow'],
  reflective_narrow: ['indoor_small', 'outdoor_semi'],
  outdoor_semi: ['reflective_narrow', 'outdoor_wide', 'synthetic'],
  outdoor_wide: ['outdoor_semi', 'synthetic'],
  synthetic: ['outdoor_semi', 'outdoor_wide'],
});

function environmentDistance(a: AcousticEnvironment, b: AcousticEnvironment): number {
  if (a === b) return 0;
  const groupA = ACOUSTIC_ENVIRONMENT_GROUP[a];
  const groupB = ACOUSTIC_ENVIRONMENT_GROUP[b];
  if (groupA === groupB) return 0;
  const neighbours = ENVIRONMENT_ADIACENCY[groupA] ?? [];
  return neighbours.includes(groupB) ? 0.5 : 1;
}

function ordinalDistance<T extends string>(axis: readonly T[], a: T, b: T): number {
  const span = Math.max(1, axis.length - 1);
  return Math.abs(indexOfAxis(axis, a) - indexOfAxis(axis, b)) / span;
}

const PRESET_MATRIX_WEIGHTS = Object.freeze({
  environment: 0.25,
  content: 0.3,
  emotion: 0.15,
  spatialComplexity: 0.15,
  hapticIntensity: 0.15,
} as const);

/** Distancia ponderada 0..1 entre dos matrices. Determinista y explicable. */
export function matrixDistance(a: PresetMatrix, b: PresetMatrix): number {
  const contentDistance =
    a.content === b.content ? 0 : a.content === 'unknown' || b.content === 'unknown' ? 0.5 : 1;
  return (
    PRESET_MATRIX_WEIGHTS.environment * environmentDistance(a.environment, b.environment) +
    PRESET_MATRIX_WEIGHTS.content * contentDistance +
    PRESET_MATRIX_WEIGHTS.emotion * ordinalDistance(EMOTIONAL_PROFILES, a.emotion, b.emotion) +
    PRESET_MATRIX_WEIGHTS.spatialComplexity *
      ordinalDistance(SPATIAL_COMPLEXITIES, a.spatialComplexity, b.spatialComplexity) +
    PRESET_MATRIX_WEIGHTS.hapticIntensity *
      ordinalDistance(HAPTIC_INTENSITIES, a.hapticIntensity, b.hapticIntensity)
  );
}

/**
 * Preset de fábrica más cercano a la matriz objetivo. Empates resueltos por `presetId`
 * (orden lexicográfico) para que la selección sea reproducible.
 */
export function selectClosestFactoryPreset(target: PresetMatrix): TamvPreset {
  let best: TamvPreset | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of TAMV_FACTORY_PRESETS) {
    const distance = matrixDistance(target, candidate.matrix);
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && candidate.presetId < best.presetId)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (best === null) throw new Error('TAMV_PRESET_FACTORY_EMPTY');
  return best;
}

/** Validación cerrada de una matriz leída desde el exterior (nunca confiar en el body). */
export function parsePresetMatrix(
  input: unknown
): { readonly matrix: PresetMatrix } | { readonly error: string } {
  if (typeof input !== 'object' || input === null) return { error: 'TAMV_MATRIX_REQUIRED' };
  const record = input as Record<string, unknown>;
  const oneOf = <T extends string>(
    value: unknown,
    axis: readonly T[],
    name: string
  ): { value: T } | { error: string } => {
    if (typeof value !== 'string' || !(axis as readonly string[]).includes(value)) {
      return { error: `TAMV_MATRIX_${name.toUpperCase()}_INVALID` };
    }
    return { value: value as T };
  };
  const environment = oneOf(record.environment, ACOUSTIC_ENVIRONMENTS, 'environment');
  if ('error' in environment) return environment;
  const content = oneOf(record.content, CONTENT_TYPES, 'content');
  if ('error' in content) return content;
  const emotion = oneOf(record.emotion, EMOTIONAL_PROFILES, 'emotion');
  if ('error' in emotion) return emotion;
  const spatialComplexity = oneOf(
    record.spatialComplexity,
    SPATIAL_COMPLEXITIES,
    'spatial_complexity'
  );
  if ('error' in spatialComplexity) return spatialComplexity;
  const hapticIntensity = oneOf(record.hapticIntensity, HAPTIC_INTENSITIES, 'haptic_intensity');
  if ('error' in hapticIntensity) return hapticIntensity;
  return {
    matrix: {
      environment: environment.value,
      content: content.value,
      emotion: emotion.value,
      spatialComplexity: spatialComplexity.value,
      hapticIntensity: hapticIntensity.value,
    },
  };
}
