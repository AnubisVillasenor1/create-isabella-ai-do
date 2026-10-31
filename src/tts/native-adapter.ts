/**
 * state: engine-generated
 * Adapter to an operator-run neural speech service (the TAMV "Génesis" FSIM runtime) over HTTP.
 * Contract (the service must satisfy it — a response with only a server-side file path is NOT usable by a remote client):
 *   GET  {base}/v1/status      → { state: "OPERATIONAL", ... }
 *   POST {base}/v1/synthesize  ← { text, language, region, mode, emotion_vector, actor_id, nonce, voice_id? }
 *                              → { status: "success", audio_base64, audio_mime, trace_id?, latency_ms?, experts_used? }
 * Configured ONLY by env (GENESIS_TTS_URL, optional GENESIS_TTS_TOKEN). Fails closed; never claims audio it did not receive.
 */
export interface NativeAudio {
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly bytes: number;
  readonly expertsUsed: readonly string[];
  readonly remoteTraceId: string | null;
}
export type NativeProbe =
  | {
      readonly reachable: true;
      readonly state: string;
      readonly raw: Readonly<Record<string, unknown>>;
    }
  | { readonly reachable: false; readonly reason: string };

const MIME_OK = /^audio\/(wav|x-wav|wave|mpeg|mp3|ogg|webm|flac|aac|mp4)$/i;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** Reachability probe TTL: how long a probe result is trusted for routing. */
const PROBE_TTL_MS = 15_000;

export interface NativeConfig {
  readonly baseUrl: string;
  readonly token: string | null;
}

export function nativeConfigFromEnv(env: Record<string, string | undefined>): NativeConfig | null {
  const raw = env.GENESIS_TTS_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (
    url.protocol === 'http:' &&
    env.NODE_ENV === 'production' &&
    !['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  )
    return null; // no cleartext off-box in production
  return {
    baseUrl: url.origin + url.pathname.replace(/\/+$/, ''),
    token: env.GENESIS_TTS_TOKEN?.trim() || null,
  };
}

export class NativeFsimAdapter {
  private cooldownUntil = 0;
  private probeCache: { at: number; value: NativeProbe } | null = null;
  private consecutiveFailures = 0;
  private totalSyntheses = 0;
  private successfulSyntheses = 0;
  constructor(
    private readonly config: NativeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly cooldownMs = 30_000,
    private readonly maxRetries = 1
  ) {}

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {}),
    };
  }

  /** Cached 15 s so routing never adds a network round trip to the hot path. */
  async probe(force = false): Promise<NativeProbe> {
    if (!force && this.probeCache && this.now() - this.probeCache.at < PROBE_TTL_MS)
      return this.probeCache.value;
    let value: NativeProbe;
    try {
      const r = await this.fetchImpl(`${this.config.baseUrl}/v1/status`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(2_500),
      });
      if (!r.ok) value = { reachable: false, reason: `HTTP_${r.status}` };
      else {
        const j = (await r.json()) as Record<string, unknown>;
        const state = typeof j.state === 'string' ? j.state : 'UNKNOWN';
        value =
          state === 'OPERATIONAL'
            ? { reachable: true, state, raw: j }
            : { reachable: false, reason: `STATE_${state}` };
      }
    } catch (e) {
      value = { reachable: false, reason: e instanceof Error ? e.name : 'ERROR' };
    }
    this.probeCache = { at: this.now(), value };
    return value;
  }

  /**
   * Whether a call may be ATTEMPTED now. False during cooldown; otherwise it
   * defers to a *fresh* probe only. A stale probe result (older than the probe
   * TTL) is treated as unknown and therefore optimistic, so recovering from a
   * transient outage does not require an extra round trip to un-stick routing.
   */
  available(): boolean {
    if (this.now() < this.cooldownUntil) return false;
    if (this.probeCache === null) return true;
    if (this.now() - this.probeCache.at >= PROBE_TTL_MS) return true;
    return this.probeCache.value.reachable;
  }

  /**
   * Failure-rate telemetry over the calls this adapter made. `failureRate` is a
   * fraction in 0..1 and is `null` before the first attempt, so callers never
   * read a fabricated 0%.
   */
  telemetry(): {
    readonly attempts: number;
    readonly successes: number;
    readonly consecutiveFailures: number;
    readonly failureRate: number | null;
    readonly inCooldown: boolean;
  } {
    return {
      attempts: this.totalSyntheses,
      successes: this.successfulSyntheses,
      consecutiveFailures: this.consecutiveFailures,
      failureRate:
        this.totalSyntheses === 0 ? null : 1 - this.successfulSyntheses / this.totalSyntheses,
      inCooldown: this.now() < this.cooldownUntil,
    };
  }

  private enterCooldown(reason: string): void {
    this.consecutiveFailures += 1;
    // Exponential backoff on repeated failures, capped at 8x the base cooldown.
    const factor = Math.min(8, 2 ** Math.min(3, this.consecutiveFailures - 1));
    this.cooldownUntil = this.now() + this.cooldownMs * factor;
    this.probeCache = { at: this.now(), value: { reachable: false, reason } };
  }

  private decodeAudio(j: Record<string, unknown>): NativeAudio | null {
    if (j.status !== 'success') return null;
    const b64 = typeof j.audio_base64 === 'string' ? j.audio_base64 : '';
    const mime = typeof j.audio_mime === 'string' ? j.audio_mime : '';
    if (!b64) return null;
    if (!MIME_OK.test(mime)) return null;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
    const bytes = Math.floor((b64.length * 3) / 4);
    if (bytes <= 0 || bytes > MAX_AUDIO_BYTES) return null;
    return {
      mimeType: mime.toLowerCase(),
      dataUrl: `data:${mime.toLowerCase()};base64,${b64}`,
      bytes,
      expertsUsed: Array.isArray(j.experts_used)
        ? j.experts_used.filter((x): x is string => typeof x === 'string').slice(0, 10)
        : [],
      remoteTraceId: typeof j.trace_id === 'string' ? j.trace_id.slice(0, 80) : null,
    };
  }

  async synthesize(
    req: {
      text: string;
      region: string;
      mode: string;
      emotion: Record<string, number>;
      actorId?: string | undefined;
      nonce?: string | undefined;
      voiceId?: string | undefined;
    },
    timeoutMs: number
  ): Promise<NativeAudio | null> {
    if (this.now() < this.cooldownUntil) return null;
    const body = JSON.stringify({
      text: req.text,
      language: 'es-MX',
      region: req.region,
      mode: req.mode,
      emotion_vector: req.emotion,
      actor_id: req.actorId,
      nonce: req.nonce,
      voice_id: req.voiceId,
    });
    const deadline = this.now() + Math.max(500, timeoutMs);
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Only retry transport/5xx failures; a decoded-but-invalid payload is a
      // contract violation and is not retried (it would just fail again).
      this.totalSyntheses += 1;
      try {
        const remaining = deadline - this.now();
        if (remaining <= 0) throw new Error('NATIVE_DEADLINE_EXCEEDED');
        const r = await this.fetchImpl(`${this.config.baseUrl}/v1/synthesize`, {
          method: 'POST',
          headers: this.headers(),
          body,
          signal: AbortSignal.timeout(Math.max(500, remaining)),
        });
        if (r.status >= 500) throw new Error(`NATIVE_HTTP_${r.status}`);
        if (!r.ok) {
          this.enterCooldown(`NATIVE_HTTP_${r.status}`);
          return null;
        }
        const j = (await r.json()) as Record<string, unknown>;
        const audio = this.decodeAudio(j);
        if (!audio) {
          this.enterCooldown('NATIVE_PAYLOAD_REJECTED');
          return null;
        }
        this.successfulSyntheses += 1;
        this.consecutiveFailures = 0;
        return audio;
      } catch (e) {
        if (attempt < this.maxRetries && this.now() < deadline) continue;
        this.enterCooldown(e instanceof Error ? e.message : 'ERROR');
        return null;
      }
    }
    return null;
  }
}
