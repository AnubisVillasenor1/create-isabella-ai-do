// state: draft | engine-generated — pruebas del DSP nativo TAMV.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FFT_SIZE,
  MIN_RELATIVE_FLUX,
  analyzeFrames,
  amplitudeToDbfs,
  bandEnergyRatio,
  binToHz,
  channelAt,
  dcOffset,
  dbfsToAmplitude,
  detectTransients,
  dynamicRangeDb,
  fftRadix2,
  hannWindow,
  isPowerOfTwo,
  magnitudeSpectrum,
  measureStereo,
  mean,
  nextPowerOfTwo,
  percentile,
  peakAmplitude,
  rmsAmplitude,
  silenceRatio,
  spectralCentroidHz,
  spectralFlatness,
  stdDev,
  toMono,
  zeroCrossingsPerSecond,
} from '../../src/tamv/dsp';

const SAMPLE_RATE = 44_100;

function sine(hz: number, amplitude: number, seconds = 1, rate = SAMPLE_RATE): Float32Array {
  const length = Math.floor(rate * seconds);
  const out = new Float32Array(length);
  const phaseStep = (2 * Math.PI * hz) / rate;
  for (let index = 0; index < length; index += 1) out[index] = amplitude * Math.sin(index * phaseStep);
  return out;
}

/** PRNG determinista: el mismo ruido en cada ejecución, sin `Math.random`. */
function noise(amplitude: number, seconds: number, seed = 12345): Float32Array {
  const out = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  let state = seed;
  for (let index = 0; index < out.length; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    out[index] = amplitude * (state / 1_073_741_824 - 1);
  }
  return out;
}

/** DFT directa O(n²): el oracle con el que se valida la implementación radix-2. */
function naiveDft(input: Float64Array): { re: number[]; im: number[] } {
  const n = input.length;
  const re: number[] = [];
  const im: number[] = [];
  for (let k = 0; k < n; k += 1) {
    let sumRe = 0;
    let sumIm = 0;
    for (let t = 0; t < n; t += 1) {
      const angle = (-2 * Math.PI * k * t) / n;
      sumRe += (input[t] ?? 0) * Math.cos(angle);
      sumIm += (input[t] ?? 0) * Math.sin(angle);
    }
    re.push(sumRe);
    im.push(sumIm);
  }
  return { re, im };
}

function onsetsOf(signal: Float32Array, seconds: number): number {
  const frames = analyzeFrames(signal, SAMPLE_RATE);
  return detectTransients(frames.relativeFlux, frames.fftSize, SAMPLE_RATE, frames.hopSize).count;
}

describe('TAMV DSP · primitivas', () => {
  it('normaliza potencias de dos y rechaza longitudes inválidas', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(1000)).toBe(1024);
    expect(nextPowerOfTwo(2048)).toBe(2048);
    expect(isPowerOfTwo(4096)).toBe(true);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(1500)).toBe(false);
  });

  it('la ventana de Hann se anula en los extremos y vale 1 en el centro', () => {
    const window = hannWindow(8);
    expect(window[0]).toBeCloseTo(0, 12);
    expect(window[7]).toBeCloseTo(0, 12);
    const odd = hannWindow(9);
    expect(odd[4]).toBeCloseTo(1, 12);
    expect(hannWindow(1)[0]).toBe(1);
  });

  it('fftRadix2 coincide con la DFT directa', () => {
    const signal = new Float64Array([1, 2, 3, 4, -2, 0.5, -1, 6]);
    const re = Float64Array.from(signal);
    const im = new Float64Array(signal.length);
    fftRadix2(re, im);
    const oracle = naiveDft(signal);
    for (let bin = 0; bin < signal.length; bin += 1) {
      expect(re[bin]).toBeCloseTo(oracle.re[bin]!, 8);
      expect(im[bin]).toBeCloseTo(oracle.im[bin]!, 8);
    }
  });

  it('rechaza longitudes no coherentes o que no son potencia de dos', () => {
    expect(() => fftRadix2(new Float64Array(4), new Float64Array(8))).toThrow(
      'TAMV_FFT_LENGTH_MISMATCH'
    );
    expect(() => fftRadix2(new Float64Array(12), new Float64Array(12))).toThrow(
      /TAMV_FFT_LENGTH_NOT_POWER_OF_TWO/
    );
  });

  it('convierte bin↔Hz con la resolución física real', () => {
    expect(binToHz(1, 2048, 44_100)).toBeCloseTo(21.533, 3);
    expect(binToHz(1024, 2048, 44_100)).toBeCloseTo(22_050, 3);
    expect(dbfsToAmplitude(amplitudeToDbfs(0.5))).toBeCloseTo(0.5, 10);
    expect(amplitudeToDbfs(0)).toBe(-120);
    expect(amplitudeToDbfs(Number.NaN)).toBe(-120);
  });

  it('media, desviación y percentil no colapsan con series vacías', () => {
    expect(mean([])).toBe(0);
    expect(stdDev([5], 5)).toBe(0);
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    expect(percentile([], 0.9)).toBe(0);
  });

  it('separa canales interleaved y suma a mono', () => {
    const interleaved = Float32Array.from([0.25, -0.25, 0.5, -0.75, 0.75, -1]);
    const right = channelAt(interleaved, 2, 1);
    expect(Array.from(right)).toHaveLength(3);
    expect(right[1]).toBeCloseTo(-0.75, 6);
    expect(right[2]).toBeCloseTo(-1, 6);
    const mono = toMono(interleaved, 2);
    expect(mono[0]).toBeCloseTo(0, 6);
    expect(mono[1]).toBeCloseTo(-0.125, 6);
    expect(() => channelAt(interleaved, 2, 2)).toThrow(/TAMV_CHANNEL_OUT_OF_RANGE/);
    expect(toMono(interleaved, 1).length).toBe(6);
  });

  it('mide pico y RMS sobre una senoide conocida', () => {
    const signal = sine(440, 0.2, 1);
    expect(peakAmplitude(signal)).toBeCloseTo(0.2, 4);
    expect(rmsAmplitude(signal)).toBeCloseTo(0.2 / Math.SQRT2, 4);
    expect(dcOffset(signal)).toBeCloseTo(0, 6);
    expect(amplitudeToDbfs(rmsAmplitude(signal))).toBeCloseTo(-17, 1);
    expect(amplitudeToDbfs(peakAmplitude(signal))).toBeCloseTo(-13.98, 1);
  });

  it('los cruces por cero escalan con la frecuencia, no con la amplitud', () => {
    expect(zeroCrossingsPerSecond(sine(440, 0.2, 1), SAMPLE_RATE)).toBeCloseTo(880, -1);
    expect(zeroCrossingsPerSecond(sine(440, 0.05, 1), SAMPLE_RATE)).toBeCloseTo(880, -1);
    expect(zeroCrossingsPerSecond(new Float32Array(3), SAMPLE_RATE)).toBe(0);
  });
});

describe('TAMV DSP · dominio espectral', () => {
  it('el centroide de un tono puro cae sobre su propia frecuencia', () => {
    const size = DEFAULT_FFT_SIZE;
    const spectrum = magnitudeSpectrum(sine(440, 0.2, size / SAMPLE_RATE), hannWindow(size));
    expect(spectralCentroidHz(spectrum, size, SAMPLE_RATE)).toBeCloseTo(440, -1);
  });

  it('la flatness separa tono puro de espectro plano', () => {
    const size = DEFAULT_FFT_SIZE;
    const tone = magnitudeSpectrum(sine(1000, 0.3, size / SAMPLE_RATE), hannWindow(size));
    const flat = new Float64Array(size / 2 + 1).fill(1);
    expect(spectralFlatness(tone)).toBeLessThan(0.05);
    expect(spectralFlatness(flat)).toBeCloseTo(1, 6);
  });

  it('el centroide de dos tonos se ubica entre ambos', () => {
    const size = DEFAULT_FFT_SIZE;
    const seconds = size / SAMPLE_RATE;
    const combined = new Float32Array(size);
    const low = sine(300, 0.3, seconds);
    const high = sine(3000, 0.3, seconds);
    for (let index = 0; index < size; index += 1) combined[index] = (low[index] ?? 0) + (high[index] ?? 0);
    const centroid = spectralCentroidHz(magnitudeSpectrum(combined, hannWindow(size)), size, SAMPLE_RATE);
    expect(centroid).toBeGreaterThan(1200);
    expect(centroid).toBeLessThan(2200);
  });

  it('las bandas reparten la energía y no se solapan', () => {
    const size = DEFAULT_FFT_SIZE;
    const spectrum = magnitudeSpectrum(sine(440, 0.2, size / SAMPLE_RATE), hannWindow(size));
    const low = bandEnergyRatio(spectrum, size, SAMPLE_RATE, 0, 250);
    const mid = bandEnergyRatio(spectrum, size, SAMPLE_RATE, 250, 2000);
    const high = bandEnergyRatio(spectrum, size, SAMPLE_RATE, 2000, Number.POSITIVE_INFINITY);
    expect(mid.ratio).toBeGreaterThan(0.9);
    expect(low.ratio).toBeLessThan(0.02);
    expect(high.ratio).toBeLessThan(0.02);
    expect(low.ratio + mid.ratio + high.ratio).toBeCloseTo(1, 2);
  });

  it('un espectro sin energía devuelve ratios nulos en vez de NaN', () => {
    const size = 256;
    const spectrum = new Float64Array(size / 2 + 1);
    expect(bandEnergyRatio(spectrum, size, SAMPLE_RATE, 0, 1000).ratio).toBe(0);
    expect(spectralCentroidHz(spectrum, size, SAMPLE_RATE)).toBe(0);
    expect(spectralFlatness(spectrum)).toBe(0);
  });
});

describe('TAMV DSP · ventana deslizada y transitorios', () => {
  it('analiza tantos cuadros como dicte el hop', () => {
    const signal = sine(440, 0.2, 0.25);
    const frames = analyzeFrames(signal, SAMPLE_RATE, 1024, 256);
    expect(frames.fftSize).toBe(1024);
    expect(frames.hopSize).toBe(256);
    expect(frames.frameCount).toBe(Math.floor((signal.length - 1024) / 256) + 1);
    expect(frames.centroids.length).toBe(frames.frameCount);
    expect(frames.flux.length).toBe(frames.frameCount - 1);
    expect(frames.relativeFlux.length).toBe(frames.frameCount - 1);
    expect(frames.frameLevelsDbfs[0]).toBeGreaterThan(-30);
  });

  it('el flujo relativo vale 0 en los marcos de silencio total y no se divide por cero', () => {
    // Tono de 0 a 0.5 s y silencio después. Los marcos de la cola tienen energía nula en ambos
    // lados de la resta: sin el guard 0/0 el cociente sería NaN y el detector se ciegaría.
    const signal = new Float32Array(Math.floor(SAMPLE_RATE * 2));
    signal.set(sine(440, 0.4, 0.5), 0);
    const frames = analyzeFrames(signal, SAMPLE_RATE);
    expect(frames.relativeFlux.every((value) => Number.isFinite(value))).toBe(true);
    const silentTail = Array.from(frames.relativeFlux).slice(60);
    expect(silentTail.length).toBeGreaterThan(0);
    expect(silentTail.every((value) => value === 0)).toBe(true);
  });

  it('una señal más corta que la FFT no produce cuadros ni divisiones por cero', () => {
    const frames = analyzeFrames(sine(440, 0.2, 0.005), SAMPLE_RATE, 2048, 512);
    expect(frames.frameCount).toBe(0);
    expect(frames.relativeFlux.length).toBe(0);
    expect(frames.meanMagnitude.every((value) => value === 0)).toBe(true);
  });

  it('un tono estacionario no genera onsets, sin importar su volumen', () => {
    // El caso que el umbral puramente estadístico fallaba: la fuga espectral entre cuadros
    // es periódica y su σ es minúscula, así que cualquier "media + n·σ" se superaba.
    expect(onsetsOf(sine(440, 0.2, 1), 1)).toBe(0);
    expect(onsetsOf(sine(440, 0.9, 1), 1)).toBe(0);
    expect(onsetsOf(sine(1000, 0.3, 1), 1)).toBe(0);
    expect(onsetsOf(sine(50, 0.5, 1), 1)).toBe(0);
  });

  it('el ruido blanco, que cambia de espectro cada cuadro, tampoco dispara el háptico', () => {
    expect(onsetsOf(noise(0.2, 1), 1)).toBe(0);
  });

  it('detecta las ráfagas aisladas de una señal percusiva', () => {
    const length = Math.floor(SAMPLE_RATE * 2);
    const signal = new Float32Array(length);
    const bursts = [0.15, 0.65, 1.35];
    for (const at of bursts) {
      const start = Math.floor(at * SAMPLE_RATE);
      const width = Math.floor(0.04 * SAMPLE_RATE);
      for (let index = 0; index < width; index += 1) {
        const position = start + index;
        if (position < length) signal[position] = Math.sin((2 * Math.PI * 120 * index) / SAMPLE_RATE);
      }
    }
    expect(onsetsOf(signal, 2)).toBe(bursts.length);
  });

  it('cuenta los golpes de un patrón de batería a 120 BPM', () => {
    const seconds = 4;
    const length = Math.floor(SAMPLE_RATE * seconds);
    const signal = new Float32Array(length);
    const period = Math.floor((60 / 120) * SAMPLE_RATE);
    const width = Math.floor(0.08 * SAMPLE_RATE);
    for (let start = 0; start + width < length; start += period) {
      for (let index = 0; index < width; index += 1) {
        const envelope = Math.exp(-index / (0.02 * SAMPLE_RATE));
        signal[start + index] = 0.8 * envelope * Math.sin((2 * Math.PI * 60 * index) / SAMPLE_RATE);
      }
    }
    // El primer cuadro no tiene predecesor: se detectan los golpes restantes.
    const detected = onsetsOf(signal, seconds);
    expect(detected).toBeGreaterThanOrEqual(Math.floor(seconds * 2) - 2);
    expect(detected).toBeLessThanOrEqual(Math.floor(seconds * 2));
  });

  it('un solo golpe sobre un tono continuo se detecta como un onset', () => {
    const signal = sine(440, 0.2, 2);
    const start = Math.floor(1.0 * SAMPLE_RATE);
    const width = Math.floor(0.03 * SAMPLE_RATE);
    for (let index = 0; index < width; index += 1) {
      signal[start + index] = (signal[start + index] ?? 0) + 0.9 * Math.sin((2 * Math.PI * 2000 * index) / SAMPLE_RATE);
    }
    expect(onsetsOf(signal, 2)).toBe(1);
  });

  it('respeta el refractario: dos cuadros contiguos cuentan como un onset', () => {
    const relative = new Float64Array(40).fill(0.01);
    relative[10] = 0.8;
    relative[11] = 0.7;
    expect(detectTransients(relative, 2048, SAMPLE_RATE, 512, 40).count).toBe(1);
  });

  it('el suelo absoluto de flujo relativo existe y frena al ruido numérico', () => {
    expect(MIN_RELATIVE_FLUX).toBeGreaterThan(0);
    expect(MIN_RELATIVE_FLUX).toBeLessThan(1);
    const frames = analyzeFrames(new Float32Array(4096), SAMPLE_RATE);
    expect(frames.flux.every((value) => value === 0)).toBe(true);
    expect(frames.relativeFlux.every((value) => value === 0)).toBe(true);
    expect(detectTransients(frames.relativeFlux, frames.fftSize, SAMPLE_RATE, frames.hopSize).count).toBe(0);
  });

  it('silencio y rango dinámico se leen sobre la envolvente por cuadro', () => {
    const length = Math.floor(SAMPLE_RATE * 2);
    const signal = new Float32Array(length);
    signal.set(sine(440, 0.3, 1), 0);
    const frames = analyzeFrames(signal, SAMPLE_RATE);
    expect(silenceRatio(frames.frameLevelsDbfs)).toBeGreaterThan(0.3);
    expect(dynamicRangeDb(frames.frameLevelsDbfs)).toBeGreaterThan(12);
    expect(dynamicRangeDb(new Float64Array([-16]))).toBe(0);
  });
});

describe('TAMV DSP · estéreo', () => {
  function interleave(left: Float32Array, right: Float32Array): Float32Array {
    const count = Math.min(left.length, right.length);
    const out = new Float32Array(count * 2);
    for (let index = 0; index < count; index += 1) {
      out[index * 2] = left[index] ?? 0;
      out[index * 2 + 1] = right[index] ?? 0;
    }
    return out;
  }

  function scaled(left: Float32Array, scale: number): Float32Array {
    return Float32Array.from(left, (value) => value * scale);
  }

  it('mono no tiene geometría: measureStereo devuelve null, no un 1.0 inventado', () => {
    expect(measureStereo(sine(440, 0.2, 1), 1)).toBeNull();
  });

  it('correlación L/R: idénticos = 1, invertidos = -1', () => {
    const left = sine(440, 0.2, 0.5);
    expect(measureStereo(interleave(left, left), 2)?.correlation).toBeCloseTo(1, 3);
    expect(measureStereo(interleave(left, scaled(left, -1)), 2)?.correlation).toBeCloseTo(-1, 3);
  });

  it('la fracción lateral es 0 en fase y 1 en contrafase, sin infinito ni ceros falsos', () => {
    const left = sine(440, 0.2, 0.5);
    expect(measureStereo(interleave(left, left), 2)?.sideEnergyProportion).toBeCloseTo(0, 3);
    expect(measureStereo(interleave(left, scaled(left, -1)), 2)?.sideEnergyProportion).toBeCloseTo(1, 3);
  });

  it('dos canales independientes caen cerca de 0.5: la métrica es proporción, no cociente', () => {
    const stereo = measureStereo(interleave(noise(0.2, 0.5, 777), noise(0.2, 0.5, 4242)), 2);
    expect(stereo?.sideEnergyProportion).toBeGreaterThan(0.35);
    expect(stereo?.sideEnergyProportion).toBeLessThan(0.65);
    expect(stereo?.correlation).toBeCloseTo(0, 1);
  });

  it('un canal 10 dB más bajo desbalancea el nivel sin anular la correlación', () => {
    const left = sine(440, 0.3, 0.5);
    const stereo = measureStereo(interleave(left, scaled(left, 0.316)), 2);
    expect(stereo?.levelImbalanceDb).toBeCloseTo(10, 0);
    expect(stereo?.correlation).toBeCloseTo(1, 3);
  });
});
