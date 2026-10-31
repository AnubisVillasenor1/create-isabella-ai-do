/**
 * state: draft | engine-generated — TAMV Kaos Audio System: presets adaptativos.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * Un preset por archivo, derivado por reglas sobre las mediciones reales. La "adaptación" es
 * aritmética determinista sobre features: mismo audio → mismo preset, verificable en una
 * prueba. No existe un `learning_engine` que entienda intenciones: aquí no se aprende nada y
 * se declara en `limitations`, en vez de fingir un modelo.
 */
import { clamp } from '../ivcc/util';
import { headroomDb } from './analysis';
import { selectClosestFactoryPreset } from './presets';
import {
  type AcousticEnvironment,
  type DspStage,
  type EmotionalProfile,
  type HapticIntensity,
  type HapticPattern,
  type HapticSyncTrigger,
  type PresetMatrix,
  type SpatialComplexity,
  type TamvAnalysis,
  type TamvPreset,
} from './types';
import { TAMV_PRESET_SCHEMA_VERSION } from './types';

export const TAMV_ADAPTIVE_TARGET_RMS_DBFS = -16;
export const TAMV_ADAPTIVE_GAIN_LIMIT_DB = 12;

/** Objetivo de loudness → ganancia de entrada. Se calcula sobre RMS medido, no percibido. */
export function adaptiveGainDb(rmsDbfs: number): number {
  if (!Number.isFinite(rmsDbfs)) return 0;
  return clamp(
    TAMV_ADAPTIVE_TARGET_RMS_DBFS - rmsDbfs,
    -TAMV_ADAPTIVE_GAIN_LIMIT_DB,
    TAMV_ADAPTIVE_GAIN_LIMIT_DB
  );
}

export function hapticIntensityFromTransients(transientDensityPerSecond: number): HapticIntensity {
  if (transientDensityPerSecond < 0.5) return 'none';
  if (transientDensityPerSecond < 2) return 'subtle';
  if (transientDensityPerSecond < 4) return 'moderate';
  if (transientDensityPerSecond < 7) return 'strong';
  return 'immersive';
}

const WIDTH_BY_COMPLEXITY: Readonly<Record<SpatialComplexity, number>> = Object.freeze({
  minimal: 0.75,
  moderate: 1.0,
  rich: 1.3,
  dense: 1.6,
});

export const ENVIRONMENT_BY_EMOTION: Readonly<Record<EmotionalProfile, AcousticEnvironment>> =
  Object.freeze({
    reverent: 'cathedral',
    expansive: 'open_field',
    intimate: 'jazz_club',
    energetic: 'vr_space',
    tense: 'urban_street',
    warm: 'concert_hall',
    neutral: 'broadcast_studio',
  });

function hapticFor(analysis: TamvAnalysis): { pattern: HapticPattern; trigger: HapticSyncTrigger } {
  const { features, prediction } = analysis;
  if (prediction.contentType === 'dialogue') return { pattern: 'presence', trigger: 'voice' };
  if (features.transientDensityPerSecond >= 4) return { pattern: 'kick_pulse', trigger: 'kick' };
  if (features.crestFactorDb >= 18) return { pattern: 'impact', trigger: 'transient' };
  if (features.transientDensityPerSecond <= 0.5) {
    return { pattern: features.rmsDbfs <= -30 ? 'respiratory' : 'breath', trigger: 'ambient' };
  }
  return { pattern: 'heartbeat', trigger: 'transient' };
}

function withParameter(
  chain: readonly DspStage[],
  kind: DspStage['kind'],
  patch: Readonly<Record<string, number | boolean | string>>
): DspStage[] {
  return chain.map((item) =>
    item.kind === kind ? { ...item, parameters: { ...item.parameters, ...patch } } : item
  );
}

/**
 * Matriz objetivo a partir de las mediciones. `content` usa la predicción; si el clasificador
 * respondió `unknown`, la matriz conserva `unknown` y la selección de fábrica lo penaliza de
 * forma explícita en vez de adivinar un género.
 */
export function derivePresetMatrix(
  analysis: Pick<TamvAnalysis, 'features' | 'prediction' | 'emotion' | 'spatialComplexity'>
): PresetMatrix {
  const { features, prediction, emotion, spatialComplexity } = analysis;
  return {
    environment: ENVIRONMENT_BY_EMOTION[emotion],
    content: prediction.contentType,
    emotion,
    spatialComplexity,
    hapticIntensity: hapticIntensityFromTransients(features.transientDensityPerSecond),
  };
}

export function buildAdaptivePreset(analysis: TamvAnalysis): TamvPreset {
  const matrix = derivePresetMatrix(analysis);
  const base = selectClosestFactoryPreset(matrix);
  const width = WIDTH_BY_COMPLEXITY[matrix.spatialComplexity];
  const gainDb = adaptiveGainDb(analysis.features.rmsDbfs);
  const haptic = hapticFor(analysis);
  const intensity = hapticIntensityFromTransients(analysis.features.transientDensityPerSecond);

  let chain = withParameter(base.processingChain, 'gain', { gainDb: Number(gainDb.toFixed(2)) });
  chain = withParameter(chain, 'width', { factor: width });
  chain = withParameter(chain, 'limiter', {
    ceilingDbfs: Math.min(
      -0.3,
      analysis.features.peakDbfs + Math.max(0, headroomDb(analysis.features))
    ),
  });

  const presetId = `adaptive_${analysis.source.sha256.slice(0, 12)}`;
  return Object.freeze({
    presetId,
    displayName: `Adaptive ${analysis.source.sha256.slice(0, 8)}`,
    schemaVersion: TAMV_PRESET_SCHEMA_VERSION,
    source: 'adaptive',
    classification: matrix.content,
    matrix: Object.freeze({ ...matrix }),
    processingChain: Object.freeze(chain),
    spatialConfig: Object.freeze({
      ...base.spatialConfig,
      width,
      depth: clamp(
        base.spatialConfig.depth * (matrix.spatialComplexity === 'minimal' ? 0.6 : 1),
        0,
        1
      ),
      focus: clamp(1 - (width - 1) / 2, 0, 1),
    }),
    haptic: Object.freeze({ pattern: haptic.pattern, intensity, syncTrigger: haptic.trigger }),
    usageCount: 0,
    userRating: null,
    note: `Derivado por reglas sobre ${analysis.analysisId}; base de cadena ${base.presetId}.`,
  });
}
