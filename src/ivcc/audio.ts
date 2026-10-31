/**
 * IVCC audio finishing: PCM WAV decoding, deterministic mastering and a signed
 * provenance watermark.
 *
 * Honest scope: the mastering chain is ours (DC removal, high-pass, presence EQ,
 * compressor, RMS normalization, limiter). It is not certified ITU-R BS.1770
 * LUFS, and the limiter has no true-peak oversampling. The watermark is a signed
 * RIFF `ISAB` chunk plus an LSB tag in PCM16 samples; LSB tagging is fragile to
 * lossy transcoding. Non-WAV backends are passed through and reported as
 * unmastered/unwatermarked rather than pretending otherwise.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MasteringReport, WatermarkReport } from './types';
import { canonicalJson, round, sha256Hex } from './util';

export interface DecodedWav {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly sampleFormat: 'pcm' | 'float';
  readonly frames: number;
  readonly samples: Float32Array;
  readonly dataOffset: number;
  readonly dataSize: number;
}

interface WavChunk {
  readonly id: string;
  readonly offset: number;
  readonly size: number;
  readonly dataOffset: number;
}

export interface WatermarkMeta {
  readonly v: 1;
  readonly policy: 'IVCC-ECP-1';
  readonly traceId: string;
  readonly profileId: string;
  readonly consentDigest: string;
  readonly issuedAt: string;
  readonly audioSha256: string;
  readonly lsbTag: string;
  readonly note: string;
}

export interface WatermarkDetection {
  readonly present: boolean;
  readonly signatureValid: boolean;
  readonly audioSha256Valid: boolean;
  readonly lsbValid: boolean;
  readonly meta: WatermarkMeta | null;
  readonly issues: readonly string[];
}

export interface MasterOutput {
  readonly wav: Uint8Array | null;
  readonly report: MasteringReport;
}

export interface WatermarkOutput {
  readonly wav: Uint8Array | null;
  readonly report: WatermarkReport;
}

export interface MasterOptions {
  readonly highpassHz?: number;
  readonly presenceHz?: number;
  readonly presenceGainDb?: number;
  readonly targetRmsDbfs?: number;
  readonly ceilingDbfs?: number;
}

function fourCC(value: string): string {
  return value.length === 4 ? value : value.slice(0, 4).padEnd(4, ' ');
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
}

function readChunks(bytes: Uint8Array): WavChunk[] | null {
  if (bytes.length < 12 || readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WAVE')
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: WavChunk[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    if (dataOffset + size > bytes.length) return null;
    chunks.push({ id, offset, size, dataOffset });
    offset = dataOffset + size + (size % 2);
  }
  if (!chunks.length) return null;
  return chunks;
}

export function decodeWav(bytes: Uint8Array): DecodedWav | null {
  const chunks = readChunks(bytes);
  if (!chunks) return null;
  const fmt = chunks.find((chunk) => chunk.id === 'fmt ');
  const data = chunks.find((chunk) => chunk.id === 'data');
  if (!fmt || !data || fmt.size < 16) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const audioFormat = view.getUint16(fmt.dataOffset, true);
  const channels = view.getUint16(fmt.dataOffset + 2, true);
  const sampleRate = view.getUint32(fmt.dataOffset + 4, true);
  const blockAlign = view.getUint16(fmt.dataOffset + 12, true);
  const bitsPerSample = view.getUint16(fmt.dataOffset + 14, true);
  if (channels < 1 || channels > 8 || sampleRate < 8_000 || sampleRate > 192_000) return null;
  if (bitsPerSample !== 8 && bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32)
    return null;
  const sampleFormat = audioFormat === 1 ? 'pcm' : audioFormat === 3 ? 'float' : null;
  if (!sampleFormat) return null;
  if (sampleFormat === 'float' && bitsPerSample !== 32) return null;
  const bytesPerSample = bitsPerSample / 8;
  const expectedAlign = channels * bytesPerSample;
  if (blockAlign !== expectedAlign || data.size === 0 || data.size % blockAlign !== 0) return null;
  const frames = data.size / blockAlign;
  const samples = new Float32Array(frames * channels);
  for (let frame = 0; frame < frames; frame += 1) {
    const base = data.dataOffset + frame * blockAlign;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = base + channel * bytesPerSample;
      let value = 0;
      if (sampleFormat === 'float') value = view.getFloat32(offset, true);
      else if (bitsPerSample === 8) value = (view.getUint8(offset) - 128) / 128;
      else if (bitsPerSample === 16) value = view.getInt16(offset, true) / 32768;
      else if (bitsPerSample === 24) {
        const raw =
          view.getUint8(offset) |
          (view.getUint8(offset + 1) << 8) |
          (view.getUint8(offset + 2) << 16);
        const signed = raw & 0x800000 ? raw - 0x1000000 : raw;
        value = signed / 8_388_608;
      } else value = view.getInt32(offset, true) / 2_147_483_648;
      samples[frame * channels + channel] = Number.isFinite(value) ? value : 0;
    }
  }
  return {
    sampleRate,
    channels,
    bitsPerSample,
    sampleFormat,
    frames,
    samples,
    dataOffset: data.dataOffset,
    dataSize: data.size,
  };
}

function buildWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels: number,
  extra?: { id: string; data: Uint8Array }
): Uint8Array {
  const fmtSize = 16;
  const extraPad = extra ? extra.data.length % 2 : 0;
  const dataPad = pcm.length % 2;
  const total =
    12 +
    (8 + fmtSize) +
    (8 + pcm.length + dataPad) +
    (extra ? 8 + extra.data.length + extraPad : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < 4; i += 1) out[offset + i] = text.charCodeAt(i);
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, total - 8, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, fmtSize, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  let cursor = 44 + pcm.length;
  if (dataPad) out[cursor] = 0;
  cursor += dataPad;
  if (extra) {
    writeAscii(cursor, fourCC(extra.id));
    view.setUint32(cursor + 4, extra.data.length, true);
    out.set(extra.data, cursor + 8);
    cursor += 8 + extra.data.length;
    if (extraPad) out[cursor] = 0;
  }
  return out;
}

function xorshift32(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function encodePcm16(samples: Float32Array, dither: boolean, seed = 0x1a5b9e37): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  const random = xorshift32(seed);
  for (let index = 0; index < samples.length; index += 1) {
    const ditherValue = dither ? (random() / 0x1_0000_0000 - random() / 0x1_0000_0000) * 0.5 : 0;
    const scaled = Math.round(Math.max(-1, Math.min(1, samples[index]!)) * 32768 + ditherValue);
    view.setInt16(index * 2, Math.max(-32768, Math.min(32767, scaled)), true);
  }
  return out;
}

function dbfs(value: number): number {
  return 20 * Math.log10(Math.max(1e-9, value));
}

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

function rmsOf(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

function highpassCoefficients(
  sampleRate: number,
  cutoffHz: number
): { b0: number; b1: number; b2: number; a1: number; a2: number } {
  const omega = (2 * Math.PI * cutoffHz) / sampleRate;
  const alpha = Math.sin(omega) / (2 * Math.SQRT1_2);
  const cos = Math.cos(omega);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function peakingCoefficients(
  sampleRate: number,
  frequency: number,
  gainDb: number,
  q = 1
): { b0: number; b1: number; b2: number; a1: number; a2: number } {
  const A = 10 ** (gainDb / 40);
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const cos = Math.cos(omega);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cos) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha / A) / a0,
  };
}

function biquad(
  channel: Float32Array,
  coefficients: { b0: number; b1: number; b2: number; a1: number; a2: number }
): void {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < channel.length; index += 1) {
    const x0 = channel[index]!;
    const y0 =
      coefficients.b0 * x0 +
      coefficients.b1 * x1 +
      coefficients.b2 * x2 -
      coefficients.a1 * y1 -
      coefficients.a2 * y2;
    channel[index] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
}

export function encodeWavPcm16(
  samples: Float32Array,
  sampleRate: number,
  channels: number
): Uint8Array {
  return buildWav(encodePcm16(samples, false), sampleRate, channels);
}

export function masterWav(input: Uint8Array, options: MasterOptions = {}): MasterOutput {
  const decoded = decodeWav(input);
  if (!decoded) {
    return {
      wav: null,
      report: {
        status: 'skipped',
        reason: 'UNSUPPORTED_AUDIO_CONTAINER',
        measuredLufs: null,
        note: 'Solo se masteriza WAV PCM/float; el audio del backend se devuelve sin procesar y sin afirmar mastering.',
      },
    };
  }
  const { sampleRate, channels, frames } = decoded;
  const channelsData = Array.from({ length: channels }, (_, channel) => {
    const data = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame += 1)
      data[frame] = decoded.samples[frame * channels + channel]!;
    return data;
  });
  const peakBefore = peakOf(decoded.samples);
  const rmsBefore = rmsOf(decoded.samples);

  for (const channel of channelsData) {
    let mean = 0;
    for (const sample of channel) mean += sample;
    mean /= Math.max(1, channel.length);
    for (let index = 0; index < channel.length; index += 1) channel[index] = channel[index]! - mean;
  }
  const highpass = highpassCoefficients(sampleRate, options.highpassHz ?? 80);
  const presence = peakingCoefficients(
    sampleRate,
    options.presenceHz ?? 3_200,
    options.presenceGainDb ?? 1.5,
    1
  );
  for (const channel of channelsData) {
    biquad(channel, highpass);
    biquad(channel, presence);
  }

  const threshold = 10 ** (-18 / 20);
  const ratio = 3;
  const attack = Math.exp(-1 / (0.01 * sampleRate));
  const release = Math.exp(-1 / (0.12 * sampleRate));
  let envelope = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    let level = 0;
    for (const channel of channelsData) level = Math.max(level, Math.abs(channel[frame]!));
    envelope =
      level > envelope
        ? attack * envelope + (1 - attack) * level
        : release * envelope + (1 - release) * level;
    const gain = envelope > threshold ? (threshold + (envelope - threshold) / ratio) / envelope : 1;
    for (const channel of channelsData) channel[frame] = channel[frame]! * gain;
  }

  const interleaved = new Float32Array(frames * channels);
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      interleaved[frame * channels + channel] = channelsData[channel]![frame]!;
    }
  }
  const targetRms = 10 ** ((options.targetRmsDbfs ?? -18) / 20);
  const rmsPreGain = Math.max(1e-9, rmsOf(interleaved));
  const targetGain = Math.max(10 ** (-12 / 20), Math.min(10 ** (12 / 20), targetRms / rmsPreGain));
  for (let index = 0; index < interleaved.length; index += 1)
    interleaved[index] = interleaved[index]! * targetGain;

  const ceiling = 10 ** ((options.ceilingDbfs ?? -1) / 20);
  let limiterGain = 1;
  let limitedSamples = 0;
  const releaseCoef = Math.exp(-1 / (0.05 * sampleRate));
  for (let frame = 0; frame < frames; frame += 1) {
    let peak = 0;
    for (let channel = 0; channel < channels; channel += 1)
      peak = Math.max(peak, Math.abs(interleaved[frame * channels + channel]!));
    const desired = peak > ceiling ? ceiling / peak : 1;
    if (desired < limiterGain) limiterGain = desired;
    else limiterGain += (desired - limiterGain) * (1 - releaseCoef);
    if (desired < 1) limitedSamples += 1;
    for (let channel = 0; channel < channels; channel += 1)
      interleaved[frame * channels + channel] =
        interleaved[frame * channels + channel]! * limiterGain;
  }

  const pcm = encodePcm16(interleaved, true, 0x1a5b9e37);
  const wav = buildWav(pcm, sampleRate, channels);
  return {
    wav,
    report: {
      status: 'mastered',
      format: 'pcm16-wav',
      sampleRate,
      channels,
      frames,
      durationMs: Math.round((frames / sampleRate) * 1000),
      peakDbfs: round(dbfs(peakOf(interleaved)), 2),
      rmsDbfs: round(dbfs(rmsOf(interleaved)), 2),
      gainDb: round(dbfs(targetGain), 2),
      limitedSamples,
      measuredLufs: null,
      note: `Mastering determinista: DC/high-pass/presencia/compresor/RMS/limitador. Entrada peak ${round(dbfs(peakBefore), 2)} dBFS, RMS ${round(dbfs(rmsBefore), 2)} dBFS. LUFS certificado y true-peak no medidos.`,
    },
  };
}

function tagFor(
  meta: Pick<WatermarkMeta, 'traceId' | 'profileId' | 'consentDigest' | 'issuedAt'>
): string {
  return sha256Hex(
    `${meta.traceId}|${meta.profileId}|${meta.consentDigest}|${meta.issuedAt}`
  ).slice(0, 8);
}

function embedLsb(pcm: Uint8Array, tagHex: string): boolean {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const samples = Math.floor(pcm.byteLength / 2);
  if (samples < 64) return false;
  const tag = Number.parseInt(tagHex.slice(0, 8), 16) >>> 0;
  const bits: number[] = [];
  const push = (value: number, width: number): void => {
    for (let bit = width - 1; bit >= 0; bit -= 1) bits.push((value >>> bit) & 1);
  };
  push(0x1a5b, 16);
  push(tag, 32);
  push(~tag & 0xffff, 16);
  for (let index = 0; index < 64; index += 1) {
    const current = view.getInt16(index * 2, true);
    view.setInt16(index * 2, (current & ~1) | bits[index]!, true);
  }
  return true;
}

function readLsb(pcm: Uint8Array): string | null {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  if (Math.floor(pcm.byteLength / 2) < 64) return null;
  let magic = 0;
  let tag = 0;
  let complement = 0;
  for (let index = 0; index < 64; index += 1) {
    const bit = view.getInt16(index * 2, true) & 1;
    if (index < 16) magic = (magic << 1) | bit;
    else if (index < 48) tag = (tag * 2 + bit) >>> 0;
    else complement = (complement << 1) | bit;
  }
  if (magic !== 0x1a5b || (~tag & 0xffff) !== complement) return null;
  return tag.toString(16).padStart(8, '0');
}

export function watermarkWav(
  input: Uint8Array,
  metaInput: { traceId: string; profileId: string; consentDigest: string; issuedAt: string },
  key: Buffer
): WatermarkOutput {
  const decoded = decodeWav(input);
  if (!decoded) {
    return {
      wav: null,
      report: {
        status: 'unavailable',
        reason: 'UNSUPPORTED_AUDIO_CONTAINER',
        note: 'El backend no devolvió WAV; no se estampa un watermark que no puede verificarse. Se conserva la procedencia en la respuesta JSON.',
      },
    };
  }
  const pcm = encodePcm16(decoded.samples, false);
  const tag = tagFor(metaInput);
  if (!embedLsb(pcm, tag)) {
    return {
      wav: null,
      report: {
        status: 'unavailable',
        reason: 'AUDIO_TOO_SHORT_FOR_LSB',
        note: 'El audio es demasiado corto para la etiqueta LSB; no se estampa un watermark parcial.',
      },
    };
  }
  const audioSha256 = sha256Hex(pcm);
  const meta: WatermarkMeta = {
    v: 1,
    policy: 'IVCC-ECP-1',
    traceId: metaInput.traceId,
    profileId: metaInput.profileId,
    consentDigest: metaInput.consentDigest,
    issuedAt: metaInput.issuedAt,
    audioSha256,
    lsbTag: tag,
    note: 'Metadatos de procedencia firmados; el LSB es frágil ante transcodificación.',
  };
  const signature = createHmac('sha256', key).update(canonicalJson(meta)).digest('hex');
  const payload = new TextEncoder().encode(JSON.stringify({ meta, signature }));
  const wav = buildWav(pcm, decoded.sampleRate, decoded.channels, { id: 'ISAB', data: payload });
  return {
    wav,
    report: {
      status: 'embedded',
      chunkId: 'ISAB',
      lsbTag: tag,
      signatureVerified: true,
      note: 'Chunk RIFF ISAB firmado con HMAC-SHA256 + etiqueta LSB PCM16. El LSB puede perderse al recodificar con pérdida.',
    },
  };
}

export function detectWavWatermark(input: Uint8Array, key: Buffer): WatermarkDetection {
  const chunks = readChunks(input);
  if (!chunks) {
    return {
      present: false,
      signatureValid: false,
      audioSha256Valid: false,
      lsbValid: false,
      meta: null,
      issues: ['NOT_WAV'],
    };
  }
  const isab = chunks.find((chunk) => chunk.id === 'ISAB');
  const data = chunks.find((chunk) => chunk.id === 'data');
  if (!isab) {
    return {
      present: false,
      signatureValid: false,
      audioSha256Valid: false,
      lsbValid: false,
      meta: null,
      issues: ['NO_ISAB_CHUNK'],
    };
  }
  const issues: string[] = [];
  let payload: { meta?: WatermarkMeta; signature?: string };
  try {
    payload = JSON.parse(
      new TextDecoder().decode(input.subarray(isab.dataOffset, isab.dataOffset + isab.size))
    ) as {
      meta?: WatermarkMeta;
      signature?: string;
    };
  } catch {
    return {
      present: true,
      signatureValid: false,
      audioSha256Valid: false,
      lsbValid: false,
      meta: null,
      issues: ['ISAB_PAYLOAD_INVALID'],
    };
  }
  const meta = payload.meta ?? null;
  if (!meta || meta.v !== 1 || meta.policy !== 'IVCC-ECP-1') {
    return {
      present: true,
      signatureValid: false,
      audioSha256Valid: false,
      lsbValid: false,
      meta,
      issues: ['ISAB_META_INVALID'],
    };
  }
  const expected = createHmac('sha256', key).update(canonicalJson(meta)).digest('hex');
  const signature = typeof payload.signature === 'string' ? payload.signature : '';
  const signatureValid =
    signature.length === expected.length &&
    Buffer.from(signature, 'utf8').length === Buffer.from(expected, 'utf8').length &&
    timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
  if (!signatureValid) issues.push('ISAB_SIGNATURE_INVALID');
  const dataBytes = data
    ? input.subarray(data.dataOffset, data.dataOffset + data.size)
    : new Uint8Array();
  const audioSha256Valid = Boolean(data) && sha256Hex(dataBytes) === meta.audioSha256;
  if (!audioSha256Valid) issues.push('AUDIO_DIGEST_MISMATCH');
  const lsb = data ? readLsb(dataBytes) : null;
  const lsbValid = lsb === tagFor(meta) && lsb === meta.lsbTag;
  if (!lsbValid) issues.push('LSB_TAG_MISMATCH');
  return { present: true, signatureValid, audioSha256Valid, lsbValid, meta, issues };
}
