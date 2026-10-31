/**
 * IVCC runtime orchestrator.
 *
 * Text → deterministic semantics → cognitive state → speech plan → prosody →
 * breathing → emphasis → optional existing TTS backend → WAV mastering →
 * signed watermark → audit. Consent is checked before planning and re-checked
 * before delivering audio, so a revocation that lands mid-synthesis discards
 * the result. Voice capability never authorizes or executes an action.
 */
import { randomUUID } from 'node:crypto';
import { CANONICAL_VOICE_ID } from '../inference/voice-profile';
import { splitSentences } from '../omega-runtime/text';
import { normalizeEsMx } from '../tts/normalize';
import { MX_REGIONS, VOICE_MODES, type MxRegion, type VoiceMode } from '../tts/types';
import type { GenesisTtsEngine } from '../tts/engine';
import { decodeWav, encodeWavPcm16, masterWav, watermarkWav } from './audio';
import { verifyAuditChain } from './audit';
import { deriveCognitiveState } from './cognitive';
import {
  validateConsentInState,
  verifyUsageTokenInState,
  IvccConsentManager,
  SUBJECT_REF_RE,
} from './consent';
import { planEmphasis } from './emphasis';
import {
  addPronunciationEntry,
  applyPronunciationMemory,
  effectivePitchOffset,
  effectiveTraits,
  setProsodyAdjustment,
} from './memory';
import { buildSpeechPlan, IvccPlanLimitError } from './planner';
import { planBreathing, planProsody } from './prosody';
import { interpretSemantics } from './semantic';
import { loadIvccSecrets, resolveIvccDataDir } from './secrets';
import { JsonFileIvccStore, MemoryIvccStore, type IvccStore } from './store';
import {
  DEFAULT_TRAITS,
  IVCC_POLICY,
  IVCC_TIERS,
  IVCC_TIER_FEATURES,
  IVCC_VERSION,
  type BreathPlan,
  type CognitiveState,
  type ConsentScope,
  type EmphasisPlan,
  type IvccCreateProfileInput,
  type IvccCreateProfileOutcome,
  type IvccMemoryLearnOutcome,
  type IvccPlanOutcome,
  type IvccPlanRequest,
  type IvccPlanResult,
  type IvccRegisterConsentInput,
  type IvccRevokeInput,
  type IvccSpeechPlan,
  type IvccSynthesisOutcome,
  type IvccSynthesisResult,
  type IvccTier,
  type IvccVoiceProfile,
  type SemanticInterpretation,
  type VoiceMemoryRecord,
  type VoiceTraits,
} from './types';
import type { ConsentTransaction } from './consent';
import { clamp, canonicalJson, sha256Hex } from './util';
import type {
  RegisterConsentResult,
  RevokeResult,
  AuditReadResult,
  CheckConsentResult,
} from './consent';

const SYNTHETIC_SUBJECT_REF = 'synthetic:isabella';
const SYNTHETIC_PROFILE_ID = 'isabella-reference-v1';
const SYNTHETIC_CONSENT_ID = 'cns_synthetic_isabella_v1';
const SYNTHETIC_SCOPES: readonly ConsentScope[] = [
  'voice_profile:create',
  'voice:synthesize',
  'emotion:infer',
  'prosody:memory',
];
const PLAN_SCOPES: readonly ConsentScope[] = ['voice:synthesize', 'emotion:infer'];
const TTS_CHUNK_CHARS = 1_500;
const MAX_TEXT_CHARS = 4_000;

export interface IvccEngineDeps {
  readonly store: IvccStore;
  readonly subjectSalt: Buffer;
  readonly watermarkKey: Buffer;
  readonly tts?: GenesisTtsEngine | null;
  readonly now?: () => Date;
}

export interface PlanAccess {
  readonly allowWithoutUsageToken: boolean;
}

interface ResolvedProfile {
  readonly profile: IvccVoiceProfile;
}

interface ProfileDenied {
  readonly reason: string;
  readonly subjectHash: string | null;
  readonly detail?: Readonly<Record<string, unknown>>;
}

function isDenied(value: ResolvedProfile | ProfileDenied): value is ProfileDenied {
  return 'reason' in value;
}

function asTier(value: unknown): IvccTier | null {
  return typeof value === 'string' && (IVCC_TIERS as readonly string[]).includes(value)
    ? (value as IvccTier)
    : null;
}

function normalizeTraits(input?: Partial<VoiceTraits>): VoiceTraits {
  const traits = { ...DEFAULT_TRAITS };
  if (!input) return traits;
  for (const key of ['rate', 'pitch', 'warmth', 'energy', 'formality'] as const) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) traits[key] = clamp(value, 0, 1);
  }
  if (
    input.pauseStyle === 'compact' ||
    input.pauseStyle === 'measured' ||
    input.pauseStyle === 'dramatic'
  ) {
    traits.pauseStyle = input.pauseStyle;
  }
  return traits;
}

function identityDigest(input: {
  id: string;
  subjectHash: string;
  traits: VoiceTraits;
  tier: IvccTier;
  voiceHint: string | null;
  region: MxRegion;
}): string {
  return sha256Hex(canonicalJson({ version: 1, ...input, cloning: false }));
}

function syntheticProfile(nowIso: string, subjectHash: string): IvccVoiceProfile {
  const traits: VoiceTraits = { ...DEFAULT_TRAITS, warmth: 0.74, formality: 0.64 };
  const tier: IvccTier = 'L';
  const region: MxRegion = 'cdmx';
  const base = {
    id: SYNTHETIC_PROFILE_ID,
    subjectHash,
    traits,
    tier,
    voiceHint: CANONICAL_VOICE_ID,
    region,
  };
  return {
    ...base,
    label: 'Isabella (sintética)',
    synthetic: true,
    identityDigest: identityDigest(base),
    createdAt: nowIso,
    revokedAt: null,
    cloning: false,
    version: 1,
  };
}

function chunkTextForTts(text: string): string[] {
  const sentences = splitSentences(text, 400);
  const chunks: string[] = [];
  let current = '';
  const flush = (): void => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };
  const pushLong = (sentence: string): void => {
    const words = sentence.split(/\s+/);
    let piece = '';
    for (const word of words) {
      const candidate = piece ? `${piece} ${word}` : word;
      if (candidate.length > TTS_CHUNK_CHARS && piece) {
        chunks.push(piece);
        piece = word;
      } else {
        piece = candidate;
      }
    }
    if (piece) chunks.push(piece);
  };
  for (const sentence of sentences) {
    if (sentence.length > TTS_CHUNK_CHARS) {
      flush();
      pushLong(sentence);
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > TTS_CHUNK_CHARS) {
      flush();
      current = sentence;
    } else {
      current = candidate;
    }
  }
  flush();
  return chunks.length ? chunks : [text];
}

function decodeDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/s.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2]!, 'base64');
  if (!bytes.length) return null;
  return { mimeType: match[1]!, bytes: new Uint8Array(bytes) };
}

function combineWavs(parts: readonly Uint8Array[]): Uint8Array | null {
  const decoded = parts.map((part) => decodeWav(part));
  if (decoded.some((part) => !part)) return null;
  const first = decoded[0]!;
  if (
    decoded.some(
      (part) => part!.sampleRate !== first.sampleRate || part!.channels !== first.channels
    )
  )
    return null;
  const gapFrames = Math.round(first.sampleRate * 0.18);
  const totalFrames =
    decoded.reduce((sum, part) => sum + part!.frames, 0) + gapFrames * (decoded.length - 1);
  const samples = new Float32Array(totalFrames * first.channels);
  let cursor = 0;
  decoded.forEach((part, index) => {
    samples.set(part!.samples, cursor);
    cursor += part!.frames * first.channels;
    if (index < decoded.length - 1) cursor += gapFrames * first.channels;
  });
  return encodeWavPcm16(samples, first.sampleRate, first.channels);
}

export class IvccEngine {
  readonly consent: IvccConsentManager;
  readonly durable: boolean;
  private readonly store: IvccStore;
  private readonly subjectSalt: Buffer;
  private readonly watermarkKey: Buffer;
  private readonly tts: GenesisTtsEngine | null;
  private readonly now: () => Date;
  private readonly ready: Promise<void>;

  constructor(deps: IvccEngineDeps) {
    this.store = deps.store;
    this.durable = deps.store.durable;
    this.subjectSalt = deps.subjectSalt;
    this.watermarkKey = deps.watermarkKey;
    this.tts = deps.tts ?? null;
    this.now = deps.now ?? (() => new Date());
    this.consent = new IvccConsentManager(deps.store, deps.subjectSalt, this.now);
    this.ready = this.ensureBaseline();
  }

  private async ensureBaseline(): Promise<void> {
    await this.consent.transaction((tx) => {
      const syntheticHash = this.consent.hashSubject(SYNTHETIC_SUBJECT_REF);
      const existingConsent = tx.state.consents.find(
        (record) => record.consentId === SYNTHETIC_CONSENT_ID
      );
      if (!existingConsent) {
        tx.state.consents.push({
          consentId: SYNTHETIC_CONSENT_ID,
          subjectHash: syntheticHash,
          scopes: SYNTHETIC_SCOPES,
          grantedAt: tx.nowIso,
          expiresAt: null,
          revokedAt: null,
          method: 'operator-policy',
          evidenceHash: sha256Hex(`${IVCC_POLICY}:synthetic-operator-baseline`),
          policy: IVCC_POLICY,
          synthetic: true,
          version: 1,
        });
        if (!tx.state.profiles.some((profile) => profile.id === SYNTHETIC_PROFILE_ID)) {
          tx.state.profiles.push(syntheticProfile(tx.nowIso, syntheticHash));
        }
        tx.audit('system.baseline', syntheticHash, 'system:bootstrap', {
          profileId: SYNTHETIC_PROFILE_ID,
          scopes: SYNTHETIC_SCOPES,
          policy: IVCC_POLICY,
          note: 'Identidad sintética del operador; no representa a una persona humana.',
        });
        return;
      }
      if (existingConsent.revokedAt) {
        // Revocation is permanent across restarts: never recreate the synthetic identity silently.
        tx.state.profiles = tx.state.profiles.filter(
          (profile) => profile.id !== SYNTHETIC_PROFILE_ID
        );
        return;
      }
      if (!tx.state.profiles.some((profile) => profile.id === SYNTHETIC_PROFILE_ID)) {
        tx.state.profiles.push(syntheticProfile(tx.nowIso, syntheticHash));
        tx.audit('system.baseline', syntheticHash, 'system:bootstrap', {
          profileId: SYNTHETIC_PROFILE_ID,
          repaired: true,
          policy: IVCC_POLICY,
        });
      }
    });
  }

  private resolveProfile(
    state: ConsentTransaction['state'],
    request: IvccPlanRequest
  ): ResolvedProfile | ProfileDenied {
    let profile: IvccVoiceProfile | undefined;
    let requestedHash: string | null = null;
    if (request.subjectRef) {
      if (!SUBJECT_REF_RE.test(request.subjectRef)) {
        return { reason: 'IVCC_SUBJECT_REF_INVALID', subjectHash: null };
      }
      requestedHash = this.consent.hashSubject(request.subjectRef);
    }
    if (request.profileId) {
      if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(request.profileId)) {
        return { reason: 'IVCC_PROFILE_ID_INVALID', subjectHash: requestedHash };
      }
      profile = state.profiles.find((item) => item.id === request.profileId);
      if (!profile)
        return {
          reason: 'IVCC_PROFILE_NOT_FOUND',
          subjectHash: requestedHash,
          detail: { profileId: request.profileId },
        };
      if (profile.revokedAt)
        return { reason: 'IVCC_PROFILE_REVOKED', subjectHash: profile.subjectHash };
    } else if (requestedHash) {
      profile = state.profiles.find(
        (item) => item.subjectHash === requestedHash && !item.revokedAt
      );
      if (!profile && requestedHash === this.consent.hashSubject(SYNTHETIC_SUBJECT_REF)) {
        profile = state.profiles.find((item) => item.id === SYNTHETIC_PROFILE_ID);
      }
      if (!profile) return { reason: 'IVCC_PROFILE_NOT_FOUND', subjectHash: requestedHash };
    } else {
      profile = state.profiles.find((item) => item.id === SYNTHETIC_PROFILE_ID);
      if (!profile)
        return {
          reason: 'IVCC_SYNTHETIC_PROFILE_UNAVAILABLE',
          subjectHash: this.consent.hashSubject(SYNTHETIC_SUBJECT_REF),
        };
    }
    if (profile.revokedAt)
      return { reason: 'IVCC_PROFILE_REVOKED', subjectHash: profile.subjectHash };
    if (requestedHash && requestedHash !== profile.subjectHash) {
      return {
        reason: 'IVCC_SUBJECT_MISMATCH',
        subjectHash: profile.subjectHash,
        detail: { profileId: profile.id },
      };
    }
    return { profile };
  }

  private deny(
    tx: ConsentTransaction,
    traceId: string,
    actor: string,
    reason: string,
    subjectHash: string | null,
    detail?: Readonly<Record<string, unknown>>
  ): IvccPlanOutcome {
    const event = tx.audit('voice.denied', subjectHash, actor, { reason, ...(detail ?? {}) });
    return {
      status: 'denied',
      traceId,
      reason,
      ...(detail ? { detail } : {}),
      auditSeq: event.seq,
      authorizationPerformed: false,
      executionPerformed: false,
    };
  }

  async plan(
    request: IvccPlanRequest,
    actor: string,
    access: PlanAccess = { allowWithoutUsageToken: false }
  ): Promise<IvccPlanOutcome> {
    await this.ready;
    const traceId = `ivcc_${randomUUID()}`;
    return this.consent.transaction((tx) => {
      const resolved = this.resolveProfile(tx.state, request);
      if (isDenied(resolved)) {
        return this.deny(
          tx,
          traceId,
          actor,
          resolved.reason,
          resolved.subjectHash,
          resolved.detail
        );
      }
      const profile = resolved.profile;
      const subjectHash = profile.subjectHash;
      const requestedTier = request.tier === undefined ? profile.tier : asTier(request.tier);
      if (!requestedTier) return this.deny(tx, traceId, actor, 'IVCC_TIER_INVALID', subjectHash);
      const memoryRecord = request.memory === false ? null : (tx.state.memory[subjectHash] ?? null);
      const usesMemory = Boolean(
        memoryRecord && (memoryRecord.entries.length > 0 || memoryRecord.adjustment)
      );
      const requiredScopes: ConsentScope[] = [
        ...PLAN_SCOPES,
        ...(usesMemory ? (['prosody:memory'] as const) : []),
      ];

      if (request.consentToken) {
        const tokenCheck = verifyUsageTokenInState(
          tx.state,
          request.consentToken,
          subjectHash,
          requiredScopes,
          tx.now
        );
        if (!tokenCheck.valid) {
          return this.deny(tx, traceId, actor, 'IVCC_USAGE_TOKEN_INVALID', subjectHash, {
            tokenReason: tokenCheck.reason,
            missingScopes: tokenCheck.missingScopes,
          });
        }
      } else if (!profile.synthetic && !access.allowWithoutUsageToken) {
        return this.deny(tx, traceId, actor, 'IVCC_USAGE_TOKEN_REQUIRED', subjectHash, {
          profileId: profile.id,
        });
      }

      const consent = validateConsentInState(tx.state, subjectHash, requiredScopes, tx.now);
      if (!consent.valid) {
        return this.deny(tx, traceId, actor, `IVCC_CONSENT_${consent.reason}`, subjectHash, {
          profileId: profile.id,
          consentReason: consent.reason,
          requiredScopes,
          missingScopes: consent.missingScopes,
        });
      }

      const rawText = typeof request.text === 'string' ? request.text.trim() : '';
      if (!rawText) return this.deny(tx, traceId, actor, 'IVCC_TEXT_REQUIRED', subjectHash);
      if (rawText.length > MAX_TEXT_CHARS) {
        return this.deny(tx, traceId, actor, 'IVCC_TEXT_SIZE_LIMIT_EXCEEDED', subjectHash, {
          maxChars: MAX_TEXT_CHARS,
        });
      }

      let normalizedText: string;
      let memoryApplied = 0;
      try {
        const memoryResult = usesMemory
          ? applyPronunciationMemory(rawText, memoryRecord)
          : { text: rawText, applied: 0 };
        memoryApplied = memoryResult.applied;
        normalizedText = normalizeEsMx(memoryResult.text);
      } catch (error) {
        return this.deny(tx, traceId, actor, 'IVCC_NORMALIZATION_FAILED', subjectHash, {
          message: error instanceof Error ? error.message : 'unknown',
        });
      }

      let semantic: SemanticInterpretation;
      let cognitive: CognitiveState;
      let emphasis: EmphasisPlan;
      let speechPlan: IvccSpeechPlan;
      let prosody: IvccPlanResult['prosody'];
      let breathing: BreathPlan;
      try {
        semantic = interpretSemantics(normalizedText);
        const baseTraits = effectiveTraits(profile.traits, usesMemory ? memoryRecord : null);
        const traits: VoiceTraits = {
          ...baseTraits,
          pitch: clamp(
            baseTraits.pitch + effectivePitchOffset(usesMemory ? memoryRecord : null) / 4,
            0.05,
            0.95
          ),
        };
        cognitive = deriveCognitiveState({
          text: normalizedText,
          semantic,
          traits,
          tier: requestedTier,
          ...(request.emotion ? { explicitEmotion: request.emotion } : {}),
        });
        emphasis = planEmphasis(semantic, cognitive, requestedTier);
        speechPlan = buildSpeechPlan({
          text: normalizedText,
          semantic,
          cognitive,
          emphasis,
          traits,
          tier: requestedTier,
        });
        prosody = planProsody({
          plan: speechPlan,
          cognitive,
          semantic,
          emphasis,
          traits,
          tier: requestedTier,
        });
        breathing = planBreathing(speechPlan, cognitive, requestedTier);
      } catch (error) {
        if (error instanceof IvccPlanLimitError) {
          return this.deny(tx, traceId, actor, error.code, subjectHash, { tier: requestedTier });
        }
        throw error;
      }

      const evidenceHash = sha256Hex(
        canonicalJson({
          version: IVCC_VERSION,
          traceId,
          profileId: profile.id,
          identityDigest: profile.identityDigest,
          tier: requestedTier,
          textDigest: sha256Hex(normalizedText),
          consentIds: [...consent.consentIds].sort(),
          emotion: cognitive.emotion,
          units: speechPlan.units.length,
          estimatedDurationMs: speechPlan.estimatedDurationMs,
        })
      );
      const audit = tx.audit('voice.planned', subjectHash, actor, {
        profileId: profile.id,
        tier: requestedTier,
        consentIds: consent.consentIds,
        scopes: requiredScopes,
        textDigest: sha256Hex(normalizedText),
        textChars: normalizedText.length,
        language: semantic.language,
        intent: semantic.intent,
        units: speechPlan.units.length,
        estimatedDurationMs: speechPlan.estimatedDurationMs,
        memoryApplied,
        evidenceHash,
      });

      return {
        status: 'planned',
        traceId,
        createdAt: tx.nowIso,
        normalizedText,
        identity: {
          profileId: profile.id,
          label: profile.label,
          synthetic: profile.synthetic,
          tier: requestedTier,
          voice: profile.voiceHint ?? CANONICAL_VOICE_ID,
          cloning: false,
          identityDigest: profile.identityDigest,
        },
        consent: {
          consentIds: consent.consentIds,
          scopes: requiredScopes,
          expiresAt: consent.expiresAt,
        },
        semantic,
        cognitive,
        plan: speechPlan,
        prosody,
        breathing,
        emphasis,
        memory: {
          applied: memoryApplied,
          entries: usesMemory ? (memoryRecord?.entries.length ?? 0) : 0,
        },
        evidenceHash,
        auditSeq: audit.seq,
        authorizationPerformed: false,
        executionPerformed: false,
      };
    });
  }

  private async auditPlanOnly(
    profile: IvccVoiceProfile,
    actor: string,
    detail: Readonly<Record<string, unknown>>
  ): Promise<number> {
    return this.consent.transaction(
      (tx) => tx.audit('voice.plan_only', profile.subjectHash, actor, detail).seq
    );
  }

  private planOnlyResult(
    planned: IvccPlanResult,
    backend: string,
    attempted: readonly string[],
    latencyMs: number,
    tts: IvccSynthesisResult['tts'],
    synthesisAuditSeq: number,
    reason: string
  ): IvccSynthesisResult {
    return {
      ...planned,
      audioStatus: 'client-plan',
      backend,
      attempted,
      latencyMs,
      audio: null,
      mastering: {
        status: 'skipped',
        reason,
        measuredLufs: null,
        note: 'No se produjo audio de backend; se devuelve el plan completo para que el cliente lo reproduzca.',
      },
      watermark: {
        status: 'unavailable',
        reason,
        note: 'Sin audio no hay watermark que estampar; la procedencia se conserva en esta respuesta firmada por evidencia.',
      },
      tts,
      synthesisAuditSeq,
    };
  }

  async synthesize(
    request: IvccPlanRequest,
    actor: string,
    access: PlanAccess = { allowWithoutUsageToken: false },
    timeoutMs = 30_000
  ): Promise<IvccSynthesisOutcome> {
    const started = Date.now();
    const planned = await this.plan(request, actor, access);
    if (planned.status === 'denied') return planned;
    const profile = await this.consent.transaction((tx) => {
      const current = tx.state.profiles.find((item) => item.id === planned.identity.profileId);
      return current ? { ...current } : null;
    });
    if (!profile) {
      const traceId = planned.traceId;
      const seq = await this.consent.transaction(
        (tx) =>
          tx.audit('voice.denied', null, actor, {
            reason: 'IVCC_PROFILE_REVOKED',
            profileId: planned.identity.profileId,
          }).seq
      );
      return {
        status: 'denied',
        traceId,
        reason: 'IVCC_PROFILE_REVOKED',
        auditSeq: seq,
        authorizationPerformed: false,
        executionPerformed: false,
      };
    }
    if (!this.tts) {
      const seq = await this.auditPlanOnly(profile, actor, {
        profileId: profile.id,
        reason: 'IVCC_TTS_BACKEND_NOT_WIRED',
        units: planned.plan.units.length,
      });
      return this.planOnlyResult(
        planned,
        'none',
        [],
        Date.now() - started,
        {
          traceId: planned.traceId,
          evidenceHash: planned.evidenceHash,
          ttsStatus: 'NOT_WIRED',
          reason: 'IVCC_TTS_BACKEND_NOT_WIRED',
        },
        seq,
        'IVCC_TTS_BACKEND_NOT_WIRED'
      );
    }

    const mode: VoiceMode =
      request.mode && VOICE_MODES.includes(request.mode) ? request.mode : 'CONVERSACION';
    const region: MxRegion =
      request.region && MX_REGIONS.includes(request.region) ? request.region : profile.region;
    const voice = profile.voiceHint ?? CANONICAL_VOICE_ID;
    const chunks = chunkTextForTts(planned.normalizedText);
    const attempted = new Set<string>();
    const audios: Array<{ backend: string; mimeType: string; dataUrl: string; bytes: number }> = [];
    const ttsTraceIds: string[] = [];
    let evidenceHash = planned.evidenceHash;
    let ttsStatus: string = 'audio';
    let ttsReason: string | undefined;
    let backend = 'unknown';
    let firstTtsTrace = planned.traceId;

    for (let index = 0; index < chunks.length; index += 1) {
      const nonce = request.nonce ? `${request.nonce.slice(0, 110)}-${index}` : undefined;
      const result = await this.tts.synthesize(
        {
          text: chunks[index]!,
          actorId: `ivcc:${profile.id}`,
          ...(nonce ? { nonce } : {}),
          mode,
          region,
          emotionVector: planned.cognitive.emotion,
          ...(voice ? { voice } : {}),
        },
        timeoutMs
      );
      if (result.status === 'denied') {
        if (result.reason === 'NONCE_REPLAY_DETECTED') {
          const seq = await this.consent.transaction(
            (tx) =>
              tx.audit('voice.denied', profile.subjectHash, actor, {
                reason: 'IVCC_TTS_NONCE_REPLAY',
                profileId: profile.id,
              }).seq
          );
          return {
            status: 'denied',
            traceId: planned.traceId,
            reason: 'IVCC_TTS_NONCE_REPLAY',
            auditSeq: seq,
            authorizationPerformed: false,
            executionPerformed: false,
          };
        }
        ttsStatus = result.status;
        ttsReason = result.reason;
        ttsTraceIds.push(result.traceId);
        break;
      }
      ttsTraceIds.push(result.traceId);
      if (index === 0) firstTtsTrace = result.traceId;
      if (result.status === 'client-plan' || !result.audio) {
        ttsStatus = 'client-plan';
        ttsReason = 'AUDIO_BACKEND_UNAVAILABLE';
        break;
      }
      attempted.add(result.backend);
      backend =
        backend === 'unknown' ? result.backend : backend === result.backend ? backend : 'mixed';
      audios.push({
        backend: result.backend,
        mimeType: result.audio.mimeType,
        dataUrl: result.audio.dataUrl,
        bytes: result.audio.bytes,
      });
      evidenceHash = result.evidenceHash || evidenceHash;
    }

    if (audios.length !== chunks.length) {
      const seq = await this.auditPlanOnly(profile, actor, {
        profileId: profile.id,
        reason: ttsReason ?? 'IVCC_AUDIO_UNAVAILABLE',
        ttsStatus,
        chunks: chunks.length,
        audioChunks: audios.length,
      });
      return this.planOnlyResult(
        planned,
        backend === 'unknown' ? 'none' : backend,
        [...attempted],
        Date.now() - started,
        {
          traceId: firstTtsTrace,
          evidenceHash,
          ttsStatus,
          ...(ttsReason ? { reason: ttsReason } : {}),
          calls: ttsTraceIds.length,
        },
        seq,
        ttsReason ?? 'IVCC_AUDIO_UNAVAILABLE'
      );
    }

    let finalBytes: Uint8Array | null = null;
    let finalMime = audios[0]!.mimeType;
    let containerFailure: string | null = null;
    if (audios.length > 1) {
      const parts: Uint8Array[] = [];
      for (const audio of audios) {
        const decoded = decodeDataUrl(audio.dataUrl);
        if (!decoded) {
          parts.length = 0;
          break;
        }
        parts.push(decoded.bytes);
      }
      const combined = parts.length === audios.length ? combineWavs(parts) : null;
      if (combined) {
        finalBytes = combined;
        finalMime = 'audio/wav';
      } else {
        containerFailure = 'IVCC_MULTICHUNK_CONTAINER_UNSUPPORTED';
      }
    } else {
      const decoded = decodeDataUrl(audios[0]!.dataUrl);
      if (decoded) {
        finalBytes = decoded.bytes;
        finalMime = decoded.mimeType;
      }
    }

    if (!finalBytes || containerFailure) {
      const reason = containerFailure ?? 'IVCC_AUDIO_PAYLOAD_INVALID';
      const seq = await this.auditPlanOnly(profile, actor, {
        profileId: profile.id,
        reason,
        chunks: chunks.length,
      });
      return this.planOnlyResult(
        planned,
        backend,
        [...attempted],
        Date.now() - started,
        { traceId: firstTtsTrace, evidenceHash, ttsStatus, reason, calls: ttsTraceIds.length },
        seq,
        reason
      );
    }

    const decodedWav = decodeWav(finalBytes) !== null;
    const mastering = decodedWav
      ? masterWav(finalBytes)
      : {
          wav: null,
          report: {
            status: 'skipped' as const,
            reason: 'UNSUPPORTED_AUDIO_CONTAINER',
            measuredLufs: null,
            note: 'El backend no devolvió WAV PCM; el audio se entrega sin masterizar y sin afirmar mastering.',
          },
        };
    if (mastering.report.status === 'mastered' && mastering.wav) {
      finalBytes = mastering.wav;
      finalMime = 'audio/wav';
    }

    const consentDigest = sha256Hex(
      canonicalJson({ profileId: profile.id, consentIds: [...planned.consent.consentIds].sort() })
    );
    const watermark = decodedWav
      ? watermarkWav(
          finalBytes,
          {
            traceId: planned.traceId,
            profileId: profile.id,
            consentDigest,
            issuedAt: this.now().toISOString(),
          },
          this.watermarkKey
        )
      : {
          wav: null,
          report: {
            status: 'unavailable' as const,
            reason: 'UNSUPPORTED_AUDIO_CONTAINER',
            note: 'Watermark ISAB/LSB solo se estampa en WAV PCM; el audio se entrega sin afirmar watermark.',
          },
        };
    if (watermark.report.status === 'embedded' && watermark.wav) {
      finalBytes = watermark.wav;
      finalMime = 'audio/wav';
    }

    const requiredScopes: ConsentScope[] = [
      ...PLAN_SCOPES,
      ...(planned.memory.applied > 0 ? (['prosody:memory'] as const) : []),
    ];
    const postDelivery = await this.consent.transaction((tx) => {
      const current = tx.state.profiles.find((item) => item.id === profile.id);
      const consent = current
        ? validateConsentInState(tx.state, current.subjectHash, requiredScopes, tx.now)
        : null;
      if (!consent?.valid) {
        const event = tx.audit('voice.denied', profile.subjectHash, actor, {
          reason: 'IVCC_CONSENT_REVOKED_DURING_SYNTHESIS',
          profileId: profile.id,
          consentReason: consent?.reason ?? 'PROFILE_REMOVED',
        });
        return { allowed: false, seq: event.seq };
      }
      const event = tx.audit('voice.synthesized', profile.subjectHash, actor, {
        profileId: profile.id,
        consentIds: consent.consentIds,
        backend,
        chunks: chunks.length,
        calls: ttsTraceIds.length,
        bytes: finalBytes!.length,
        audioSha256: sha256Hex(finalBytes!),
        mastered: mastering.report.status === 'mastered',
        watermarked: watermark.report.status === 'embedded',
        ttsTraceIds,
      });
      return { allowed: true, seq: event.seq };
    });

    if (!postDelivery.allowed) {
      return {
        status: 'denied',
        traceId: planned.traceId,
        reason: 'IVCC_CONSENT_REVOKED_DURING_SYNTHESIS',
        auditSeq: postDelivery.seq,
        authorizationPerformed: false,
        executionPerformed: false,
      };
    }

    const audioBytes = Buffer.from(finalBytes);
    const audioSha256 = sha256Hex(audioBytes);
    return {
      ...planned,
      audioStatus: 'audio',
      backend,
      attempted: [...attempted],
      latencyMs: Date.now() - started,
      audio: {
        mimeType: finalMime,
        dataUrl: `data:${finalMime};base64,${audioBytes.toString('base64')}`,
        bytes: audioBytes.length,
        sha256: audioSha256,
        mastered: mastering.report.status === 'mastered',
        watermarked: watermark.report.status === 'embedded',
      },
      mastering: mastering.report,
      watermark: watermark.report,
      tts: { traceId: firstTtsTrace, evidenceHash, ttsStatus, calls: ttsTraceIds.length },
      synthesisAuditSeq: postDelivery.seq,
    };
  }

  async createProfile(
    input: IvccCreateProfileInput,
    actor: string
  ): Promise<IvccCreateProfileOutcome> {
    await this.ready;
    const traceId = `ivcc_${randomUUID()}`;
    if (!SUBJECT_REF_RE.test(input.subjectRef)) {
      return {
        status: 'denied',
        traceId,
        reason: 'IVCC_SUBJECT_REF_INVALID',
        auditSeq: null,
        authorizationPerformed: false,
        executionPerformed: false,
      };
    }
    const label =
      typeof input.label === 'string'
        ? input.label
            .trim()
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .slice(0, 60)
        : '';
    if (!label) {
      return {
        status: 'denied',
        traceId,
        reason: 'IVCC_PROFILE_LABEL_REQUIRED',
        auditSeq: null,
        authorizationPerformed: false,
        executionPerformed: false,
      };
    }
    const tier = input.tier === undefined ? 'L' : asTier(input.tier);
    if (!tier) {
      return {
        status: 'denied',
        traceId,
        reason: 'IVCC_TIER_INVALID',
        auditSeq: null,
        authorizationPerformed: false,
        executionPerformed: false,
      };
    }
    const region: MxRegion =
      input.region && MX_REGIONS.includes(input.region) ? input.region : 'cdmx';
    const traits = normalizeTraits(input.traits);
    const subjectHash = this.consent.hashSubject(input.subjectRef);
    const synthetic = input.subjectRef.startsWith('synthetic:');
    const voiceHint = CANONICAL_VOICE_ID;
    const id = `vpr_${sha256Hex(canonicalJson({ subjectHash, tier, traits, voiceHint, region })).slice(0, 16)}`;
    return this.consent.transaction((tx) => {
      const consent = validateConsentInState(
        tx.state,
        subjectHash,
        ['voice_profile:create'],
        tx.now
      );
      if (!consent.valid) {
        return this.deny(tx, traceId, actor, `IVCC_CONSENT_${consent.reason}`, subjectHash, {
          requiredScopes: ['voice_profile:create'],
          missingScopes: consent.missingScopes,
        }) as IvccCreateProfileOutcome;
      }
      const existing = tx.state.profiles.find((profile) => profile.id === id);
      if (existing && !existing.revokedAt) {
        return {
          profile: existing,
          created: false,
          subjectHash,
          auditSeq: null,
        };
      }
      const profile: IvccVoiceProfile = {
        id,
        subjectHash,
        label,
        synthetic,
        tier,
        traits,
        voiceHint,
        region,
        identityDigest: identityDigest({ id, subjectHash, traits, tier, voiceHint, region }),
        createdAt: tx.nowIso,
        revokedAt: null,
        cloning: false,
        version: 1,
      };
      tx.state.profiles = tx.state.profiles.filter((item) => item.id !== id);
      tx.state.profiles.push(profile);
      const audit = tx.audit('voice.created', subjectHash, actor, {
        profileId: id,
        tier,
        synthetic,
        voiceHint,
        region,
        identityDigest: profile.identityDigest,
        consentIds: consent.consentIds,
        cloning: false,
      });
      return { profile, created: true, subjectHash, auditSeq: audit.seq };
    });
  }

  async registerConsent(
    input: IvccRegisterConsentInput,
    actor: string
  ): Promise<RegisterConsentResult> {
    await this.ready;
    return this.consent.register(input, actor);
  }

  async checkConsent(input: {
    subjectRef: string;
    scopes: readonly string[];
    actor: string;
  }): Promise<CheckConsentResult> {
    await this.ready;
    return this.consent.check(input);
  }

  async revoke(input: IvccRevokeInput, actor: string): Promise<RevokeResult> {
    await this.ready;
    return this.consent.revoke(input, actor);
  }

  async readAudit(
    input: { subjectRef?: string; event?: string; limit?: number },
    actor: string
  ): Promise<AuditReadResult> {
    await this.ready;
    return this.consent.readAudit(input, actor);
  }

  async learnMemory(
    input: {
      subjectRef: string;
      written?: string;
      spoken?: string;
      adjustment?: { rateDelta?: unknown; pitchDelta?: unknown; warmthDelta?: unknown };
    },
    actor: string
  ): Promise<IvccMemoryLearnOutcome> {
    await this.ready;
    const traceId = `ivcc_${randomUUID()}`;
    if (!SUBJECT_REF_RE.test(input.subjectRef)) {
      return {
        status: 'denied',
        traceId,
        reason: 'IVCC_SUBJECT_REF_INVALID',
        auditSeq: null,
        authorizationPerformed: false,
        executionPerformed: false,
      };
    }
    const subjectHash = this.consent.hashSubject(input.subjectRef);
    return this.consent.transaction((tx) => {
      const consent = validateConsentInState(tx.state, subjectHash, ['prosody:memory'], tx.now);
      if (!consent.valid) {
        return this.deny(tx, traceId, actor, `IVCC_CONSENT_${consent.reason}`, subjectHash, {
          requiredScopes: ['prosody:memory'],
          missingScopes: consent.missingScopes,
        }) as IvccMemoryLearnOutcome;
      }
      let memory: VoiceMemoryRecord | null = tx.state.memory[subjectHash] ?? null;
      let adjustmentChanged = false;
      if (input.written !== undefined || input.spoken !== undefined) {
        if (input.written === undefined || input.spoken === undefined) {
          return this.deny(
            tx,
            traceId,
            actor,
            'IVCC_MEMORY_ENTRY_REQUIRED',
            subjectHash
          ) as IvccMemoryLearnOutcome;
        }
        memory = addPronunciationEntry(memory, subjectHash, input.written, input.spoken, tx.nowIso);
      }
      if (input.adjustment) {
        memory = setProsodyAdjustment(memory, subjectHash, input.adjustment, tx.nowIso);
        adjustmentChanged = true;
      }
      if (!memory) {
        return this.deny(
          tx,
          traceId,
          actor,
          'IVCC_MEMORY_ENTRY_REQUIRED',
          subjectHash
        ) as IvccMemoryLearnOutcome;
      }
      tx.state.memory[subjectHash] = memory;
      const audit = tx.audit('memory.learned', subjectHash, actor, {
        entries: memory.entries.length,
        adjustmentChanged,
        consentIds: consent.consentIds,
      });
      return {
        entries: memory.entries.length,
        adjustment: Boolean(memory.adjustment),
        auditSeq: audit.seq,
        subjectHash,
      };
    });
  }

  async eraseMemory(
    subjectRef: string,
    actor: string
  ): Promise<{ erasedEntries: number; auditSeq: number; chainValid: boolean }> {
    await this.ready;
    return this.consent.eraseMemory(subjectRef, actor);
  }

  async status(): Promise<Record<string, unknown>> {
    await this.ready;
    const state = await this.consent.snapshot();
    return {
      engine: 'ivcc-cognitive-voice-core',
      version: IVCC_VERSION,
      policy: IVCC_POLICY,
      implemented: [
        'semantic-interpreter-deterministic',
        'latent-style-identity',
        'cognitive-state-12-axes',
        'dynamic-speech-planner',
        'multi-layer-prosody',
        'breathing-planner',
        'emphasis-planner',
        'prosody-pronunciation-memory',
        'granular-consent-manager',
        'usage-token-hashed-at-rest',
        'permanent-revocation',
        'right-to-be-forgotten',
        'hash-chained-audit',
        'wav-mastering-dsp',
        'signed-isab-watermark',
        'lsb-pcm16-tag',
        'tts-backend-bridge',
        'multi-chunk-wav-composition',
      ],
      notImplemented: [
        'neural voice cloning',
        'IVCC-S/M/L/X 4B/12B/32B/70B neural weights',
        'federated voice learning',
        'trained latent emotion model (12 heuristic axes only)',
        'AMoSE/MTAA/BigVGAN vocoder',
        'neural breath synthesis (breath timing only)',
        'certified ITU-R BS.1770 LUFS / true-peak',
      ],
      tiers: IVCC_TIER_FEATURES,
      persistence: {
        kind: this.store.kind,
        durable: this.durable,
        note: this.durable
          ? 'Estado persistido en IVCC_DATA_DIR con escritura atómica.'
          : 'Almacén efímero: los cambios se pierden al reiniciar y producción debe rechazar mutaciones sin IVCC_DATA_DIR.',
      },
      consent: {
        authority:
          'admin-token for registration/revocation; per-consent usage token for personal profiles',
        scopes: [
          'voice_profile:create',
          'voice:synthesize',
          'emotion:infer',
          'prosody:memory',
          'training:federated',
        ],
        enforcement:
          'usage token + active consent checked before planning and again before audio delivery',
        revocation: 'permanent record tombstone; profiles and prosody memory erased',
        rawBiometricsStored: false,
      },
      watermark: {
        implemented: [
          'RIFF ISAB chunk with HMAC-SHA256',
          'PCM16 LSB 64-bit tag',
          'audio SHA-256 binding',
        ],
        limitations: [
          'LSB is fragile under lossy transcoding',
          'non-WAV backends are not watermarked',
        ],
      },
      mastering: {
        implemented: [
          'DC removal',
          '80 Hz high-pass',
          'presence EQ',
          'linked compressor',
          'RMS normalization',
          'limiter without lookahead',
          'PCM16 dither',
        ],
        notImplemented: ['certified LUFS', 'true-peak oversampling'],
      },
      audit: {
        events: state.audit.length,
        chainValid: verifyAuditChain(state.audit),
        containsRawText: false,
      },
      counts: {
        profiles: state.profiles.length,
        consents: state.consents.filter((record) => !record.revokedAt).length,
        memorySubjects: Object.keys(state.memory).length,
      },
      cloning: false,
      impersonationControls: [
        'no raw audio upload or voice cloning endpoint',
        'human profiles require explicit granular consent',
        'per-consent usage token for personal profiles',
        'revocation erases profiles and memory',
        'signed watermark and provenance metadata on WAV audio',
      ],
      authorizationPerformed: false,
      executionPerformed: false,
      designTargetsNotMeasured: true,
    };
  }
}

export interface CreateIvccRuntimeInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly tts?: GenesisTtsEngine | null;
  readonly now?: () => Date;
}

export interface IvccRuntime {
  readonly engine: IvccEngine;
  readonly durable: boolean;
  readonly storeKind: 'file' | 'memory';
  readonly warnings: readonly string[];
  readonly dataDir: string | null;
}

export function createIvccRuntimeFromEnv(input: CreateIvccRuntimeInput): IvccRuntime {
  const env = input.env;
  const dataDir = resolveIvccDataDir(env as NodeJS.ProcessEnv);
  const store: IvccStore = dataDir ? JsonFileIvccStore.at(dataDir) : new MemoryIvccStore();
  const secrets = loadIvccSecrets(env as NodeJS.ProcessEnv, dataDir);
  const warnings: string[] = [];
  if (!dataDir)
    warnings.push('IVCC_DATA_DIR no configurado: consentimiento y auditoría son efímeros.');
  if (secrets.source.subjectSalt === 'ephemeral')
    warnings.push('IVCC_SUBJECT_SALT efímero: los hashes de sujeto cambian al reiniciar.');
  if (secrets.source.watermarkKey === 'ephemeral')
    warnings.push('IVCC_WATERMARK_SECRET efímero: los watermarks no verifican tras reiniciar.');
  return {
    engine: new IvccEngine({
      store,
      subjectSalt: secrets.subjectSalt,
      watermarkKey: secrets.watermarkKey,
      tts: input.tts ?? null,
      ...(input.now ? { now: input.now } : {}),
    }),
    durable: store.durable,
    storeKind: store.kind,
    warnings,
    dataDir,
  };
}
