/**
 * state: draft | engine-generated — TAMV Kaos Audio System: medición y clasificación.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * Convierte PCM decodificado en `AudioFeatures` y deriva perfil de contenido, emoción y
 * complejidad espacial. Las reglas son ponderaciones explícitas y documentadas, no un modelo:
 * un puntaje se puede leer, auditar y refutar. `confidence` es la proporción del ganador sobre
 * la suma de los cuatro puntajes; no es una probabilidad calibrada y nunca se presenta como tal.
 */
import { clamp, clamp01, round } from '../ivcc/util';
import {
  DEFAULT_FFT_SIZE,
  DBFS_FLOOR,
  analyzeFrames,
  amplitudeToDbfs,
  bandEnergyRatio,
  dcOffset,
  detectTransients,
  dynamicRangeDb,
  measureStereo,
  peakAmplitude,
  rmsAmplitude,
  silenceRatio,
  spectralCentroidHz,
  spectralFlatness,
  stdDev,
  toMono,
  zeroCrossingsPerSecond,
} from './dsp';
import {
  CONTENT_TYPES,
  TAMV_CLASSIFIER_VERSION,
  type AudioFeatures,
  type ContentPrediction,
  type ContentType,
  type EmotionalProfile,
  type SpatialComplexity,
} from './types';

export const BAND_BOUNDS = Object.freeze({
  lowHz: 250,
  midHighHz: 2000,
  voiceLowHz: 300,
  voiceHighHz: 3400,
} as const);

/** Umbrales del clasificador, expuestos para que las pruebas y la documentación los citen. */
export const CLASSIFIER_THRESHOLDS = Object.freeze({
  minConfidence: 0.34,
  minDurationMs: 250,
  onsetSaturationPerSecond: 8,
  voiceBandSaturation: 0.55,
} as const);

export interface FeatureInput {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly channels: number;
  readonly fftSize?: number;
  readonly hopSize?: number;
}

export function computeAudioFeatures(input: FeatureInput): AudioFeatures {
  const fftSize = input.fftSize ?? DEFAULT_FFT_SIZE;
  const mono = toMono(input.samples, input.channels);
  const frames = analyzeFrames(mono, input.sampleRate, fftSize, input.hopSize);

  const peak = peakAmplitude(mono);
  const rms = rmsAmplitude(mono);
  const peakDbfs = amplitudeToDbfs(peak);
  const rmsDbfs = amplitudeToDbfs(rms);

  const meanCentroid = spectralCentroidHz(frames.meanMagnitude, frames.fftSize, input.sampleRate);
  const centroidSpread = stdDev(frames.centroids, meanCentroid);
  const flatness = spectralFlatness(frames.meanMagnitude);

  const low = bandEnergyRatio(
    frames.meanMagnitude,
    frames.fftSize,
    input.sampleRate,
    0,
    BAND_BOUNDS.lowHz
  );
  const mid = bandEnergyRatio(
    frames.meanMagnitude,
    frames.fftSize,
    input.sampleRate,
    BAND_BOUNDS.lowHz,
    BAND_BOUNDS.midHighHz
  );
  const high = bandEnergyRatio(
    frames.meanMagnitude,
    frames.fftSize,
    input.sampleRate,
    BAND_BOUNDS.midHighHz,
    Number.POSITIVE_INFINITY
  );
  const voiceBand = bandEnergyRatio(
    frames.meanMagnitude,
    frames.fftSize,
    input.sampleRate,
    BAND_BOUNDS.voiceLowHz,
    BAND_BOUNDS.voiceHighHz
  );

  const durationMs = input.sampleRate > 0 ? (mono.length / input.sampleRate) * 1000 : 0;
  const transients = detectTransients(
    frames.relativeFlux,
    frames.fftSize,
    input.sampleRate,
    frames.hopSize
  );
  const stereo = measureStereo(input.samples, input.channels);

  return {
    frames: mono.length,
    durationMs: round(durationMs, 1),
    sampleRate: input.sampleRate,
    channels: input.channels,
    peakAmplitude: round(peak, 5),
    peakDbfs: round(peakDbfs, 2),
    rmsAmplitude: round(rms, 5),
    rmsDbfs: round(rmsDbfs, 2),
    crestFactorDb: round(peakDbfs === DBFS_FLOOR ? 0 : peakDbfs - rmsDbfs, 2),
    dynamicRangeDb: round(dynamicRangeDb(frames.frameLevelsDbfs), 2),
    spectralCentroidHz: round(meanCentroid, 2),
    spectralCentroidSpreadHz: round(centroidSpread, 2),
    spectralFlatness: round(flatness, 5),
    zeroCrossingsPerSecond: round(zeroCrossingsPerSecond(mono, input.sampleRate), 2),
    lowBandRatio: round(low.ratio, 5),
    midBandRatio: round(mid.ratio, 5),
    highBandRatio: round(high.ratio, 5),
    transientCount: transients.count,
    transientDensityPerSecond:
      durationMs > 0 ? round(transients.count / (durationMs / 1000), 3) : 0,
    silenceRatio: round(silenceRatio(frames.frameLevelsDbfs), 5),
    voiceBandDominance: round(voiceBand.ratio, 5),
    stereoCorrelation: stereo === null ? null : round(stereo.correlation, 5),
    sideEnergyProportion: stereo === null ? null : round(stereo.sideEnergyProportion, 5),
    dcOffset: round(dcOffset(mono), 6),
  };
}

function normalizedScores(features: AudioFeatures): Record<ContentType, number> {
  const tonality = clamp01(1 - features.spectralFlatness);
  const onsetActivity = clamp01(
    features.transientDensityPerSecond / CLASSIFIER_THRESHOLDS.onsetSaturationPerSecond
  );
  const spectralBalance = clamp01(
    1 - Math.abs(features.lowBandRatio - 0.3) - Math.abs(features.highBandRatio - 0.25)
  );
  const continuity = clamp01(1 - features.silenceRatio);
  const voiceBand = clamp01(
    features.voiceBandDominance / CLASSIFIER_THRESHOLDS.voiceBandSaturation
  );
  const pauseStructure = clamp01(1 - Math.abs(features.silenceRatio - 0.3) * 3);
  const flatnessNorm = clamp01(features.spectralFlatness * 1.6);
  const lowCentroid = clamp01(1 - features.spectralCentroidHz / 6000);
  const crest = clamp01((features.crestFactorDb - 6) / 24);
  const shortDuration = clamp01(1 - features.durationMs / 4000);

  const music = 0.32 * tonality + 0.28 * onsetActivity + 0.22 * spectralBalance + 0.18 * continuity;
  const dialogue =
    0.34 * voiceBand + 0.22 * (1 - onsetActivity) + 0.24 * pauseStructure + 0.2 * tonality;
  const ambient =
    0.34 * flatnessNorm + 0.26 * (1 - onsetActivity) + 0.22 * lowCentroid + 0.18 * continuity;
  const sfx = 0.32 * onsetActivity + 0.26 * crest + 0.22 * shortDuration + 0.2 * (1 - tonality);

  const top = Math.max(music, dialogue, ambient, sfx);
  return {
    music,
    dialogue,
    ambient,
    sfx,
    // `unknown` no compite: mide cuán informe es el material. Sube si ningún perfil domina.
    unknown: clamp01(0.5 - top),
  };
}

export function classifyContent(features: AudioFeatures): ContentPrediction {
  const scores = normalizedScores(features);
  const total = CONTENT_TYPES.reduce((sum, key) => sum + Math.max(0, scores[key]), 0);
  let winner: ContentType = 'unknown';
  let winnerValue = -1;
  for (const key of CONTENT_TYPES) {
    const value = scores[key];
    if (key !== 'unknown' && value > winnerValue) {
      winner = key;
      winnerValue = value;
    }
  }
  const tooShort = features.durationMs < CLASSIFIER_THRESHOLDS.minDurationMs;
  const confidence = total > 0 ? clamp01(winnerValue / total) : 0;
  const accepted = !tooShort && confidence >= CLASSIFIER_THRESHOLDS.minConfidence;
  return {
    contentType: accepted ? winner : 'unknown',
    confidence: round(confidence, 4),
    scores: Object.fromEntries(
      CONTENT_TYPES.map((key) => [key, round(Math.max(0, scores[key]), 5)])
    ) as Readonly<Record<ContentType, number>>,
    classifierVersion: TAMV_CLASSIFIER_VERSION,
  };
}

/**
 * Perfil emocional por reglas sobre las mismas mediciones. Es una etiqueta de intención de
 * mezcla, no una lectura del oyente.
 */
export function deriveEmotionalProfile(features: AudioFeatures): EmotionalProfile {
  const energetic =
    features.transientDensityPerSecond >= 3 &&
    features.highBandRatio >= 0.18 &&
    features.rmsDbfs >= -20;
  const tense = features.crestFactorDb >= 18 && features.spectralCentroidHz >= 2600;
  const warm = features.lowBandRatio >= 0.35 && features.spectralCentroidHz <= 1200;
  const intimate = features.rmsDbfs <= -26 && features.dynamicRangeDb <= 12;
  const reverent =
    features.spectralFlatness >= 0.08 &&
    features.spectralFlatness <= 0.45 &&
    features.spectralCentroidHz <= 900 &&
    features.transientDensityPerSecond <= 1.5;
  const expansive =
    (features.stereoCorrelation === null ? false : features.stereoCorrelation <= 0.35) &&
    features.spectralCentroidHz >= 800;

  if (energetic) return 'energetic';
  if (tense) return 'tense';
  if (expansive) return 'expansive';
  if (intimate) return 'intimate';
  if (warm) return 'warm';
  if (reverent) return 'reverent';
  return 'neutral';
}

/** Complejidad espacial: mezcla de difusión espectral, actividad transitoria y ancho estéreo. */
export function deriveSpatialComplexity(features: AudioFeatures): SpatialComplexity {
  const sideEnergy = features.sideEnergyProportion ?? 0;
  const score =
    clamp01(features.spectralFlatness * 1.4) * 0.35 +
    clamp01(features.transientDensityPerSecond / 8) * 0.3 +
    clamp01(sideEnergy / 0.4) * 0.35;
  if (score < 0.2) return 'minimal';
  if (score < 0.45) return 'moderate';
  if (score < 0.7) return 'rich';
  return 'dense';
}

/** Riesgo de clipping en dB de margen por debajo del techo (0 = ya en techo o pasado). */
export function headroomDb(features: AudioFeatures, ceilingDbfs = -0.3): number {
  return clamp(ceilingDbfs - features.peakDbfs, -24, 24);
}
