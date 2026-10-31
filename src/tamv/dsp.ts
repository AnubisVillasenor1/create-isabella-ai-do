/**
 * state: draft | engine-generated — TAMV Kaos Audio System: primitivas DSP medidas.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * Este archivo aporta lo que el repositorio no tenía: FFT compleja radix-2, ventana de Hann,
 * centroide espectral, energías por banda, flatness, densidad transitoria por flujo espectral,
 * rango dinámico por percentiles de envolvente y análisis M/S de estéreo. Antes de aquí, el
 * único `spectralCentroidHz` del sistema era una constante escrita a mano (548 Hz) en
 * `src/inference/voice-profile.ts` y jamás se calculaba.
 *
 * Todo es determinista: misma entrada → misma salida, sin `Math.random`, sin estado global y
 * sin red. No renderiza audio; mide.
 */

/** Tamaño de FFT por defecto: 2048 puntos ≈ 42 Hz de resolución a 48 kHz. */
export const DEFAULT_FFT_SIZE = 2048;
export const DEFAULT_HOP_SIZE = 512;

/** Suelo de nivel en dBFS para logaritmos seguros. */
export const DBFS_FLOOR = -120;

/**
 * Suelo de flujo espectral relativo para considerar un onset. Está en fracción de la energía
 * combinada de dos cuadros: 0.08 = el cuadro nuevo aportó al menos el 8 % del total. Un tono
 * estacionario ondula entre 1e-5 y 8e-3; una entrada real desde silencio llega a 1.0.
 */
export const MIN_RELATIVE_FLUX = 0.08;

/** Cuántas desviaciones estándar sobre la media de flujo se exigen para un pico transitorio. */
export const FLUX_SIGMA_MULTIPLIER = 2.5;

const EPSILON = 1e-12;

export function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) power <<= 1;
  return power;
}

export function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

/** Ventana de Hann simétrica de longitud `length`. */
export function hannWindow(length: number): Float64Array {
  const window = new Float64Array(Math.max(1, Math.floor(length)));
  if (window.length === 1) {
    window[0] = 1;
    return window;
  }
  for (let index = 0; index < window.length; index += 1) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (window.length - 1)));
  }
  return window;
}

/**
 * FFT compleja in-place de Cooley-Tukey (decimación en el tiempo). `re` e `im` deben tener la
 * misma longitud y ser potencia de 2.
 */
export function fftRadix2(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length) throw new Error('TAMV_FFT_LENGTH_MISMATCH');
  if (!isPowerOfTwo(n)) throw new Error(`TAMV_FFT_LENGTH_NOT_POWER_OF_TWO: ${n}`);

  // Permutación bit-reversa.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let curRe = 1;
      let curIm = 0;
      for (let offset = 0; offset < len / 2; offset += 1) {
        const evenRe = re[start + offset]!;
        const evenIm = im[start + offset]!;
        const oddRe = re[start + offset + len / 2]!;
        const oddIm = im[start + offset + len / 2]!;
        const tRe = oddRe * curRe - oddIm * curIm;
        const tIm = oddRe * curIm + oddIm * curRe;
        re[start + offset] = evenRe + tRe;
        im[start + offset] = evenIm + tIm;
        re[start + offset + len / 2] = evenRe - tRe;
        im[start + offset + len / 2] = evenIm - tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Espectro de magnitud (bins 0..n/2) de una señal cuya longitud ya es potencia de 2. */
export function magnitudeSpectrum(
  frame: ArrayLike<number>,
  window: ArrayLike<number>
): Float64Array {
  const size = frame.length;
  if (!isPowerOfTwo(size)) throw new Error(`TAMV_FFT_LENGTH_NOT_POWER_OF_TWO: ${size}`);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const gain = window.length === size ? 1 : window.length / size;
  for (let index = 0; index < size; index += 1) {
    re[index] = (frame[index] ?? 0) * (window[index] ?? 1) * gain;
    im[index] = 0;
  }
  fftRadix2(re, im);
  const bins = size / 2 + 1;
  const spectrum = new Float64Array(bins);
  for (let bin = 0; bin < bins; bin += 1) {
    spectrum[bin] = Math.hypot(re[bin] ?? 0, im[bin] ?? 0);
  }
  return spectrum;
}

export function binToHz(bin: number, fftSize: number, sampleRate: number): number {
  return (bin * sampleRate) / fftSize;
}

export function hzToBin(hz: number, fftSize: number, sampleRate: number): number {
  return (hz * fftSize) / sampleRate;
}

/** Media aritmética tolerante a vacío. */
export function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) total += values[index] ?? 0;
  return total / values.length;
}

export function stdDev(values: ArrayLike<number>, center: number): number {
  if (values.length < 2) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    const delta = (values[index] ?? 0) - center;
    total += delta * delta;
  }
  return Math.sqrt(total / values.length);
}

/** Percentil por interpolación lineal sobre una copia ordenada. `p` en 0..1. */
export function percentile(values: ArrayLike<number>, p: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values, (value) => value ?? 0).sort((a, b) => a - b);
  const rank = Math.min(1, Math.max(0, p)) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low] ?? 0;
  const weight = rank - low;
  return (sorted[low] ?? 0) * (1 - weight) + (sorted[high] ?? 0) * weight;
}

/** Suma de canales interleaved a mono. `channels === 1` devuelve la misma vista copiada. */
export function toMono(interleaved: Float32Array, channels: number): Float32Array {
  const ch = Math.max(1, Math.floor(channels));
  if (ch === 1) return Float32Array.from(interleaved);
  const frames = Math.floor(interleaved.length / ch);
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let total = 0;
    for (let channel = 0; channel < ch; channel += 1)
      total += interleaved[frame * ch + channel] ?? 0;
    mono[frame] = total / ch;
  }
  return mono;
}

export function channelAt(
  interleaved: Float32Array,
  channels: number,
  channel: number
): Float32Array {
  const ch = Math.max(1, Math.floor(channels));
  if (channel < 0 || channel >= ch) throw new Error(`TAMV_CHANNEL_OUT_OF_RANGE: ${channel}`);
  const frames = Math.floor(interleaved.length / ch);
  const out = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1)
    out[frame] = interleaved[frame * ch + channel] ?? 0;
  return out;
}

export function peakAmplitude(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.abs(samples[index] ?? 0);
    if (value > peak) peak = value;
  }
  return peak;
}

export function rmsAmplitude(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let total = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0;
    total += value * value;
  }
  return Math.sqrt(total / samples.length);
}

export function amplitudeToDbfs(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return DBFS_FLOOR;
  return Math.max(DBFS_FLOOR, 20 * Math.log10(amplitude));
}

export function dbfsToAmplitude(dbfs: number): number {
  return Math.pow(10, dbfs / 20);
}

export function dcOffset(samples: ArrayLike<number>): number {
  return mean(samples);
}

/** Cruces por cero normalizados a segundos de señal. */
export function zeroCrossingsPerSecond(samples: Float32Array, sampleRate: number): number {
  if (samples.length < 2 || sampleRate <= 0) return 0;
  let crossings = 0;
  let previous = samples[0] ?? 0;
  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index] ?? 0;
    if ((previous < 0 && current >= 0) || (previous >= 0 && current < 0)) crossings += 1;
    previous = current;
  }
  const seconds = samples.length / sampleRate;
  return seconds > 0 ? crossings / seconds : 0;
}

/** Centroide espectral de un espectro de magnitud, excluyendo DC. */
export function spectralCentroidHz(
  spectrum: Float64Array,
  fftSize: number,
  sampleRate: number
): number {
  let weighted = 0;
  let total = 0;
  for (let bin = 1; bin < spectrum.length; bin += 1) {
    const magnitude = spectrum[bin] ?? 0;
    weighted += bin * magnitude;
    total += magnitude;
  }
  if (total <= EPSILON) return 0;
  return binToHz(weighted / total, fftSize, sampleRate);
}

/**
 * Flatness = media geométrica / media aritmética del espectro (sin DC).
 * ~1 → ruido; ~0 → tono puro. Es la señal que separa "ambiente" de "música".
 */
export function spectralFlatness(spectrum: Float64Array): number {
  let logSum = 0;
  let linearSum = 0;
  let count = 0;
  for (let bin = 1; bin < spectrum.length; bin += 1) {
    const magnitude = spectrum[bin] ?? 0;
    if (magnitude <= EPSILON) continue;
    logSum += Math.log(magnitude);
    linearSum += magnitude;
    count += 1;
  }
  if (count === 0 || linearSum <= EPSILON) return 0;
  const geometric = Math.exp(logSum / count);
  return Math.min(1, geometric / (linearSum / count));
}

export function bandEnergyRatio(
  spectrum: Float64Array,
  fftSize: number,
  sampleRate: number,
  fromHz: number,
  toHz: number
): { readonly energy: number; readonly ratio: number } {
  let total = 0;
  let band = 0;
  for (let bin = 1; bin < spectrum.length; bin += 1) {
    const magnitude = spectrum[bin] ?? 0;
    const power = magnitude * magnitude;
    total += power;
    const hz = binToHz(bin, fftSize, sampleRate);
    if (hz >= fromHz && hz < toHz) band += power;
  }
  return { energy: band, ratio: total > EPSILON ? band / total : 0 };
}

export interface FrameSpectra {
  readonly fftSize: number;
  readonly hopSize: number;
  readonly frameCount: number;
  readonly meanMagnitude: Float64Array;
  readonly centroids: Float64Array;
  readonly flux: Float64Array;
  /** `flux[i]` normalizado por la energía de los cuadros `i` e `i+1`: adimensional y comparable. */
  readonly relativeFlux: Float64Array;
  readonly frameLevelsDbfs: Float64Array;
}

/**
 * Ventana deslizada con solape: acumula el espectro medio, el centroide por cuadro, el flujo
 * espectral (base de la detección transitoria) y el nivel RMS por cuadro en dBFS.
 */
export function analyzeFrames(
  samples: Float32Array,
  sampleRate: number,
  fftSize = DEFAULT_FFT_SIZE,
  hopSize = DEFAULT_HOP_SIZE
): FrameSpectra {
  const size = isPowerOfTwo(fftSize) ? fftSize : nextPowerOfTwo(fftSize);
  const hop = Math.max(1, Math.min(Math.floor(hopSize), size));
  const window = hannWindow(size);
  const bins = size / 2 + 1;
  const meanMagnitude = new Float64Array(bins);

  if (samples.length < size) {
    return {
      fftSize: size,
      hopSize: hop,
      frameCount: 0,
      meanMagnitude,
      centroids: new Float64Array(0),
      flux: new Float64Array(0),
      relativeFlux: new Float64Array(0),
      frameLevelsDbfs: new Float64Array(0),
    };
  }

  const frameCount = Math.floor((samples.length - size) / hop) + 1;
  const centroids = new Float64Array(frameCount);
  const flux = new Float64Array(Math.max(0, frameCount - 1));
  const frameLevelsDbfs = new Float64Array(frameCount);
  const frameSums = new Float64Array(frameCount);
  const frame = new Float64Array(size);
  const previous = new Float64Array(bins);
  const current = new Float64Array(bins);

  for (let index = 0; index < frameCount; index += 1) {
    const start = index * hop;
    for (let i = 0; i < size; i += 1) frame[i] = samples[start + i] ?? 0;
    const spectrum = magnitudeSpectrum(frame, window);
    current.set(spectrum);
    let frameSum = 0;
    for (let bin = 0; bin < bins; bin += 1) {
      const magnitude = current[bin] ?? 0;
      frameSum += magnitude;
      meanMagnitude[bin] = (meanMagnitude[bin] ?? 0) + magnitude;
      if (index > 0) {
        const delta = magnitude - (previous[bin] ?? 0);
        if (delta > 0) flux[index - 1] = (flux[index - 1] ?? 0) + delta;
      }
    }
    frameSums[index] = frameSum;
    centroids[index] = spectralCentroidHz(spectrum, size, sampleRate);
    let sum = 0;
    for (let i = 0; i < size; i += 1) {
      const value = frame[i] ?? 0;
      sum += value * value;
    }
    frameLevelsDbfs[index] = amplitudeToDbfs(Math.sqrt(sum / size));
    previous.set(current);
  }

  for (let bin = 0; bin < bins; bin += 1)
    meanMagnitude[bin] = (meanMagnitude[bin] ?? 0) / frameCount;

  // El flujo crudo depende de la Loudness del material. Normalizado entre dos cuadros vale
  // 0..1 y vuelve comparable un piano silencioso con una patada comprimida.
  const relativeFlux = new Float64Array(flux.length);
  for (let index = 0; index < flux.length; index += 1) {
    const denominator = (frameSums[index] ?? 0) + (frameSums[index + 1] ?? 0);
    relativeFlux[index] = denominator > EPSILON ? (flux[index] ?? 0) / denominator : 0;
  }

  return {
    fftSize: size,
    hopSize: hop,
    frameCount,
    meanMagnitude,
    centroids,
    flux,
    relativeFlux,
    frameLevelsDbfs,
  };
}

/**
 * Densidad transitoria por flujo espectral normalizado: picos locales por encima de
 * `media + 2.5·σ` y del suelo absoluto `MIN_RELATIVE_FLUX`, con refractario mínimo. Es el proxy
 * honesto de "golpes por segundo" que pide el patrón háptico.
 *
 * El suelo absoluto existe por una razón medible: un tono puro estacionario ondula entre 1e-5 y
 * 8e-3 de flujo relativo y, con `σ` tan pequeña, cualquier umbral puramente estadístico lo lee
 * como ráfaga de onsets. Sin normalizar entre cuadros el problema era peor: dependía del volumen.
 */
export function detectTransients(
  relativeFlux: Float64Array,
  fftSize: number,
  sampleRate: number,
  hopSize: number,
  minGapMs = 40
): { readonly count: number; readonly onsets: readonly number[] } {
  if (relativeFlux.length === 0) return { count: 0, onsets: [] };
  const center = mean(relativeFlux);
  const spread = stdDev(relativeFlux, center);
  const threshold = Math.max(center + FLUX_SIGMA_MULTIPLIER * spread, MIN_RELATIVE_FLUX);
  const onsets: number[] = [];
  const minGapSamples = Math.max(1, Math.round((minGapMs / 1000) * sampleRate));
  for (let index = 1; index < relativeFlux.length - 1; index += 1) {
    const value = relativeFlux[index] ?? 0;
    if (value <= threshold) continue;
    if (value < (relativeFlux[index - 1] ?? 0) || value <= (relativeFlux[index + 1] ?? 0)) continue;
    const samplePosition = (index + 1) * hopSize + fftSize / 2;
    if (onsets.length > 0 && samplePosition - onsets[onsets.length - 1]! < minGapSamples) continue;
    onsets.push(samplePosition);
  }
  return { count: onsets.length, onsets };
}

/** Proporción de cuadros por debajo de `windowDb` del cuadro más fuerte. */
export function silenceRatio(frameLevelsDbfs: Float64Array, windowDb = 30): number {
  if (frameLevelsDbfs.length === 0) return 0;
  let loudest = DBFS_FLOOR;
  for (let index = 0; index < frameLevelsDbfs.length; index += 1) {
    loudest = Math.max(loudest, frameLevelsDbfs[index] ?? DBFS_FLOOR);
  }
  const cutoff = loudest - windowDb;
  let quiet = 0;
  for (let index = 0; index < frameLevelsDbfs.length; index += 1) {
    if ((frameLevelsDbfs[index] ?? DBFS_FLOOR) <= cutoff) quiet += 1;
  }
  return quiet / frameLevelsDbfs.length;
}

/** Rango dinámico como separación entre los percentiles 95 y 10 de la envolvente. */
export function dynamicRangeDb(frameLevelsDbfs: Float64Array): number {
  if (frameLevelsDbfs.length < 2) return 0;
  const high = percentile(frameLevelsDbfs, 0.95);
  const low = percentile(frameLevelsDbfs, 0.1);
  return Math.max(0, high - low);
}

export interface StereoMeasurement {
  readonly correlation: number;
  /**
   * Fracción de energía lateral sobre la total (0 = mono real, 1 = sólo lado). Es una
   * proporción y no un cociente M/S a propósito: con dos canales en contrafase la energía mid
   * es cero, y un cociente se iría a infinito o —mal protegido— a 0, que es exactamente leer
   * "sin geometría" el material con más geometría posible.
   */
  readonly sideEnergyProportion: number;
  readonly levelImbalanceDb: number;
}

/**
 * Medición M/S sobre dos canales reales. Con un solo canal no hay geometría que medir: el
 * motor devuelve `null` en vez de inventar 1.0 o 0.0.
 */
export function measureStereo(
  interleaved: Float32Array,
  channels: number
): StereoMeasurement | null {
  if (channels < 2) return null;
  const left = channelAt(interleaved, channels, 0);
  const right = channelAt(interleaved, channels, 1);
  const count = Math.min(left.length, right.length);
  if (count === 0) return null;
  let sumL = 0;
  let sumR = 0;
  for (let index = 0; index < count; index += 1) {
    sumL += left[index] ?? 0;
    sumR += right[index] ?? 0;
  }
  const meanL = sumL / count;
  const meanR = sumR / count;
  let cov = 0;
  let varL = 0;
  let varR = 0;
  let midEnergy = 0;
  let sideEnergy = 0;
  for (let index = 0; index < count; index += 1) {
    const l = (left[index] ?? 0) - meanL;
    const r = (right[index] ?? 0) - meanR;
    cov += l * r;
    varL += l * l;
    varR += r * r;
    const mid = (l + r) / 2;
    const side = (l - r) / 2;
    midEnergy += mid * mid;
    sideEnergy += side * side;
  }
  const denominator = Math.sqrt(varL) * Math.sqrt(varR);
  const totalSide = midEnergy + sideEnergy;
  return {
    correlation: denominator > EPSILON ? cov / denominator : 0,
    sideEnergyProportion: totalSide > EPSILON ? sideEnergy / totalSide : 0,
    levelImbalanceDb:
      amplitudeToDbfs(Math.sqrt(varL / count)) - amplitudeToDbfs(Math.sqrt(varR / count)),
  };
}
