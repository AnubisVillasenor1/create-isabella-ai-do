/**
 * Isabella HyperCore Ω² — Cognitive HyperAcceleration Runtime.
 *
 * state: draft | engine-generated. HyperCore PREDICTS, COMPRESSES, ROUTES,
 * SPECULATES, VERIFIES and AUDITS. It never executes a governed side effect,
 * never authorizes (CROWN only authorizes) and never delivers a speculative
 * draft without verification. All energy/confidence figures are DECLARED
 * estimates or heuristics, not measured accuracy.
 *
 * Invariant (fail-closed): cache never grants authorization; speculation never
 * finalizes without verification; parallelism never bypasses policy; timeout,
 * malformed output, verifier failure and missing audit all DENY.
 *
 * Fidelity contract: SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠
 * VERIFIED ≠ DEPLOYED ≠ CERTIFIED.
 */

export const HYPERCORE_MODULE = "HYPERCORE" as const;
export const HYPERCORE_ID = "ISABELLA-HYPERCORE-OMEGA-2" as const;
export const HYPERCORE_VERSION = "1.0.0" as const;
export const HYPERPREDICT_POLICY_VERSION = "HP-v1" as const;
export const CROWN_POLICY_VERSION = "CROWN-v20" as const;

/** Canonical method id: [TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK].[GOV]. */
export const HYPERCORE_METHOD_IDS = {
  accelerateTask: "TINA.YUN.HYPERCORE.accelerate_task.v1.0.0.HIGH.CONSTITUTIONAL",
  predictIntent: "TINA.YUN.HYPERPREDICT.predict_intent.v1.0.0.MEDIUM.INSTITUTIONAL",
  governMode: "TINA.YUN.HYPERCORE.govern_mode.v1.0.0.MEDIUM.INSTITUTIONAL",
  verifyResponse: "TINA.YUN.HYPERCORE.verify_response.v1.0.0.HIGH.CONSTITUTIONAL",
  cacheLookup: "TINA.YUN.HYPERCORE.cache_lookup.v1.0.0.LOW.OPERATIONAL",
  recordDecision: "TINA.YUN.HYPERCORE.record_decision.v1.0.0.LOW.INSTITUTIONAL",
} as const;

export const HYPERCORE_DISCLAIMER =
  "HyperCore Ω² reduces waste (predict, compress, cache, route, speculate, verify, audit); it does not execute side effects and does not authorize. " +
  "Authorization is CROWN-only. A speculative draft is never final without verification. " +
  "Cache reuse never grants authority. Energy, confidence and speedup figures are declared heuristic estimates, not measured accuracy. " +
  "Modes OMEGA/HYPERBOOST are governance envelopes, not unlimited-consumption grants.";

export type HyperCoreMode = "ECO" | "CRUISE" | "BOOST" | "HYPERBOOST" | "OMEGA";
/** Ω² modes. Named to avoid clashing with the V5 `HYPERCORE_MODES` in core/types. */
export const HYPERCORE_OMEGA_MODES: readonly HyperCoreMode[] = ["ECO", "CRUISE", "BOOST", "HYPERBOOST", "OMEGA"] as const;

export type RiskClass = "low" | "medium" | "high" | "critical";

export interface EnergyBudget {
  readonly maxWatts: number;
  readonly maxLatencyMs: number;
  readonly maxEnergyKwh: number;
  readonly carbonBudgetDailyKwh: number;
}

export const DEFAULT_ENERGY_BUDGET: EnergyBudget = Object.freeze({
  maxWatts: 350,
  maxLatencyMs: 400,
  maxEnergyKwh: 0.001,
  carbonBudgetDailyKwh: 12,
});

export interface EnergyEstimate {
  readonly estimatedLatencyMs: number;
  readonly estimatedEnergyKwh: number;
}

export interface ModeDecision {
  readonly mode: HyperCoreMode;
  readonly reason: string;
}

export interface ModeProfile {
  readonly mode: HyperCoreMode;
  readonly cpuLimitPercent: number;
  readonly speculative: boolean;
  readonly parallelBranches: number;
  readonly cacheBias: "minimum" | "moderate" | "high" | "maximum" | "total";
  readonly governance: "standard" | "elevated" | "maximum";
}

export type RiskClassLike = "low" | "medium" | "high" | "critical";

export interface HyperCoreTask {
  readonly taskId: string;
  readonly intent: string;
  readonly domain: string;
  readonly risk: RiskClass;
  readonly prompt: string;
  readonly contextTokens: number;
  readonly userScope?: string;
  readonly territoryScope?: string;
  readonly budget?: Partial<EnergyBudget>;
  readonly requiresAuthorization?: boolean;
}

export interface CognitiveState {
  readonly intent: string;
  readonly domain: string;
  readonly entities: readonly string[];
  readonly objectives: readonly string[];
  readonly constraints: readonly string[];
  readonly memory: readonly string[];
  readonly risk: RiskClass;
  readonly policyVersion: string;
  readonly originalTokens: number;
  readonly compiledTokens: number;
  readonly compressionRatio: number;
}

export interface HyperCoreExpert {
  readonly id: string;
  readonly domain: string;
  readonly costUnits: number;
  readonly latencyMs: number;
  readonly energyKwh: number;
  run(state: CognitiveState): Record<string, unknown>;
}

export interface ExpertScore {
  readonly expertId: string;
  readonly domain: string;
  readonly affinity: number;
  readonly probability: number;
}

export interface RouterPolicy {
  readonly lambda: number;
  readonly mu: number;
  readonly topK: number;
  readonly minAffinity: number;
}

export const DEFAULT_ROUTER_POLICY: RouterPolicy = {
  lambda: 1,
  mu: 1,
  topK: 2,
  minAffinity: 0.5,
};

export interface ExpertOutput {
  readonly expertId: string;
  readonly domain: string;
  readonly payload: Record<string, unknown>;
  readonly energyKwh: number;
  readonly latencyMs: number;
}

export interface SpeculativeConfig {
  readonly acceptanceRate: number;
  readonly draftTokens: number;
}

export const DEFAULT_SPECULATIVE_CONFIG: SpeculativeConfig = {
  acceptanceRate: 0.78,
  draftTokens: 4,
};

export interface SpeculativeDraft {
  readonly candidate: Record<string, unknown>;
  readonly acceptanceRate: number;
  readonly draftTokens: number;
  readonly estimatedSpeedup: number;
  readonly finalized: false;
}

export type HyperCoreVerifierName = "safety" | "policy" | "security" | "factuality" | "financial" | "provenance";

export interface HyperCoreVerifierCheck {
  readonly name: HyperCoreVerifierName;
  readonly passed: boolean;
  readonly detail?: string;
}

export type VeritasVerdictCode = "ALLOW" | "DENY" | "ESCALATE" | "RETRY_SAFE";

export interface VeritasVerdict {
  readonly verdict: VeritasVerdictCode;
  readonly approvals: number;
  readonly required: number;
  readonly checks: readonly HyperCoreVerifierCheck[];
  readonly failed: readonly string[];
  readonly reason: string;
}

export interface VerifiedResponse {
  readonly answer: string;
  readonly evidence: readonly ExpertOutput[];
  readonly verdict: VeritasVerdict;
  readonly financialExecution: false;
}

export interface HyperCoreCacheEntry {
  readonly key: string;
  readonly normalizedIntent: string;
  readonly response: VerifiedResponse;
  readonly policyVersion: string;
  readonly modelVersion: string;
  readonly dataVersion: string;
  readonly riskClass: RiskClass;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly energyKwh: number;
}

export interface SemanticMatch {
  readonly entry: HyperCoreCacheEntry;
  readonly similarity: number;
}

export type PrefetchDecision = "OBSERVE" | "PREFETCH" | "DEFER" | "DENY";

export interface IntentPrediction {
  readonly intent: string;
  readonly confidence: number;
  readonly expectedValue: number;
  readonly expectedCost: number;
  readonly energyKwh: number;
  readonly latencyMs: number;
  readonly artifacts: readonly string[];
  readonly decision: PrefetchDecision;
  readonly reason: string;
  readonly decisionHash: string;
}

export interface PrefetchOutcome {
  readonly status: "prepared" | "cache-hit" | "deferred" | "not-prepared";
  readonly intent: string;
  readonly cacheKey: string;
  readonly artifacts: readonly string[];
  readonly energyKwh: number;
  readonly expiresAt: number | null;
  readonly reason: string;
}

export interface HyperPredictSession {
  readonly subject: string;
  readonly role: string;
  readonly territory: string;
  readonly currentIntent: string;
  readonly openArtifacts: readonly string[];
  readonly recentIntents: readonly string[];
  readonly deviceTrusted: boolean;
  readonly risk: RiskClass;
}

export type HyperCoreStatus = "CACHE_HIT" | "COMPLETED" | "DENIED" | "ESCALATED";

export interface HyperCoreObservation {
  readonly requestId: string;
  readonly mode: HyperCoreMode;
  readonly cache: "hit" | "miss";
  readonly contextCompression: number;
  readonly activatedExperts: readonly string[];
  readonly speculativeAcceptance: number;
  readonly verifierConsensus: string;
  readonly latencyMs: number;
  readonly energyKwh: number;
  readonly cee: number;
  readonly bookpiTraceId: string | null;
}

export interface HyperCoreResult {
  readonly requestId: string;
  readonly taskId: string;
  readonly status: HyperCoreStatus;
  readonly mode: HyperCoreMode;
  readonly response: VerifiedResponse | null;
  readonly verdict: VeritasVerdict | null;
  readonly prediction: IntentPrediction | null;
  readonly cognitiveState: CognitiveState | null;
  readonly cacheKey: string | null;
  readonly reasons: readonly string[];
  readonly observation: HyperCoreObservation;
  readonly disclaimer: string;
}

export interface CeeComponents {
  readonly taskSuccess: number;
  readonly evidenceQuality: number;
  readonly decisionAccuracy: number;
  readonly userValue: number;
  readonly reuseValue: number;
  readonly riskReduction: number;
}

export interface CeeInput extends CeeComponents {
  readonly energyKwh: number;
}

export interface CeeResult {
  readonly components: CeeComponents;
  readonly weightedValue: number;
  readonly energyKwh: number;
  readonly cee: number;
  readonly weights: readonly number[];
}

export interface AuthorizationRequest {
  readonly taskId: string;
  readonly intent: string;
  readonly risk: RiskClass;
  readonly policyVersion: string;
}

export interface AuthorizationDecision {
  readonly authorized: boolean;
  readonly authority: string;
  readonly reason: string;
}

export type AuthorizationPort = (request: AuthorizationRequest) => AuthorizationDecision;

export interface HyperCoreAuditInput {
  readonly id: string;
  readonly timestamp: string;
  readonly type: string;
  readonly methodId: string;
  readonly principal: string;
  readonly riskTier: string;
  readonly status: string;
}

export interface HyperCoreAuditSeal {
  readonly id: string;
  readonly hash: string;
  readonly sequence: number;
  readonly storage: string;
}

export interface HyperCoreAuditVerification {
  readonly valid: boolean;
  readonly blocksValidated: number;
  readonly storage: string;
  readonly durable: boolean;
  readonly chainHead: string | null;
}

export interface HyperCoreAuditor {
  record(input: HyperCoreAuditInput): HyperCoreAuditSeal;
  verify(): HyperCoreAuditVerification;
}
