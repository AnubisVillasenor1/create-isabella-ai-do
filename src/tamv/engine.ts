/**
 * state: draft | engine-generated — TAMV Kaos Audio System: orquestación del motor.
 *
 * Copyright (c) 2026 TAMV ONLINE ENTERPRISE — Edwin Oswaldo Castillo Trejo (Anubis Villaseñor).
 *
 * Punto de entrada único: payload → PCM → mediciones → perfil → preset → plan. No hay estado
 * global ni E/S: el mismo WAV produce el mismo `analysisId`, el mismo preset y el mismo
 * `digest`. Nada de lo que sale de aquí movió un altavoz.
 */
import { decodeWav } from '../ivcc/audio';
import { round, sha256Hex } from '../ivcc/util';
import {
  classifyContent,
  computeAudioFeatures,
  deriveEmotionalProfile,
  deriveSpatialComplexity,
} from './analysis';
import { DEFAULT_FFT_SIZE } from './dsp';
import { buildAdaptivePreset, derivePresetMatrix } from './adaptive';
import { selectClosestFactoryPreset } from './presets';
import { buildRedefinePlan } from './plan';
import {
  TAMV_ENGINE_VERSION,
  type TamvAnalysis,
  type TamvPreset,
  type TamvRedefinePlan,
  type TamvRuntimeStatus,
} from './types';

export const TAMV_LIMITS = Object.freeze({
  /** 180 kB crudos: el body JSON global del servidor está limitado a 256 kB y base64 infla ~33 %. */
  maxBytes: 180_000,
  /** Un cuadro FFT completo: sin esto no hay espectro que promediar. */
  minSamplesPerChannel: DEFAULT_FFT_SIZE,
  /** 3 minutos: cota de trabajo CPU por request en serverless. */
  maxDurationMs: 180_000,
} as const);

export const TAMV_UNSUPPORTED_MIME_TYPES = Object.freeze([
  'audio/mpeg',
  'audio/flac',
  'audio/ogg',
  'audio/mp4',
  'audio/webm',
] as const);

const LIMITATIONS: readonly string[] = Object.freeze([
  'No hay reproducción en tiempo real: el motor mide y declara, no emite sonido.',
  'No hay separación de fuentes ejecutada: la etapa `source_separation` es un objetivo para un motor externo.',
  'No hay HRTF ni render binaural/ambisonic: width/height/depth son parámetros declarados.',
  'No hay medidor LUFS: la puerta de sonoridad usa RMS medido, que no es loudness percibida EBU R128.',
  'El clasificador es un conjunto de ponderaciones visibles, no un modelo entrenado; `confidence` no es probabilidad calibrada.',
  'Sin actuador háptico conectado: el patrón háptico es metadata para un dispositivo cliente.',
  'No se leen sensores térmicos ni contadores GPU: esas lecturas se devuelven como `measured: false`.',
]);

export type TamvFailureCode =
  | 'TAMV_PAYLOAD_EMPTY'
  | 'TAMV_PAYLOAD_TOO_LARGE'
  | 'TAMV_BASE64_INVALID'
  | 'TAMV_MIME_UNSUPPORTED'
  | 'TAMV_WAV_UNDECODEABLE'
  | 'TAMV_SIGNAL_TOO_SHORT'
  | 'TAMV_DURATION_TOO_LONG';

export interface TamvFailure {
  readonly ok: false;
  readonly code: TamvFailureCode;
  readonly message: string;
}

function fail(code: TamvFailureCode, message: string): TamvFailure {
  return { ok: false, code, message };
}

/** Estabilizador de tipos: sirve para la unión de análisis y para la del payload. */
export function isTamvFailure(value: unknown): value is TamvFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok?: unknown }).ok === false
  );
}

export interface AudioPayloadInput {
  readonly dataUrl?: unknown;
  readonly base64?: unknown;
  readonly mimeType?: unknown;
}

const DATA_URL_RE = /^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]*)$/s;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isSupportedWavMime(mime: string): boolean {
  return (
    mime === 'audio/wav' ||
    mime === 'audio/x-wav' ||
    mime === 'audio/wave' ||
    mime === 'audio/vnd.wave'
  );
}

/** Acepta `data:audio/wav;base64,...` o `base64` + `mimeType`. Rechaza todo lo demás, sin excepción. */
export function decodeAudioPayload(
  input: AudioPayloadInput
): { bytes: Uint8Array; mimeType: string } | TamvFailure {
  let mimeType = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';
  let encoded: string | null = null;

  if (typeof input.dataUrl === 'string' && input.dataUrl.length > 0) {
    const match = DATA_URL_RE.exec(input.dataUrl.trim());
    if (match === null)
      return fail(
        'TAMV_BASE64_INVALID',
        'data URL malformed: se espera data:<mime>;base64,<payload>.'
      );
    mimeType = (match[1] ?? '').toLowerCase();
    encoded = match[2] ?? '';
  } else if (typeof input.base64 === 'string' && input.base64.length > 0) {
    encoded = input.base64.trim();
  } else {
    return fail(
      'TAMV_PAYLOAD_EMPTY',
      'Sin payload de audio: envía `dataUrl` o `base64` con `mimeType`.'
    );
  }

  if (encoded.length === 0) return fail('TAMV_PAYLOAD_EMPTY', 'Payload de audio vacío.');
  if (!BASE64_RE.test(encoded))
    return fail('TAMV_BASE64_INVALID', 'El payload no es base64 válido.');
  if (mimeType.length > 0 && !isSupportedWavMime(mimeType)) {
    if ((TAMV_UNSUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return fail(
        'TAMV_MIME_UNSUPPORTED',
        `Contenedor '${mimeType}' no soportado: el motor nativo decodifica WAV (PCM/float).`
      );
    }
    return fail('TAMV_MIME_UNSUPPORTED', `MIME '${mimeType}' no reconocido por el decodificador.`);
  }

  const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'));
  if (bytes.length === 0)
    return fail('TAMV_PAYLOAD_EMPTY', 'El base64 se decodificó a cero bytes.');
  if (bytes.length > TAMV_LIMITS.maxBytes) {
    return fail(
      'TAMV_PAYLOAD_TOO_LARGE',
      `Payload de ${bytes.length} bytes excede el límite de ${TAMV_LIMITS.maxBytes} bytes por request.`
    );
  }
  return { bytes, mimeType: mimeType || 'audio/wav' };
}

export interface AnalyzeOptions {
  readonly clock?: () => number;
}

/** PCM real → mediciones reales. `null` si el contenedor no es WAV decodificable. */
export function analyzeBytes(
  bytes: Uint8Array,
  mimeType: string,
  options: AnalyzeOptions = {}
): TamvAnalysis | TamvFailure {
  const startedAt = (options.clock ?? Date.now)();
  const decoded = decodeWav(bytes);
  if (decoded === null) {
    return fail(
      'TAMV_WAV_UNDECODEABLE',
      'No es un WAV RIFF decodificable (PCM 8/16/24/32 o float 32).'
    );
  }
  if (decoded.frames * decoded.channels < TAMV_LIMITS.minSamplesPerChannel * decoded.channels) {
    return fail(
      'TAMV_SIGNAL_TOO_SHORT',
      `Se requieren al menos ${TAMV_LIMITS.minSamplesPerChannel} muestras por canal para estimar el espectro.`
    );
  }
  const durationMs = (decoded.frames / decoded.sampleRate) * 1000;
  if (durationMs > TAMV_LIMITS.maxDurationMs) {
    return fail(
      'TAMV_DURATION_TOO_LONG',
      `Duración de ${round(durationMs / 1000, 1)} s supera la cota por request.`
    );
  }

  const features = computeAudioFeatures({
    samples: decoded.samples,
    sampleRate: decoded.sampleRate,
    channels: decoded.channels,
  });
  const prediction = classifyContent(features);
  const sha256 = sha256Hex(bytes);
  const measured: Omit<TamvAnalysis, 'recommendedPresetId'> = {
    analysisId: `tamv_${sha256.slice(0, 16)}`,
    createdAt: new Date().toISOString(),
    engineVersion: TAMV_ENGINE_VERSION,
    source: {
      sha256,
      bytes: bytes.length,
      mimeType,
      sampleFormat: decoded.sampleFormat,
      bitsPerSample: decoded.bitsPerSample,
    },
    features,
    prediction,
    emotion: deriveEmotionalProfile(features),
    spatialComplexity: deriveSpatialComplexity(features),
    analysisLatencyMs: 0,
    limitations: LIMITATIONS,
    authorizationPerformed: false,
    executionPerformed: false,
  };
  const matrix = derivePresetMatrix(measured);
  const recommended = selectClosestFactoryPreset(matrix);
  const latencyMs = Math.max(0, (options.clock ?? Date.now)() - startedAt);

  return {
    ...measured,
    recommendedPresetId: recommended.presetId,
    analysisLatencyMs: round(latencyMs, 2),
  };
}

export function tamvStatus(): TamvRuntimeStatus {
  return {
    engineVersion: TAMV_ENGINE_VERSION,
    analysisBackend: 'native_typed_array_dsp',
    realtimePlayback: false,
    hapticActuators: false,
    gpuAcceleration: false,
    factoryPresetCount: 11,
    supportedContainers: ['audio/wav (PCM 8/16/24/32, float 32, 1-8 canales, 8-192 kHz)'],
    maxAnalyzedBytes: TAMV_LIMITS.maxBytes,
    governedScopes: ['VOICE_SYNTHESIS'],
  };
}

export interface TamvPipelineResult {
  readonly analysis: TamvAnalysis;
  readonly preset: TamvPreset;
  readonly plan: TamvRedefinePlan;
}

export function runPipeline(bytes: Uint8Array, mimeType: string): TamvPipelineResult | TamvFailure {
  const analysis = analyzeBytes(bytes, mimeType);
  if (isTamvFailure(analysis)) return analysis;
  const preset = buildAdaptivePresetFor(analysis);
  return { analysis, preset, plan: buildRedefinePlan(analysis, preset) };
}

/** Expuesto para que la ruta y las pruebas compartan exactamente la misma derivación. */
export function buildAdaptivePresetFor(analysis: TamvAnalysis): TamvPreset {
  return buildAdaptivePreset(analysis);
}
