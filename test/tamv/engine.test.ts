// state: draft | engine-generated — pruebas del orquestador y sus cotas de entrada.
import { describe, expect, it } from 'vitest';
import { encodeWavPcm16 } from '../../src/ivcc/audio';
import {
  TAMV_LIMITS,
  TAMV_UNSUPPORTED_MIME_TYPES,
  analyzeBytes,
  decodeAudioPayload,
  isTamvFailure,
  runPipeline,
  tamvStatus,
  type TamvFailure,
} from '../../src/tamv/engine';
import { buildAdaptivePreset } from '../../src/tamv/adaptive';
import { buildRedefinePlan } from '../../src/tamv/plan';
import { TAMV_FACTORY_PRESETS } from '../../src/tamv/presets';
import { FIX_RATE, analysisOf, monoWav, tone } from './fixtures';

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function codeOf(result: unknown): string {
  if (!isTamvFailure(result)) throw new Error('se esperaba un rechazo del motor');
  return result.code;
}

describe('TAMV motor · límites de entrada', () => {
  it('declara las cotas que el servidor no puede sobrepasar', () => {
    expect(TAMV_LIMITS.maxBytes).toBe(180_000);
    expect(TAMV_LIMITS.minSamplesPerChannel).toBe(2048);
    expect(TAMV_LIMITS.maxDurationMs).toBe(180_000);
    expect(TAMV_UNSUPPORTED_MIME_TYPES).toContain('audio/mpeg');
  });

  it('sin payload no hay análisis', () => {
    expect(codeOf(decodeAudioPayload({}))).toBe('TAMV_PAYLOAD_EMPTY');
    expect(codeOf(decodeAudioPayload({ dataUrl: '' }))).toBe('TAMV_PAYLOAD_EMPTY');
    expect(codeOf(decodeAudioPayload({ base64: '   ', mimeType: 'audio/wav' }))).toBe(
      'TAMV_PAYLOAD_EMPTY'
    );
    expect(codeOf(decodeAudioPayload({ dataUrl: 'data:audio/wav;base64,' }))).toBe('TAMV_PAYLOAD_EMPTY');
  });

  it('rechaza base64 sucio y data URLs mal formados', () => {
    expect(codeOf(decodeAudioPayload({ base64: 'no-es-base64!!', mimeType: 'audio/wav' }))).toBe(
      'TAMV_BASE64_INVALID'
    );
    expect(codeOf(decodeAudioPayload({ dataUrl: 'audio/wav;base64,AAAA' }))).toBe('TAMV_BASE64_INVALID');
    expect(codeOf(decodeAudioPayload({ dataUrl: 'data:audio/wav;base64,@@@' }))).toBe('TAMV_BASE64_INVALID');
  });

  it('ningún contenedor que no sea WAV entra, aunque el base64 sea válido', () => {
    expect(codeOf(decodeAudioPayload({ base64: 'QUJD', mimeType: 'audio/mpeg' }))).toBe(
      'TAMV_MIME_UNSUPPORTED'
    );
    expect(codeOf(decodeAudioPayload({ base64: 'QUJD', mimeType: 'application/pdf' }))).toBe(
      'TAMV_MIME_UNSUPPORTED'
    );
    expect(codeOf(decodeAudioPayload({ dataUrl: 'data:audio/flac;base64,QUJD' }))).toBe(
      'TAMV_MIME_UNSUPPORTED'
    );
  });

  it('acepta los alias de WAV y normaliza el MIME', () => {
    const wav = monoWav(tone(440, 0.2));
    for (const mime of ['audio/wav', 'audio/x-wav', 'AUDIO/WAV', 'audio/wave', 'audio/vnd.wave']) {
      const decoded = decodeAudioPayload({ base64: b64(wav), mimeType: mime });
      expect(isTamvFailure(decoded)).toBe(false);
    }
    const withCodecs = decodeAudioPayload({ dataUrl: `data:audio/wav;codecs=pcm;base64,${b64(wav)}` });
    expect(isTamvFailure(withCodecs)).toBe(false);
  });

  it('el techo de bytes se aplica al binario, no al texto codificado', () => {
    const decoded = decodeAudioPayload({ base64: b64(new Uint8Array(200_000)), mimeType: 'audio/wav' });
    expect(codeOf(decoded)).toBe('TAMV_PAYLOAD_TOO_LARGE');
    expect(String((decoded as TamvFailure).message)).toContain('200000');
  });
});

describe('TAMV motor · análisis de bytes reales', () => {
  it('un binario que no es RIFF se rechaza, no se degrada a silencio', () => {
    expect(codeOf(analyzeBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 'audio/wav'))).toBe(
      'TAMV_WAV_UNDECODEABLE'
    );
  });

  it('un clip más corto que la ventana FFT no produce espectro falso', () => {
    const tiny = encodeWavPcm16(tone(440, 0.3, 1000), FIX_RATE, 1);
    expect(codeOf(analyzeBytes(tiny, 'audio/wav'))).toBe('TAMV_SIGNAL_TOO_SHORT');
  });

  it('la cota de CPU por request se aplica aunque el contenedor sea válido', () => {
    const longFrames = 8000 * 181;
    const long = encodeWavPcm16(new Float32Array(longFrames), 8000, 1);
    expect(codeOf(analyzeBytes(long, 'audio/wav'))).toBe('TAMV_DURATION_TOO_LONG');
  });

  it('es determinista: el mismo WAV da el mismo id y las mismas métricas', () => {
    const wav = monoWav(tone(330, 0.25));
    const a = analysisOf(wav);
    const b = analysisOf(wav);
    expect(b.analysisId).toBe(a.analysisId);
    expect(b.features).toEqual(a.features);
    expect(b.prediction).toEqual(a.prediction);
    expect(b.source.sha256).toBe(a.source.sha256);
    expect(analysisOf(monoWav(tone(331, 0.25))).analysisId).not.toBe(a.analysisId);
  });

  it('la latencia reportada viene del reloj inyectado, no de un número decorativo', () => {
    let tick = 0;
    const stamps = [1_000, 1_042];
    const analysis = analyzeBytes(monoWav(tone(440, 0.2)), 'audio/wav', {
      clock: () => stamps[tick++] ?? 1_042,
    });
    if (isTamvFailure(analysis)) throw new Error(analysis.code);
    expect(analysis.analysisLatencyMs).toBe(42);
    expect(analysis.authorizationPerformed).toBe(false);
    expect(analysis.executionPerformed).toBe(false);
    expect(analysis.source.sampleFormat).toBe('pcm');
    expect(analysis.source.bitsPerSample).toBe(16);
  });

  it('un audio más largo que el límite del body se queda fuera antes de decodificar', () => {
    const wav = monoWav(tone(440, 0.2, FIX_RATE));
    const decoded = decodeAudioPayload({ base64: b64(wav), mimeType: 'audio/wav' });
    if (isTamvFailure(decoded)) throw new Error(decoded.code);
    expect(decoded.bytes.length).toBeLessThanOrEqual(TAMV_LIMITS.maxBytes);
  });
});

describe('TAMV motor · estado y pipeline', () => {
  it('el estado del runtime dice la verdad sobre lo que no existe', () => {
    const status = tamvStatus();
    expect(status.realtimePlayback).toBe(false);
    expect(status.hapticActuators).toBe(false);
    expect(status.gpuAcceleration).toBe(false);
    expect(status.analysisBackend).toBe('native_typed_array_dsp');
    expect(status.factoryPresetCount).toBe(TAMV_FACTORY_PRESETS.length);
    expect(status.governedScopes).toEqual(['VOICE_SYNTHESIS']);
    expect(status.maxAnalyzedBytes).toBe(TAMV_LIMITS.maxBytes);
  });

  it('pipeline: análisis, preset y plan comparten la misma fuente', () => {
    const wav = monoWav(tone(220, 0.3));
    const result = runPipeline(wav, 'audio/wav');
    if (isTamvFailure(result)) throw new Error(result.code);
    expect(result.preset.presetId).toBe(`adaptive_${result.analysis.source.sha256.slice(0, 12)}`);
    expect(result.plan.analysisId).toBe(result.analysis.analysisId);
    expect(result.plan.presetId).toBe(result.preset.presetId);
    expect(result.plan.stages.every((item) => item.audioRendered === false)).toBe(true);
    expect(result.plan.digest).toBe(buildRedefinePlan(result.analysis, buildAdaptivePreset(result.analysis)).digest);
  });

  it('pipeline propaga el rechazo sin inventar un resultado a medias', () => {
    const rejected = runPipeline(Buffer.from('esto no es un wav'), 'audio/wav');
    expect(isTamvFailure(rejected)).toBe(true);
  });

  it('isTamvFailure reconoce el falloreject y nada más', () => {
    expect(isTamvFailure({ ok: false, code: 'X', message: 'y' })).toBe(true);
    expect(isTamvFailure({ ok: true })).toBe(false);
    expect(isTamvFailure(null)).toBe(false);
    expect(isTamvFailure('TAMV_WAV_UNDECODEABLE')).toBe(false);
    expect(isTamvFailure(analysisOf(monoWav(tone(440, 0.2))))).toBe(false);
  });
});
