// state: draft | engine-generated — fixtures del banco de pruebas TAMV.
import { encodeWavPcm16 } from '../../src/ivcc/audio';
import { analyzeBytes, isTamvFailure } from '../../src/tamv/engine';
import type { AudioFeatures, TamvAnalysis } from '../../src/tamv/types';

/**
 * Un WAV de 16 bits se construye aquí con la codificadora del propio repo: las pruebas miden
 * bytes reales pasando por `decodeWav`, no un PCM inventado que esquivaría el contenedor.
 */
export const FIX_RATE = 22_050;

export function tone(hz: number, amplitude: number, frames = FIX_RATE): Float32Array {
  const out = new Float32Array(frames);
  const phaseStep = (2 * Math.PI * hz) / FIX_RATE;
  for (let index = 0; index < frames; index += 1) {
    out[index] = amplitude * Math.sin(index * phaseStep);
  }
  return out;
}

/** PRNG congruencial: ruido reproducible, sin `Math.random`. */
export function noise(amplitude: number, frames = FIX_RATE, seed = 20_261): Float32Array {
  const out = new Float32Array(frames);
  let state = seed;
  for (let index = 0; index < frames; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    out[index] = amplitude * (state / 1_073_741_824 - 1);
  }
  return out;
}

export function interleave(left: Float32Array, right: Float32Array): Float32Array {
  const count = Math.min(left.length, right.length);
  const out = new Float32Array(count * 2);
  for (let index = 0; index < count; index += 1) {
    out[index * 2] = left[index] ?? 0;
    out[index * 2 + 1] = right[index] ?? 0;
  }
  return out;
}

export function monoWav(samples: Float32Array): Uint8Array {
  return encodeWavPcm16(samples, FIX_RATE, 1);
}

export function stereoWav(left: Float32Array, right: Float32Array): Uint8Array {
  return encodeWavPcm16(interleave(left, right), FIX_RATE, 2);
}

/** Análisis real; lanza si el fixture no supera las cotas del motor. */
export function analysisOf(bytes: Uint8Array): TamvAnalysis {
  const result = analyzeBytes(bytes, 'audio/wav');
  if (isTamvFailure(result)) throw new Error(`fixture rechazado: ${result.code}`);
  return result;
}

/**
 * `AudioFeatures` sintético para probar reglas sueltas sin depender de qué produce un WAV
 * concreto: aquí lo que se valida es la regla, no la medición.
 */
export function features(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    frames: FIX_RATE,
    durationMs: 1000,
    sampleRate: FIX_RATE,
    channels: 2,
    peakAmplitude: 0.9,
    peakDbfs: -0.92,
    rmsAmplitude: 0.2,
    rmsDbfs: -13.98,
    crestFactorDb: 13.06,
    dynamicRangeDb: 10,
    spectralCentroidHz: 1800,
    spectralCentroidSpreadHz: 300,
    spectralFlatness: 0.2,
    zeroCrossingsPerSecond: 2000,
    lowBandRatio: 0.32,
    midBandRatio: 0.43,
    highBandRatio: 0.25,
    transientCount: 4,
    transientDensityPerSecond: 4,
    silenceRatio: 0.1,
    voiceBandDominance: 0.3,
    stereoCorrelation: 0.6,
    sideEnergyProportion: 0.2,
    dcOffset: 0,
    ...overrides,
  };
}
