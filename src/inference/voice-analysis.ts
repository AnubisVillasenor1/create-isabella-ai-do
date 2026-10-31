/**
 * state: draft
 * Dependency-free speech measurement used to compare any audio against ISABELLA_VOICE_PROFILE.
 * Measures: F0 (autocorrelation), pause statistics (RMS gate), speech fraction. Not a speaker-identity model.
 */
import type { VoiceProfile } from './voice-profile';

export interface PcmAudio {
  readonly sampleRate: number;
  readonly samples: Float32Array;
}

/** Parse mono/stereo 16-bit PCM WAV (stereo is averaged). Throws on anything else. */
export function parseWav16(buf: Uint8Array): PcmAudio {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) =>
    String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (buf.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE')
    throw new Error('VOICE: not a RIFF/WAVE file');
  let off = 12,
    channels = 0,
    rate = 0,
    bits = 0,
    dataOff = -1,
    dataLen = 0;
  while (off + 8 <= buf.byteLength) {
    const id = tag(off),
      len = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      if (dv.getUint16(off + 8, true) !== 1) throw new Error('VOICE: only PCM WAV supported');
      channels = dv.getUint16(off + 10, true);
      rate = dv.getUint32(off + 12, true);
      bits = dv.getUint16(off + 22, true);
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = Math.min(len, buf.byteLength - dataOff);
      break;
    }
    off += 8 + len + (len % 2);
  }
  if (bits !== 16 || channels < 1 || dataOff < 0 || rate <= 0)
    throw new Error('VOICE: unsupported WAV (need 16-bit PCM)');
  const frames = Math.floor(dataLen / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) acc += dv.getInt16(dataOff + (i * channels + c) * 2, true);
    samples[i] = acc / channels / 32768;
  }
  return { sampleRate: rate, samples };
}

function rms(s: Float32Array, a: number, b: number): number {
  let e = 0;
  for (let i = a; i < b; i++) e += (s[i] ?? 0) ** 2;
  return Math.sqrt(e / Math.max(1, b - a));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx] ?? 0;
}

export interface Measured {
  readonly durationS: number;
  readonly f0: {
    readonly median: number;
    readonly p10: number;
    readonly p90: number;
    readonly std: number;
    readonly voicedFrames: number;
  };
  readonly pauses: { readonly count: number; readonly meanMs: number };
  readonly speechFraction: number;
}

export function measure(audio: PcmAudio, minPauseMs = 250): Measured {
  const { sampleRate: sr, samples } = audio;
  const hop = Math.round(sr * 0.01),
    win = Math.round(sr * 0.04);
  const minLag = Math.floor(sr / 400),
    maxLag = Math.ceil(sr / 70);
  const energies: number[] = [];
  for (let i = 0; i + win <= samples.length; i += hop) energies.push(rms(samples, i, i + win));
  const peak = Math.max(...energies, 1e-9);
  const gate = Math.max(peak * 0.04, 0.003);
  const f0s: number[] = [];
  const speech: boolean[] = [];
  for (let f = 0; f < energies.length; f++) {
    const active = (energies[f] ?? 0) > gate;
    speech.push(active);
    if (!active) continue;
    const start = f * hop;
    let r0 = 0;
    for (let i = 0; i < win; i++) r0 += (samples[start + i] ?? 0) ** 2;
    if (r0 <= 0) continue;
    let bestLag = 0,
      best = 0;
    for (let lag = minLag; lag <= maxLag && lag < win; lag++) {
      let r = 0;
      for (let i = 0; i + lag < win; i++)
        r += (samples[start + i] ?? 0) * (samples[start + i + lag] ?? 0);
      if (r > best) {
        best = r;
        bestLag = lag;
      }
    }
    if (bestLag > 0 && best / r0 > 0.45) f0s.push(sr / bestLag);
  }
  const sorted = [...f0s].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
  const std = Math.sqrt(
    sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, sorted.length)
  );
  // pauses: silent runs >= minPauseMs strictly inside the speech span
  const first = speech.indexOf(true),
    last = speech.lastIndexOf(true);
  const runs: number[] = [];
  let run = 0;
  for (let f = Math.max(0, first); f <= last; f++) {
    if (!speech[f]) run++;
    else {
      if (run * 10 >= minPauseMs) runs.push(run * 10);
      run = 0;
    }
  }
  const span = Math.max(1, last - first + 1);
  const active = speech.slice(Math.max(0, first), last + 1).filter(Boolean).length;
  return {
    durationS: samples.length / sr,
    f0: {
      median: percentile(sorted, 0.5),
      p10: percentile(sorted, 0.1),
      p90: percentile(sorted, 0.9),
      std,
      voicedFrames: sorted.length,
    },
    pauses: {
      count: runs.length,
      meanMs: runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0,
    },
    speechFraction: active / span,
  };
}

export interface Comparison {
  readonly metric: string;
  readonly target: number;
  readonly measured: number;
  readonly tolerance: string;
  readonly ok: boolean;
}

/** Objective comparison against the profile. Tolerances are deliberately loose: this checks register and pacing, not identity. */
export function compareToProfile(m: Measured, p: VoiceProfile): Comparison[] {
  const rel = (t: number, v: number, frac: number, metric: string): Comparison => ({
    metric,
    target: t,
    measured: v,
    tolerance: `±${Math.round(frac * 100)}%`,
    ok: Math.abs(v - t) <= t * frac,
  });
  return [
    rel(p.f0Hz.median, m.f0.median, 0.15, 'f0_median_hz'),
    rel(p.f0Hz.p10, m.f0.p10, 0.2, 'f0_p10_hz'),
    rel(p.f0Hz.p90, m.f0.p90, 0.2, 'f0_p90_hz'),
    {
      metric: 'speech_fraction',
      target: p.speechFraction,
      measured: m.speechFraction,
      tolerance: '±0.15',
      ok: Math.abs(m.speechFraction - p.speechFraction) <= 0.15,
    },
    rel(p.pauses.meanMs, m.pauses.meanMs, 0.5, 'pause_mean_ms'),
  ];
}
