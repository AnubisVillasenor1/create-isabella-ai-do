/**
 * Keyless neural speech fallback.
 *
 * The operator-gated Edge endpoint rejects this network (HTTP 403), so the
 * runtime keeps a second keyless path: Google's Spanish neural read-aloud
 * endpoint. It is an EXTERNAL provider (text leaves the node), therefore it is
 * disabled unless the operator explicitly opts in with ISABELLA_KEYLESS_TTS.
 *
 * It is deliberately bounded: short sentence chunks, byte ceiling, timeout and
 * an LRU cache. No credential is required and no audio is fabricated.
 */

const ENABLE_VALUES: ReadonlySet<string> = new Set([
  'on',
  'true',
  '1',
  'google',
  'google-translate',
]);

const DEFAULT_ENDPOINT = 'https://translate.google.com/translate_tts';
const MAX_CHUNK_CHARS = 180;
const MAX_CHUNKS = 12;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const CACHE_MAX = 64;

export interface KeylessTtsConfig {
  readonly provider: 'google-translate';
  readonly endpoint: string;
  readonly language: 'es-MX';
  readonly maxChars: number;
}

export interface KeylessAudio {
  readonly provider: 'google-translate';
  readonly mimeType: 'audio/mpeg';
  readonly dataUrl: string;
  readonly bytes: number;
  readonly voice: string;
  readonly chunks: number;
}

const cache = new Map<string, KeylessAudio>();
const AUDIO_MAGIC = Buffer.from([0xff, 0xf3]);

export function keylessTtsConfigFromEnv(
  env: Readonly<Record<string, string | undefined>>
): KeylessTtsConfig | null {
  const flag = (env.ISABELLA_KEYLESS_TTS ?? '').trim().toLowerCase();
  if (!ENABLE_VALUES.has(flag)) return null;
  const endpoint = (env.ISABELLA_KEYLESS_TTS_URL?.trim() || DEFAULT_ENDPOINT).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(endpoint)) return null;
  const maxChars = Math.min(
    2_000,
    Math.max(200, Number(env.ISABELLA_KEYLESS_TTS_MAX_CHARS) || 1_200)
  );
  return Object.freeze({ provider: 'google-translate', endpoint, language: 'es-MX', maxChars });
}

/** Splits text at sentence/word boundaries so every request stays below the provider limit. */
export function chunkForSpeech(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?…]+[.!?…]*/g) ?? [normalized];
  const chunks: string[] = [];
  let current = '';
  const push = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = '';
  };
  for (const sentence of sentences) {
    const pieces = sentence.trim().split(/\s+/);
    for (const word of pieces) {
      if (word.length > maxChars) {
        push();
        for (let i = 0; i < word.length; i += maxChars) chunks.push(word.slice(i, i + maxChars));
        continue;
      }
      if (`${current} ${word}`.trim().length > maxChars) push();
      current = `${current} ${word}`.trim();
    }
    if (/[.!?…]$/.test(sentence)) push();
  }
  push();
  return chunks.slice(0, MAX_CHUNKS);
}

async function fetchChunk(
  config: KeylessTtsConfig,
  text: string,
  timeoutMs: number
): Promise<Buffer | null> {
  const url = new URL(config.endpoint);
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('client', 'tw-ob');
  url.searchParams.set('tl', config.language);
  url.searchParams.set('ttsspeed', '0.92');
  url.searchParams.set('q', text);
  const response = await fetch(url, {
    headers: {
      accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.1',
      'accept-language': 'es-MX,es;q=0.9',
      referer: 'https://translate.google.com/',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  const type = response.headers.get('content-type') ?? '';
  if (!/^audio\//i.test(type)) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 2 || !buffer.subarray(0, 2).equals(AUDIO_MAGIC)) return null;
  return buffer;
}

/**
 * Synthesizes Spanish speech without a credential. Returns null on any contract
 * violation; partial success is discarded so the caller never plays truncated text.
 */
export async function synthesizeKeylessSpeech(
  env: Readonly<Record<string, string | undefined>>,
  input: { text: string; timeoutMs?: number }
): Promise<KeylessAudio | null> {
  const config = keylessTtsConfigFromEnv(env);
  if (!config) return null;
  const text = input.text.replace(/\s+/g, ' ').trim().slice(0, config.maxChars);
  if (!text) return null;
  const chunks = chunkForSpeech(text);
  if (chunks.length === 0) return null;
  const cacheKey = `${config.language}|${chunks.join('|')}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const deadline = Date.now() + Math.max(2_000, input.timeoutMs ?? 20_000);
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    let buffer: Buffer | null = null;
    try {
      buffer = await fetchChunk(config, chunk, Math.max(1_000, remaining));
    } catch {
      return null;
    }
    if (!buffer) return null;
    buffers.push(buffer);
  }
  const audio = Buffer.concat(buffers);
  if (audio.byteLength < 2 || audio.byteLength > MAX_AUDIO_BYTES) return null;
  const result: KeylessAudio = Object.freeze({
    provider: 'google-translate',
    mimeType: 'audio/mpeg',
    dataUrl: `data:audio/mpeg;base64,${audio.toString('base64')}`,
    bytes: audio.byteLength,
    voice: 'google-es-MX-female',
    chunks: chunks.length,
  });
  cache.set(cacheKey, result);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return result;
}
