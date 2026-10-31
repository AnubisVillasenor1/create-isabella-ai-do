/**
 * state: draft | engine-generated — TAMV Kaos Audio System: contrato de dominio.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo
 * (Anubis Villaseñor). El Kaos Audio System es activo propietario de TAMV ONLINE y se
 * ofrece a terceros únicamente bajo licencia comercial explícita; nada de lo aquí
 * declarado concede uso sin consentimiento. Ver `NOTICE` y `LICENSE`.
 *
 * Invariante (AGENTS.md §1): CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE.
 * Este módulo mide audio real y *declara* transformaciones. Nunca invoca un motor de
 * render, nunca mueve aire, nunca autoriza. Un `TamvRedefineStage` con
 * `executionState: 'declared'` significa literalmente "nadie lo ejecutó".
 */

export const TAMV_ENGINE_VERSION = '1.0.0';
export const TAMV_CLASSIFIER_VERSION = '1.0.0';
export const TAMV_PRESET_SCHEMA_VERSION = '1.0.0';
export const TAMV_PLAN_VERSION = '1.0.0';

/** Identidades de método (§5 AGENTS.md): [TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK].[GOVERNANCE]. */
export const TAMV_METHOD_IDS = Object.freeze({
  presets: 'A.TWINS.E07_TAMV.list_presets.v1.0.0.NEGLIGIBLE.AUTONOMOUS',
  presetDetail: 'A.TWINS.E07_TAMV.get_preset.v1.0.0.NEGLIGIBLE.AUTONOMOUS',
  analyze: 'A.TWINS.E07_TAMV.analyze_audio.v1.0.0.LOW.AUTONOMOUS',
  adaptivePreset: 'A.TWINS.E07_TAMV.derive_adaptive_preset.v1.0.0.LOW.AUTONOMOUS',
  redefinePlan: 'A.TWINS.E07_TAMV.build_redefine_plan.v1.0.0.MEDIUM.OPERATIONAL',
  status: 'A.TWINS.E07_TAMV.runtime_status.v1.0.0.NEGLIGIBLE.AUTONOMOUS',
} as const);

export type TamvMethodId = (typeof TAMV_METHOD_IDS)[keyof typeof TAMV_METHOD_IDS];

export const ACOUSTIC_ENVIRONMENTS = [
  'cathedral',
  'concert_hall',
  'jazz_club',
  'amphitheater',
  'broadcast_studio',
  'vr_space',
  'urban_street',
  'open_field',
] as const;
export type AcousticEnvironment = (typeof ACOUSTIC_ENVIRONMENTS)[number];

export const CONTENT_TYPES = ['music', 'dialogue', 'sfx', 'ambient', 'unknown'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const EMOTIONAL_PROFILES = [
  'reverent',
  'energetic',
  'intimate',
  'expansive',
  'tense',
  'warm',
  'neutral',
] as const;
export type EmotionalProfile = (typeof EMOTIONAL_PROFILES)[number];

export const SPATIAL_COMPLEXITIES = ['minimal', 'moderate', 'rich', 'dense'] as const;
export type SpatialComplexity = (typeof SPATIAL_COMPLEXITIES)[number];

export const HAPTIC_INTENSITIES = ['none', 'subtle', 'moderate', 'strong', 'immersive'] as const;
export type HapticIntensity = (typeof HAPTIC_INTENSITIES)[number];

export const HAPTIC_PATTERNS = [
  'breath',
  'heartbeat',
  'kick_pulse',
  'sub_impact',
  'respiratory',
  'impact',
  'presence',
] as const;
export type HapticPattern = (typeof HAPTIC_PATTERNS)[number];

export const HAPTIC_SYNC_TRIGGERS = ['kick', 'transient', 'voice', 'ambient', 'off'] as const;
export type HapticSyncTrigger = (typeof HAPTIC_SYNC_TRIGGERS)[number];

/**
 * Ejes de la matriz de presets. Cinco ejes cerrados: cualquier preset válido se describe
 * sin ambigüedad y sin campos sueltos.
 */
export interface PresetMatrix {
  readonly environment: AcousticEnvironment;
  readonly content: ContentType;
  readonly emotion: EmotionalProfile;
  readonly spatialComplexity: SpatialComplexity;
  readonly hapticIntensity: HapticIntensity;
}

/** Etapas de la cadena DSP. Descriptivas: nombran el tratamiento, no lo invocan. */
export const DSP_STAGE_KINDS = [
  'gain',
  'highpass',
  'lowpass',
  'presence_eq',
  'compressor',
  'reverb',
  'delay',
  'width',
  'saturation',
  'limiter',
] as const;
export type DspStageKind = (typeof DSP_STAGE_KINDS)[number];

/** Valor de un parámetro de etapa: escalar o lista homogénea de escalares. */
export type ParamValue = number | boolean | string | readonly (number | boolean | string)[];

export interface DspStage {
  readonly kind: DspStageKind;
  readonly order: number;
  readonly parameters: Readonly<Record<string, ParamValue>>;
}

/** Geometría espacial declarada. `null` = el motor no modela ese eje (no "0"). */
export interface SpatialConfig {
  /** Ancho estéreo percibido, 0..2 (1 = sin cambio). */
  readonly width: number;
  /** Profundidad 0..1. */
  readonly depth: number;
  /** Altura 0..1; sin render 3D, es metadata para un downstream. */
  readonly height: number;
  /** Enfoque de la fuente frontal 0..1. */
  readonly focus: number;
  /** RT60 objetivo en segundos. */
  readonly roomSizeSeconds: number;
  /** Absorción 0..1. */
  readonly absorption: number;
  /** Difusión 0..1. */
  readonly diffusion: number;
}

export interface TamvPreset {
  readonly presetId: string;
  readonly displayName: string;
  readonly schemaVersion: string;
  readonly source: 'factory' | 'adaptive';
  readonly classification: ContentType;
  readonly matrix: PresetMatrix;
  readonly processingChain: readonly DspStage[];
  readonly spatialConfig: SpatialConfig;
  readonly haptic: {
    readonly pattern: HapticPattern;
    readonly intensity: HapticIntensity;
    readonly syncTrigger: HapticSyncTrigger;
  };
  /** Uso y calificación: el motor no los mide, los refleja desde el estado local del operador. */
  readonly usageCount: number;
  readonly userRating: number | null;
  readonly note: string;
}

/** Métricas realmente medidas sobre PCM decodificado. `null` = no computable con este audio. */
export interface AudioFeatures {
  readonly frames: number;
  readonly durationMs: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly peakAmplitude: number;
  readonly peakDbfs: number;
  readonly rmsAmplitude: number;
  readonly rmsDbfs: number;
  readonly crestFactorDb: number;
  readonly dynamicRangeDb: number;
  readonly spectralCentroidHz: number;
  readonly spectralCentroidSpreadHz: number;
  readonly spectralFlatness: number;
  readonly zeroCrossingsPerSecond: number;
  readonly lowBandRatio: number;
  readonly midBandRatio: number;
  readonly highBandRatio: number;
  readonly transientCount: number;
  readonly transientDensityPerSecond: number;
  readonly silenceRatio: number;
  readonly voiceBandDominance: number;
  readonly stereoCorrelation: number | null;
  /** Fracción de energía lateral sobre la total (0..1). `null` = material mono. */
  readonly sideEnergyProportion: number | null;
  readonly dcOffset: number;
}

export interface ContentPrediction {
  readonly contentType: ContentType;
  readonly confidence: number;
  readonly scores: Readonly<Record<ContentType, number>>;
  readonly classifierVersion: string;
}

export interface SourceDescriptor {
  readonly sha256: string;
  readonly bytes: number;
  readonly mimeType: string;
  readonly sampleFormat: 'pcm' | 'float';
  readonly bitsPerSample: number;
}

export interface TamvAnalysis {
  readonly analysisId: string;
  readonly createdAt: string;
  readonly engineVersion: string;
  readonly source: SourceDescriptor;
  readonly features: AudioFeatures;
  readonly prediction: ContentPrediction;
  readonly emotion: EmotionalProfile;
  readonly spatialComplexity: SpatialComplexity;
  readonly recommendedPresetId: string;
  readonly analysisLatencyMs: number;
  /** Nunca 0: enumera lo que este motor NO puede saber, para que el lector no infiera de más. */
  readonly limitations: readonly string[];
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
}

export const REDEFINE_ACTIONS = ['analyze', 'separate', 'transform', 'render', 'verify'] as const;
export type RedefineAction = (typeof REDEFINE_ACTIONS)[number];

export const REDEFINE_DOMAINS = [
  'spatial',
  'temporal',
  'harmonic',
  'dynamic',
  'haptic',
  'qc',
] as const;
export type RedefineDomain = (typeof REDEFINE_DOMAINS)[number];

export interface ValidationGate {
  readonly id: string;
  readonly description: string;
  /** Límite en unidades físicas reales (dB, Hz, adimensional). */
  readonly threshold: number;
  readonly unit: string;
  readonly computedFromFeatures: boolean;
  readonly observedValue: number | null;
  readonly state: 'pass' | 'fail' | 'unknown';
}

export interface RedefineStage {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly domain: RedefineDomain;
  readonly action: RedefineAction;
  readonly dependsOn: readonly string[];
  readonly reversible: boolean;
  /** Qué habría que aplicar para deshacer la etapa. Texto normativo, no una acción ejecutada. */
  readonly inverse: string;
  readonly parameters: Readonly<Record<string, ParamValue>>;
  readonly gates: readonly ValidationGate[];
  readonly executionState: 'declared';
  readonly audioRendered: false;
  readonly note: string;
}

export interface TamvRedefinePlan {
  readonly planId: string;
  readonly planVersion: string;
  readonly createdAt: string;
  readonly sourceSha256: string;
  readonly analysisId: string;
  readonly presetId: string;
  readonly stages: readonly RedefineStage[];
  readonly rollback: {
    readonly supported: boolean;
    readonly strategy: 'none' | 'compensating-action' | 'state-restore' | 'manual-approval';
    readonly reason: string;
  };
  readonly stageCount: number;
  readonly reversiblyRecoverableStages: number;
  /** SHA-256 del plan canónico: la evidencia es del plan, no de un resultado de audio. */
  readonly digest: string;
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
}

export const ALERT_LEVELS = ['INFO', 'WARNING', 'CRITICAL', 'ERROR'] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const MONITOR_METRICS = [
  'analysis_latency_ms',
  'decode_integrity',
  'clipping_risk_db',
  'stereo_phase_coherence',
  'spectral_centroid_hz',
  'silence_ratio',
  'cpu_temperature',
  'gpu_utilization',
  'haptic_sync_error',
  'spatial_accuracy',
] as const;
export type MonitorMetric = (typeof MONITOR_METRICS)[number];

export interface MonitorReading {
  readonly metric: MonitorMetric;
  readonly level: AlertLevel;
  readonly measured: boolean;
  readonly value: number | null;
  readonly unit: string;
  readonly threshold: number | null;
  /** Si `measured: false`, por qué no: nunca se inventa un número para parecer monitor. */
  readonly reason: string | null;
  readonly autoCorrectable: boolean;
}

export interface TamvMonitorReport {
  readonly createdAt: string;
  readonly analysisId: string | null;
  readonly readings: readonly MonitorReading[];
  readonly highestLevel: AlertLevel | null;
  readonly measuredCount: number;
  readonly unmeasuredCount: number;
}

export interface TamvRuntimeStatus {
  readonly engineVersion: string;
  readonly analysisBackend: 'native_typed_array_dsp';
  readonly realtimePlayback: false;
  readonly hapticActuators: false;
  readonly gpuAcceleration: false;
  readonly factoryPresetCount: number;
  readonly supportedContainers: readonly string[];
  readonly maxAnalyzedBytes: number;
  readonly governedScopes: readonly string[];
}
