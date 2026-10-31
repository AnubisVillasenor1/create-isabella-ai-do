/**
 * Speech layer: key-driven, fail-closed text-to-speech and speech-to-text.
 *
 * Isabella only attempts a provider when an operator supplies the credential and
 * (optionally) the model explicitly. No audio is produced or transcribed without
 * a configured provider; the browser's own Web Speech API is the honest offline
 * fallback and is owned by the client, not by this module.
 */

import { resolveCanonicalVoice } from './voice-profile';
import { keylessTtsConfigFromEnv, synthesizeKeylessSpeech } from '../tts/keyless';

export const SPEECH_CONTRACT_VERSION = '1.0.0';

export type SpeechProvider = 'groq' | 'google-translate';

export interface SpeechReadiness {
  textToSpeech: boolean;
  speechToText: boolean;
  providers: SpeechProvider[];
}

export interface SynthesizedSpeech {
  provider: SpeechProvider;
  mimeType: string;
  dataUrl: string;
  bytes: number;
  voice: string;
}

export interface Transcription {
  provider: SpeechProvider;
  text: string;
}

interface GroqSpeechConfig {
  key: string;
  baseUrl: string;
  ttsModel: string;
  ttsVoice: string;
  sttModel: string;
}

const DEFAULT_GROQ_BASE = 'https://api.groq.com/openai/v1';
// Do not silently select an English-only model for Spanish-language output.
// Operators must explicitly configure a model suitable for their target language.
const DEFAULT_TTS_MODEL = '';
const DEFAULT_STT_MODEL = 'whisper-large-v3';

// Caché LRU de síntesis para reducir latencia en textos repetidos.
const TTS_CACHE_MAX = 64;
const ttsCache = new Map<string, SynthesizedSpeech>();
const ALLOWED_AUDIO_MIME =
  /^audio\/(mpeg|mp3|mp4|m4a|x-m4a|wav|x-wav|wave|webm|ogg|oga|flac|aac)$/i;
const AUDIO_EXTENSION: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/oga': 'ogg',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
};

/** Provider multipart uploads require a filename with a recognized audio extension. */
function audioFileName(mimeType: string): string {
  return `audio.${AUDIO_EXTENSION[mimeType.toLowerCase()] ?? 'wav'}`;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function groqSpeechConfig(env: Record<string, string | undefined>): GroqSpeechConfig | null {
  const key = nonEmpty(env.GROQ_API_KEY);
  if (!key) return null;
  return {
    key,
    baseUrl: (nonEmpty(env.GROQ_BASE_URL) ?? DEFAULT_GROQ_BASE).replace(/\/+$/, ''),
    ttsModel: nonEmpty(env.GROQ_TTS_MODEL) ?? DEFAULT_TTS_MODEL,
    // One canonical female identity: request bodies cannot select another voice.
    ttsVoice: resolveCanonicalVoice(env).providerVoice,
    sttModel: nonEmpty(env.GROQ_STT_MODEL) ?? DEFAULT_STT_MODEL,
  };
}

export function describeSpeechReadiness(env: Record<string, string | undefined>): SpeechReadiness {
  const config = groqSpeechConfig(env);
  const keyless = keylessTtsConfigFromEnv(env);
  const providers: SpeechProvider[] = [];
  if (config) providers.push('groq');
  if (keyless) providers.push('google-translate');
  return {
    textToSpeech: (config !== null && config.ttsModel.length > 0) || keyless !== null,
    speechToText: config !== null,
    providers,
  };
}

/**
 * Text-to-speech via Groq's OpenAI-compatible audio endpoint (Orpheus), with an
 * operator-gated keyless neural fallback. Returns null when no provider is
 * configured or every configured provider rejects the request.
 */
export async function synthesizeSpeech(
  env: Record<string, string | undefined>,
  input: { text: string; format?: 'wav' | 'mp3'; timeoutMs?: number }
): Promise<SynthesizedSpeech | null> {
  const text = nonEmpty(input.text)?.slice(0, 2_000);
  if (!text) return null;
  const config = groqSpeechConfig(env);
  const format = input.format === 'mp3' ? 'mp3' : 'wav';
  if (config && config.ttsModel) {
    const cacheKey = `${config.ttsModel}|${config.ttsVoice}|${format}|${text}`;
    const cached = ttsCache.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const response = await fetch(`${config.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ttsModel,
          input: text,
          voice: config.ttsVoice,
          response_format: format,
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
      });
      if (!response.ok) throw new Error(`groq speech HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0) throw new Error('groq speech returned empty audio');
      const result: SynthesizedSpeech = {
        provider: 'groq',
        mimeType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        dataUrl: `data:${format === 'mp3' ? 'audio/mpeg' : 'audio/wav'};base64,${buffer.toString('base64')}`,
        bytes: buffer.byteLength,
        voice: config.ttsVoice,
      };
      ttsCache.set(cacheKey, result);
      if (ttsCache.size > TTS_CACHE_MAX) {
        const oldest = ttsCache.keys().next().value;
        if (oldest !== undefined) ttsCache.delete(oldest);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Isabella] primary speech synthesis unavailable', {
        message: message.slice(0, 180),
      });
    }
  }
  const keyless = await synthesizeKeylessSpeech(env, {
    text,
    timeoutMs: input.timeoutMs,
  });
  if (!keyless) return null;
  return {
    provider: keyless.provider,
    mimeType: keyless.mimeType,
    dataUrl: keyless.dataUrl,
    bytes: keyless.bytes,
    voice: keyless.voice,
  };
}

/**
 * Speech-to-text via Groq Whisper. Audio arrives as a base64 payload plus an
 * explicit audio mime type; other content types fail closed.
 */
export async function transcribeAudio(
  env: Record<string, string | undefined>,
  input: { base64: string; mimeType: string; language?: string; timeoutMs?: number }
): Promise<Transcription | null> {
  const config = groqSpeechConfig(env);
  if (!config) return null;
  const mimeType = nonEmpty(input.mimeType);
  if (!mimeType || !ALLOWED_AUDIO_MIME.test(mimeType)) return null;
  const base64 = nonEmpty(input.base64);
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  try {
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.byteLength === 0) return null;
    const form = new FormData();
    form.append('model', config.sttModel);
    const language = nonEmpty(input.language);
    if (language) form.append('language', language);
    form.append('response_format', 'json');
    form.append('file', new Blob([bytes], { type: mimeType }), audioFileName(mimeType));
    const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}` },
      body: form,
      signal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
    });
    if (!response.ok) throw new Error(`groq transcription HTTP ${response.status}`);
    const payload = (await response.json()) as { text?: unknown };
    const text = nonEmpty(payload.text);
    if (!text) return null;
    return { provider: 'groq', text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Isabella] speech transcription unavailable', { message: message.slice(0, 180) });
    return null;
  }
}
