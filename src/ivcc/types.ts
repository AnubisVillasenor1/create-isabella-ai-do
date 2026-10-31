/**
 * state: engine-generated
 * Shared types for the Isabella Vocal Cognitive Core (IVCC). The runtime behind
 * these types is deterministic and rule-based; no neural voice cloning is
 * implemented or implied. Speaking never authorizes nor executes anything.
 */
import type { EmotionAxis, EmotionVector, MxRegion, VoiceMode } from '../tts/types';

export const IVCC_VERSION = '1.0.0';
export const IVCC_POLICY = 'IVCC-ECP-1';

export const IVCC_TIERS = ['S', 'M', 'L', 'X'] as const;
export type IvccTier = (typeof IVCC_TIERS)[number];

/** S=core prosody, M=+emphasis, L=+breathing, X=+long-form memory. */
export const IVCC_TIER_FEATURES: Readonly<
  Record<
    IvccTier,
    {
      readonly maxChars: number;
      readonly maxUnits: number;
      readonly emphasis: boolean;
      readonly breathing: boolean;
      readonly longForm: boolean;
    }
  >
> = {
  S: { maxChars: 2_000, maxUnits: 60, emphasis: false, breathing: false, longForm: false },
  M: { maxChars: 4_000, maxUnits: 120, emphasis: true, breathing: false, longForm: false },
  L: { maxChars: 4_000, maxUnits: 160, emphasis: true, breathing: true, longForm: false },
  X: { maxChars: 4_000, maxUnits: 200, emphasis: true, breathing: true, longForm: true },
};

export const CONSENT_SCOPES = [
  'voice_profile:create',
  'voice:synthesize',
  'emotion:infer',
  'prosody:memory',
  'training:federated',
] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const CONSENT_METHODS = ['written-record', 'recorded-oral', 'digital-signature'] as const;
export type HumanConsentMethod = (typeof CONSENT_METHODS)[number];
export type ConsentMethod = HumanConsentMethod | 'operator-policy';

export type SpeechIntent =
  'INFORM' | 'REQUEST' | 'QUESTION' | 'WARN' | 'APOLOGIZE' | 'CELEBRATE' | 'CONVERSATIONAL';

export interface SemanticClause {
  readonly index: number;
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly terminal: string;
  readonly intent: SpeechIntent;
  readonly sentiment: number;
  readonly emphasis: readonly string[];
}

export interface EmphasisTarget {
  readonly text: string;
  readonly clauseIndex: number;
  readonly strength: number;
  readonly reasons: readonly string[];
}

export interface SemanticInterpretation {
  readonly intent: SpeechIntent;
  readonly language: 'es' | 'en' | 'mixed';
  readonly sentiment: number;
  readonly urgency: number;
  readonly certainty: number;
  readonly confidence: number;
  readonly topics: readonly string[];
  readonly entities: readonly string[];
  readonly clauses: readonly SemanticClause[];
  readonly emphasis: readonly EmphasisTarget[];
  readonly tokens: number;
}

export type EmphasisPolicy = 'restrained' | 'balanced' | 'expressive';

export interface CognitiveState {
  readonly emotion: EmotionVector;
  readonly attention: number;
  readonly cognitiveLoad: number;
  readonly certainty: number;
  readonly dominance: number;
  readonly tempo: number;
  readonly emphasisPolicy: EmphasisPolicy;
  readonly rationale: readonly string[];
}

export interface VoiceTraits {
  readonly rate: number;
  readonly pitch: number;
  readonly warmth: number;
  readonly energy: number;
  readonly formality: number;
  readonly pauseStyle: 'compact' | 'measured' | 'dramatic';
}

export const DEFAULT_TRAITS: VoiceTraits = {
  rate: 0.58,
  pitch: 0.52,
  warmth: 0.72,
  energy: 0.55,
  formality: 0.62,
  pauseStyle: 'measured',
};

export interface IvccVoiceProfile {
  readonly id: string;
  readonly subjectHash: string;
  readonly label: string;
  readonly synthetic: boolean;
  readonly tier: IvccTier;
  readonly traits: VoiceTraits;
  readonly voiceHint: string | null;
  readonly region: MxRegion;
  readonly identityDigest: string;
  readonly createdAt: string;
  readonly revokedAt: string | null;
  readonly cloning: false;
  readonly version: 1;
}

export type SpeechUnitRole = 'opening' | 'core' | 'warning' | 'closing';

export interface SpeechUnit {
  readonly id: string;
  readonly index: number;
  readonly text: string;
  readonly role: SpeechUnitRole;
  readonly terminal: string;
  readonly emphasis: readonly string[];
  readonly pauseAfterMs: number;
  readonly breathBefore: boolean;
  readonly estimatedDurationMs: number;
}

export interface IvccSpeechPlan {
  readonly units: readonly SpeechUnit[];
  readonly totalChars: number;
  readonly estimatedDurationMs: number;
  readonly tier: IvccTier;
  readonly maxUnits: number;
}

export interface PauseSpec {
  readonly atMs: number;
  readonly durationMs: number;
  readonly kind: 'micro' | 'phrase' | 'breath' | 'dramatic';
}

export interface PitchPoint {
  readonly at: number;
  readonly pitchSemitones: number;
}

export interface EmphasisSpan {
  readonly text: string;
  readonly strength: number;
  readonly reason: string;
}

export interface UnitProsody {
  readonly unitId: string;
  readonly rate: number;
  readonly pitchSemitones: number;
  readonly volume: number;
  readonly range: number;
  readonly contour: readonly PitchPoint[];
  readonly pauses: readonly PauseSpec[];
  readonly emphasis: readonly EmphasisSpan[];
}

export interface IvccProsodyPlan {
  readonly units: readonly UnitProsody[];
  readonly estimatedDurationMs: number;
  readonly averageRate: number;
}

export interface BreathEvent {
  readonly unitId: string;
  readonly atMs: number;
  readonly inhaleMs: number;
  readonly holdMs: number;
  readonly intensity: number;
  readonly audible: boolean;
}

export interface BreathPlan {
  readonly events: readonly BreathEvent[];
  readonly totalBreaths: number;
  readonly totalInhaleMs: number;
  readonly modeled: false;
  readonly note: string;
}

export interface EmphasisPlan {
  readonly spans: readonly EmphasisSpan[];
  readonly density: number;
  readonly policy: EmphasisPolicy;
}

export interface ConsentRecord {
  readonly consentId: string;
  readonly subjectHash: string;
  readonly scopes: readonly ConsentScope[];
  readonly grantedAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly method: ConsentMethod;
  readonly evidenceHash: string;
  readonly policy: typeof IVCC_POLICY;
  readonly synthetic: boolean;
  readonly version: 1;
}

export interface UsageTokenRecord {
  readonly tokenHash: string;
  readonly consentId: string;
  readonly subjectHash: string;
  readonly createdAt: string;
  readonly revokedAt: string | null;
}

export interface PronunciationEntry {
  readonly written: string;
  readonly spoken: string;
  readonly createdAt: string;
}

export interface ProsodyAdjustment {
  readonly rateDelta: number;
  readonly pitchDelta: number;
  readonly warmthDelta: number;
  readonly updatedAt: string;
}

export interface VoiceMemoryRecord {
  readonly subjectHash: string;
  readonly entries: readonly PronunciationEntry[];
  readonly adjustment: ProsodyAdjustment | null;
  readonly updatedAt: string;
}

export type AuditEventType =
  | 'system.baseline'
  | 'consent.registered'
  | 'consent.checked'
  | 'consent.revoked'
  | 'voice.created'
  | 'voice.planned'
  | 'voice.denied'
  | 'voice.synthesized'
  | 'voice.plan_only'
  | 'memory.learned'
  | 'memory.erased'
  | 'audit.read';

export interface AuditEvent {
  readonly seq: number;
  readonly at: string;
  readonly event: AuditEventType;
  readonly subjectHash: string | null;
  readonly actor: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly prevHash: string;
  readonly hash: string;
}

export interface IvccState {
  version: 1;
  consents: ConsentRecord[];
  usageTokens: UsageTokenRecord[];
  profiles: IvccVoiceProfile[];
  memory: Record<string, VoiceMemoryRecord>;
  audit: AuditEvent[];
}

export interface ConsentValidation {
  readonly valid: boolean;
  readonly reason:
    'VALID' | 'NO_CONSENT' | 'REVOKED' | 'EXPIRED' | 'SCOPE_NOT_GRANTED' | 'USAGE_TOKEN_INVALID';
  readonly subjectHash: string;
  readonly consentIds: readonly string[];
  readonly coveredScopes: readonly ConsentScope[];
  readonly missingScopes: readonly ConsentScope[];
  readonly expiresAt: string | null;
}

export interface IvccPlanRequest {
  readonly text: string;
  readonly profileId?: string;
  readonly subjectRef?: string;
  readonly tier?: IvccTier;
  readonly mode?: VoiceMode;
  readonly region?: MxRegion;
  readonly emotion?: Partial<Record<string, number>>;
  readonly nonce?: string;
  readonly memory?: boolean;
  readonly consentToken?: string;
}

export interface IvccIdentityView {
  readonly profileId: string;
  readonly label: string;
  readonly synthetic: boolean;
  readonly tier: IvccTier;
  readonly voice: string | null;
  readonly cloning: false;
  readonly identityDigest: string;
}

export interface IvccPlanResult {
  readonly status: 'planned';
  readonly traceId: string;
  readonly createdAt: string;
  readonly normalizedText: string;
  readonly identity: IvccIdentityView;
  readonly consent: {
    readonly consentIds: readonly string[];
    readonly scopes: readonly ConsentScope[];
    readonly expiresAt: string | null;
  };
  readonly semantic: SemanticInterpretation;
  readonly cognitive: CognitiveState;
  readonly plan: IvccSpeechPlan;
  readonly prosody: IvccProsodyPlan;
  readonly breathing: BreathPlan;
  readonly emphasis: EmphasisPlan;
  readonly memory: { readonly applied: number; readonly entries: number };
  readonly evidenceHash: string;
  readonly auditSeq: number;
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
}

export interface IvccDenied {
  readonly status: 'denied';
  readonly traceId: string;
  readonly reason: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly auditSeq: number | null;
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
}

export type IvccPlanOutcome = IvccPlanResult | IvccDenied;

export interface MasteringReport {
  readonly status: 'mastered' | 'skipped';
  readonly reason?: string;
  readonly format?: 'pcm16-wav';
  readonly sampleRate?: number;
  readonly channels?: number;
  readonly frames?: number;
  readonly durationMs?: number;
  readonly peakDbfs?: number;
  readonly rmsDbfs?: number;
  readonly gainDb?: number;
  readonly limitedSamples?: number;
  readonly measuredLufs?: null;
  readonly note: string;
}

export interface WatermarkReport {
  readonly status: 'embedded' | 'unavailable';
  readonly reason?: string;
  readonly chunkId?: 'ISAB';
  readonly lsbTag?: string;
  readonly signatureVerified?: boolean;
  readonly note: string;
}

export interface IvccAudioResult {
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly mastered: boolean;
  readonly watermarked: boolean;
}

export interface IvccSynthesisResult extends IvccPlanResult {
  readonly audioStatus: 'audio' | 'client-plan';
  readonly backend: string;
  readonly attempted: readonly string[];
  readonly latencyMs: number;
  readonly audio: IvccAudioResult | null;
  readonly mastering: MasteringReport;
  readonly watermark: WatermarkReport;
  readonly tts: {
    readonly traceId: string;
    readonly evidenceHash: string;
    readonly ttsStatus: string;
    readonly reason?: string;
    readonly calls?: number;
  };
  readonly synthesisAuditSeq: number | null;
}

export type IvccSynthesisOutcome = IvccSynthesisResult | IvccDenied;

export interface IvccProfileResult {
  readonly profile: IvccVoiceProfile;
  readonly created: boolean;
  readonly subjectHash: string;
  readonly auditSeq: number | null;
}

export interface IvccMemoryLearnResult {
  readonly entries: number;
  readonly adjustment: boolean;
  readonly auditSeq: number;
  readonly subjectHash: string;
}

export type IvccCreateProfileOutcome = IvccProfileResult | IvccDenied;
export type IvccMemoryLearnOutcome = IvccMemoryLearnResult | IvccDenied;

export interface IvccCreateProfileInput {
  readonly subjectRef: string;
  readonly label: string;
  readonly tier?: IvccTier;
  readonly traits?: Partial<VoiceTraits>;
  readonly region?: MxRegion;
}

export interface IvccRegisterConsentInput {
  readonly subjectRef: string;
  readonly scopes: readonly string[];
  readonly method: string;
  readonly evidenceRef: string;
  readonly attestation: boolean;
  readonly expiresAt?: string | null;
}

export interface IvccRevokeInput {
  readonly subjectRef?: string;
  readonly consentId?: string;
}

export type { EmotionAxis, EmotionVector, MxRegion, VoiceMode };
