/**
 * state: engine-generated
 * Isabella native speech engine: governance → pronunciation memory → normalization → prosody plan → router → backend.
 * Backends are real: operator neural service (native-fsim), key-driven server TTS, or the client's browser speech
 * (driven by the plan). If no audio backend produces bytes, the result is a CLIENT PLAN — never a fake audio claim.
 */
import { randomUUID } from 'node:crypto';
import { synthesizeSpeech, describeSpeechReadiness } from '../inference/speech';
import { ISABELLA_VOICE_PROFILE, resolveCanonicalVoice } from '../inference/voice-profile';
import { MemoryVoiceCore } from './memory';
import { TtsGovernor, digestJson, sealTtsEvidence } from './governance';
import { NativeFsimAdapter, nativeConfigFromEnv } from './native-adapter';
import { synthesizeKeylessSpeech } from './keyless';
import { normalizeEsMx } from './normalize';
import { planProsody } from './prosody';
import { CognitiveRouter, routeFeatures, type RouteDecision } from './router';
import { SentenceChunker, chunkPauseMs } from './streaming';
import type { ExpertKind, ProsodyPlan, SpeechRequest, VoiceMode } from './types';
import { MX_REGIONS, VOICE_MODES } from './types';

export interface TtsEnv {
  [k: string]: string | undefined;
}
export interface EngineDeps {
  readonly env: TtsEnv;
  readonly native?: NativeFsimAdapter | null;
  readonly serverTts?: typeof synthesizeSpeech;
  readonly memory?: MemoryVoiceCore;
  readonly governor?: TtsGovernor;
  readonly router?: CognitiveRouter;
}

export interface PlanResult {
  readonly traceId: string;
  readonly normalizedText: string;
  readonly plan: ProsodyPlan;
  readonly route: RouteDecision;
  readonly planDigest: string;
}

export interface SpeechPlanChunk {
  readonly index: number;
  readonly total: number;
  readonly text: string;
  readonly plan: ProsodyPlan;
  readonly pauseAfterMs: number;
  readonly estimatedDurationMs: number;
}

export interface StreamPlanResult extends PlanResult {
  readonly chunks: readonly SpeechPlanChunk[];
  readonly estimatedDurationMs: number;
}

export type SynthesisResult =
  | { readonly status: 'denied'; readonly traceId: string; readonly reason: string }
  | {
      readonly status: 'audio' | 'client-plan';
      readonly traceId: string;
      readonly backend: ExpertKind;
      readonly audio: {
        readonly mimeType: string;
        readonly dataUrl: string;
        readonly bytes: number;
      } | null;
      readonly plan: ProsodyPlan;
      readonly route: RouteDecision;
      readonly normalizedText: string;
      readonly evidenceHash: string;
      readonly latencyMs: number;
      readonly attempted: readonly ExpertKind[];
      readonly voice: string;
    };

export class GenesisTtsEngine {
  readonly memory: MemoryVoiceCore;
  private readonly governor: TtsGovernor;
  private readonly router: CognitiveRouter;
  private readonly native: NativeFsimAdapter | null;
  private readonly serverTts: typeof synthesizeSpeech;

  constructor(private readonly deps: EngineDeps) {
    this.memory = deps.memory ?? new MemoryVoiceCore();
    this.governor =
      deps.governor ?? new TtsGovernor({ strict: deps.env.TTS_STRICT_GOVERNANCE === '1' });
    this.router = deps.router ?? new CognitiveRouter();
    const cfg = nativeConfigFromEnv(deps.env);
    this.native = deps.native !== undefined ? deps.native : cfg ? new NativeFsimAdapter(cfg) : null;
    this.serverTts = deps.serverTts ?? synthesizeSpeech;
  }

  private experts(): Array<{ id: ExpertKind; available: boolean }> {
    return [
      { id: 'native-fsim', available: this.native?.available() ?? false },
      { id: 'server-tts', available: describeSpeechReadiness(this.deps.env).textToSpeech },
      { id: 'browser-speech', available: true },
    ];
  }

  plan(req: SpeechRequest): PlanResult {
    const traceId = `tts_${randomUUID()}`;
    const mode: VoiceMode = req.mode && VOICE_MODES.includes(req.mode) ? req.mode : 'CONVERSACION';
    const normalizedText = normalizeEsMx(this.memory.apply(req.actorId, req.text));
    const plan = planProsody(normalizedText, {
      ...(req.emotionVector ? { emotion: req.emotionVector } : {}),
      mode,
    });
    const route = this.router.route(
      this.experts(),
      routeFeatures(plan, mode, normalizedText.length)
    );
    return {
      traceId,
      normalizedText,
      plan,
      route,
      planDigest: digestJson({ p: plan.phrases, c: plan.cues.map((c) => c.id) }),
    };
  }

  /**
   * Sentence-level delivery plan for progressive playback. Chunks are planned
   * independently so a player can start after the first one; no audio is produced
   * here and no backend is contacted.
   */
  planStream(req: SpeechRequest): StreamPlanResult {
    const planned = this.plan(req);
    const mode: VoiceMode = req.mode && VOICE_MODES.includes(req.mode) ? req.mode : 'CONVERSACION';
    const chunker = new SentenceChunker({ minLength: 6, maxChunkChars: 240 });
    const pieces = [...chunker.feed(planned.normalizedText), ...chunker.flush()];
    const chunks = pieces.map((text, index): SpeechPlanChunk => {
      const plan = planProsody(text, {
        ...(req.emotionVector ? { emotion: req.emotionVector } : {}),
        mode,
      });
      const pauseAfterMs = index === pieces.length - 1 ? 0 : chunkPauseMs(text, plan.emotion);
      return {
        index,
        total: pieces.length,
        text,
        plan,
        pauseAfterMs,
        estimatedDurationMs: plan.estimatedDurationMs,
      };
    });
    return {
      ...planned,
      chunks,
      estimatedDurationMs: chunks.reduce(
        (sum, chunk) => sum + chunk.estimatedDurationMs + chunk.pauseAfterMs,
        0
      ),
    };
  }

  async synthesize(
    req: SpeechRequest,
    timeoutMs = 20_000,
    options: { keylessOnly?: boolean } = {}
  ): Promise<SynthesisResult> {
    const started = Date.now();
    const gov = this.governor.validate({
      nonce: req.nonce,
      actorId: req.actorId,
      textLength: req.text.trim().length,
    });
    if (!gov.allowed)
      return { status: 'denied', traceId: `tts_${randomUUID()}`, reason: gov.reason };
    const mode: VoiceMode = req.mode && VOICE_MODES.includes(req.mode) ? req.mode : 'CONVERSACION';
    const region = req.region && MX_REGIONS.includes(req.region) ? req.region : 'cdmx';
    const voice = resolveCanonicalVoice(this.deps.env);
    const planned = this.plan(req);
    const attempted: ExpertKind[] = [];
    let audio: { mimeType: string; dataUrl: string; bytes: number } | null = null;
    let backend: ExpertKind = 'browser-speech';
    for (const r of planned.route.ranked) {
      // Browser speech is the fallback plan, never a reason to skip a configured backend.
      if (r.id === 'browser-speech') continue;
      if (options.keylessOnly && r.id !== 'server-tts') continue;
      attempted.push(r.id);
      if (r.id === 'native-fsim' && this.native) {
        const out = await this.native.synthesize(
          {
            text: planned.normalizedText,
            region,
            mode,
            emotion: { ...planned.plan.emotion },
            actorId: req.actorId,
            nonce: req.nonce,
            voiceId: voice.nativeVoiceId,
          },
          timeoutMs
        );
        if (out) {
          audio = { mimeType: out.mimeType, dataUrl: out.dataUrl, bytes: out.bytes };
          backend = 'native-fsim';
          break;
        }
      } else if (r.id === 'server-tts') {
        const out = options.keylessOnly
          ? await synthesizeKeylessSpeech(this.deps.env, {
              text: planned.normalizedText,
              timeoutMs,
            })
          : await this.serverTts(this.deps.env, {
              text: planned.normalizedText,
              timeoutMs,
            });
        if (out) {
          audio = { mimeType: out.mimeType, dataUrl: out.dataUrl, bytes: out.bytes };
          backend = 'server-tts';
          break;
        }
      }
    }
    return {
      status: audio ? 'audio' : 'client-plan',
      traceId: planned.traceId,
      backend: audio ? backend : 'browser-speech',
      audio,
      plan: planned.plan,
      route: planned.route,
      normalizedText: planned.normalizedText,
      evidenceHash: sealTtsEvidence({
        traceId: planned.traceId,
        normalizedText: planned.normalizedText,
        backend: audio ? backend : 'browser-speech',
        planDigest: planned.planDigest,
      }),
      latencyMs: Date.now() - started,
      attempted,
      voice: voice.id,
    };
  }

  /** Truthful capability report: what runs here vs what exists only as specification. */
  async status(): Promise<Record<string, unknown>> {
    const probe = this.native ? await this.native.probe() : null;
    const speech = describeSpeechReadiness(this.deps.env);
    const telemetry = this.native?.telemetry() ?? null;
    const voice = resolveCanonicalVoice(this.deps.env);
    return {
      engine: 'genesis-tts-mx-prime',
      profile: ISABELLA_VOICE_PROFILE.id,
      voice: {
        id: voice.id,
        label: voice.label,
        language: voice.language,
        gender: voice.gender,
        nativeVoiceId: voice.nativeVoiceId,
        providerVoice: voice.providerVoice,
      },
      implemented: [
        'normalizer-es-mx',
        'prosody-planner',
        'cultural-cues-rule-based',
        'emotion-12-axes-heuristic',
        'cognitive-router-gating',
        'memory-voice-core',
        'governance-anti-replay',
        'evidence-sha3-512',
        'native-adapter-retry-backoff',
        'incremental-sentence-chunker',
        'sse-speech-plan-stream',
        'barge-in-latch',
        'keyless-neural-fallback',
      ],
      backends: {
        'native-fsim': this.native
          ? probe?.reachable
            ? { state: 'reachable', telemetry }
            : {
                state: 'unreachable',
                reason: probe && !probe.reachable ? probe.reason : 'UNKNOWN',
                telemetry,
              }
          : { state: 'not_configured' },
        'server-tts': {
          state: speech.textToSpeech ? 'configured' : 'not_configured',
          providers: speech.providers,
          speechToText: speech.speechToText,
        },
        'browser-speech': { state: 'client' },
      },
      audioServerSide: Boolean(probe?.reachable) || speech.textToSpeech,
      specificationOnly: [
        'AMoSE neural experts',
        'MTAA-Ω attention',
        'BigVGAN vocoder',
        'Acoustic DNA',
        'HCT-L/HCT-Q GPU kernels',
        'Emotion Matrix Ω-X128 (12 axes implemented)',
        'provider-native PCM/audio streaming (the implemented stream carries plans, not audio)',
      ],
      designTargetsNotMeasured: true,
    };
  }
}
