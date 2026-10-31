import { describe, expect, it } from 'vitest';
import {
  decodeWav,
  detectWavWatermark,
  encodeWavPcm16,
  masterWav,
  watermarkWav,
} from '../../src/ivcc/audio';

const WATERMARK_KEY = Buffer.alloc(32, 0x42);

function tone(seconds = 0.4, sampleRate = 24_000): Uint8Array {
  const frames = Math.round(seconds * sampleRate);
  const samples = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    samples[index] = 0.2 * Math.sin((2 * Math.PI * 440 * index) / sampleRate);
  }
  return encodeWavPcm16(samples, sampleRate, 1);
}

const meta = {
  traceId: 'ivcc_trace_audio_test',
  profileId: 'isabella-reference-v1',
  consentDigest: 'a'.repeat(64),
  issuedAt: '2026-01-01T00:00:00.000Z',
};

describe('IVCC audio finishing', () => {
  it('round-trips PCM16 WAV metadata and samples', () => {
    const wav = tone(0.1);
    const decoded = decodeWav(wav);
    expect(decoded).not.toBeNull();
    expect(decoded!.sampleRate).toBe(24_000);
    expect(decoded!.channels).toBe(1);
    expect(decoded!.frames).toBe(2_400);
    expect(Math.abs(decoded!.samples[60]!)).toBeLessThan(0.25);
    expect(decoded!.samples.some((sample) => sample !== 0)).toBe(true);
  });

  it('masters WAV deterministically and reports honest measurements', () => {
    const result = masterWav(tone());
    expect(result.report.status).toBe('mastered');
    expect(result.wav).not.toBeNull();
    expect(result.report.measuredLufs).toBeNull();
    expect(result.report.format).toBe('pcm16-wav');
    expect(result.report.peakDbfs).toBeLessThanOrEqual(-0.99);
    expect(result.report.gainDb).toBeTypeOf('number');
    expect(decodeWav(result.wav!)).not.toBeNull();
    expect(result.report.note).toMatch(/LUFS/i);
  });

  it('embeds a signed ISAB watermark bound to the PCM digest', () => {
    const watermarked = watermarkWav(tone(), meta, WATERMARK_KEY);
    expect(watermarked.report.status).toBe('embedded');
    expect(watermarked.report.chunkId).toBe('ISAB');
    expect(watermarked.wav).not.toBeNull();

    const detection = detectWavWatermark(watermarked.wav!, WATERMARK_KEY);
    expect(detection.present).toBe(true);
    expect(detection.signatureValid).toBe(true);
    expect(detection.audioSha256Valid).toBe(true);
    expect(detection.lsbValid).toBe(true);
    expect(detection.meta?.traceId).toBe(meta.traceId);
    expect(detection.issues).toEqual([]);
  });

  it('detects audio tampering and rejects a wrong signing key', () => {
    const watermarked = watermarkWav(tone(), meta, WATERMARK_KEY);
    const decoded = decodeWav(watermarked.wav!)!;
    const tampered = new Uint8Array(watermarked.wav!);
    const view = new DataView(tampered.buffer);
    const offset = decoded.dataOffset + 500 * 2;
    view.setInt16(offset, view.getInt16(offset, true) ^ 0x0002, true);

    const detection = detectWavWatermark(tampered, WATERMARK_KEY);
    expect(detection.present).toBe(true);
    expect(detection.audioSha256Valid).toBe(false);
    expect(detection.issues).toContain('AUDIO_DIGEST_MISMATCH');
    expect(detection.lsbValid).toBe(true);

    const wrongKey = detectWavWatermark(watermarked.wav!, Buffer.alloc(32, 0x43));
    expect(wrongKey.signatureValid).toBe(false);
    expect(wrongKey.audioSha256Valid).toBe(true);
    expect(wrongKey.issues).toContain('ISAB_SIGNATURE_INVALID');
  });

  it('never fakes mastering or watermarking on non-WAV payloads', () => {
    const notWav = Uint8Array.from([1, 2, 3, 4, 5]);
    expect(decodeWav(notWav)).toBeNull();
    const mastering = masterWav(notWav);
    expect(mastering.report.status).toBe('skipped');
    expect(mastering.wav).toBeNull();
    const watermark = watermarkWav(notWav, meta, WATERMARK_KEY);
    expect(watermark.report.status).toBe('unavailable');
    expect(watermark.wav).toBeNull();
  });

  it('refuses to stamp a partial watermark on audio that is too short', () => {
    const short = encodeWavPcm16(new Float32Array(32), 24_000, 1);
    const result = watermarkWav(short, meta, WATERMARK_KEY);
    expect(result.report.status).toBe('unavailable');
    expect(result.report.reason).toBe('AUDIO_TOO_SHORT_FOR_LSB');
    expect(result.wav).toBeNull();
  });
});
