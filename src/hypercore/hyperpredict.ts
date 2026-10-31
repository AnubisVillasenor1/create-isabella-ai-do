/**
 * HyperPredict Ω — cognitive anticipation subsystem (state: draft).
 *
 * Predict BEFORE executing, prepare BEFORE authorizing, anticipate WITHOUT
 * spending: a prefetch is proposed only when expected value > expected cost,
 * confidence clears the CROWN threshold, policy allows the intent, and the
 * energy/latency budget can absorb it. HyperPredict proposes preparation; CROWN
 * authorizes scope; BookPI keeps the evidence. It never widens permissions and
 * never executes a forbidden action. Confidence and value figures are DECLARED
 * heuristics, not calibrated probabilities.
 */
import { canonicalJson, sha256Hex } from './canonical';
import { EnergyLedger } from './energy';
import type {
  EnergyBudget,
  IntentPrediction,
  PrefetchDecision,
  PrefetchOutcome,
  HyperPredictSession,
  RiskClass,
} from './types';
import { HYPERPREDICT_POLICY_VERSION } from './types';

export interface HyperPredictPolicy {
  readonly version: string;
  readonly mode: 'observe-only' | 'active';
  readonly allowedPrefetch: readonly string[];
  readonly forbiddenPrefetch: readonly string[];
  readonly requiresCrownApproval: readonly string[];
  readonly minimumConfidence: number;
  readonly maxPrefetchTasksPerUser: number;
}

export const DEFAULT_HYPERPREDICT_POLICY: HyperPredictPolicy = {
  version: HYPERPREDICT_POLICY_VERSION,
  mode: 'active',
  allowedPrefetch: ['generate.api', 'analyze.financial', 'territorial.query', 'code.review'],
  forbiddenPrefetch: [
    'payment.execute',
    'ledger.write',
    'identity.revoke',
    'production.deploy',
    'secret.read',
  ],
  requiresCrownApproval: ['payment.proposal', 'state.transition', 'policy.change'],
  minimumConfidence: 0.72,
  maxPrefetchTasksPerUser: 3,
};

export interface PrefetchTaskDefinition {
  readonly intent: string;
  readonly artifacts: readonly string[];
  readonly energyKwh: number;
  readonly latencyMs: number;
  readonly ttlSeconds: number;
  readonly value: number;
  readonly run: (session: HyperPredictSession) => Record<string, unknown>;
}

export const DEFAULT_PREFETCH_CATALOG: readonly PrefetchTaskDefinition[] = Object.freeze([
  {
    intent: 'generate.api',
    artifacts: ['openapi.schema', 'validation.schema', 'test.plan', 'docker.template'],
    energyKwh: 0.00004,
    latencyMs: 80,
    ttlSeconds: 900,
    value: 0.9,
    run: () => ({ openapi: 'draft-ready', validation: 'draft-ready', tests: 'planned' }),
  },
  {
    intent: 'analyze.financial',
    artifacts: ['budget.query', 'ledger.schema', 'impact.report'],
    energyKwh: 0.00003,
    latencyMs: 60,
    ttlSeconds: 900,
    value: 0.86,
    run: () => ({ budget: 'available', ledger: 'read-only', impact: 'draft' }),
  },
  {
    intent: 'territorial.query',
    artifacts: ['rag.index', 'territory.filter', 'document.cache'],
    energyKwh: 0.00002,
    latencyMs: 45,
    ttlSeconds: 900,
    value: 0.78,
    run: () => ({ rag: 'indexed', filter: 'ready' }),
  },
  {
    intent: 'code.review',
    artifacts: ['diff.read', 'dependency.graph', 'static.analysis', 'review.checklist'],
    energyKwh: 0.00003,
    latencyMs: 70,
    ttlSeconds: 900,
    value: 0.82,
    run: () => ({ diff: 'loaded', dependencies: 'resolved', analysis: 'draft' }),
  },
]);

export interface HyperPredictAuditEvent {
  readonly type: string;
  readonly subject: string;
  readonly risk: RiskClass;
  readonly intent: string;
  readonly decision: PrefetchDecision;
  readonly confidence: number;
  readonly expectedValue: number;
  readonly expectedCost: number;
  readonly policyVersion: string;
}

export type HyperPredictAuditSink = (event: HyperPredictAuditEvent) => void;

export interface HyperPredictStats {
  readonly observations: number;
  readonly denied: number;
  readonly deferred: number;
  readonly prefetchDecisions: number;
  readonly prepared: number;
  readonly cacheHits: number;
}

export interface HyperPredictEngine {
  predict(session: HyperPredictSession): readonly IntentPrediction[];
  prepare(session: HyperPredictSession, prediction: IntentPrediction): PrefetchOutcome;
  budgetUsed(): number;
  stats(): HyperPredictStats;
  catalog(): readonly PrefetchTaskDefinition[];
}

export interface HyperPredictOptions {
  readonly policy?: HyperPredictPolicy;
  readonly budget?: EnergyBudget;
  readonly catalog?: readonly PrefetchTaskDefinition[];
  readonly audit?: HyperPredictAuditSink;
  readonly now?: () => number;
}

const INTENT_WEIGHTS: Record<string, readonly number[]> = {
  'generate.api': [1.8, 0.4, 1.5, 0.8, 2.2, 0.0, 0.6, 0.2],
  'analyze.financial': [1.2, 0.3, 0.0, 0.6, 0.0, 2.4, 0.3, 0.8],
  'territorial.query': [0.8, 0.2, 0.0, 0.0, 0.0, 0.0, 0.2, 1.8],
  'code.review': [1.0, 0.3, 1.2, 0.5, 0.4, 0.0, 1.6, 0.1],
};

export function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

export function sessionFeatures(session: HyperPredictSession): readonly number[] {
  const recentLast = session.recentIntents.at(-1);
  return [
    session.role === 'architect' || session.role === 'guardian' ? 1 : 0,
    session.deviceTrusted ? 1 : 0,
    session.openArtifacts.includes('api.py') ? 1 : 0,
    session.openArtifacts.includes('schema.sql') ? 1 : 0,
    session.currentIntent === 'generate.api' ? 1 : 0,
    session.currentIntent === 'analyze.financial' ? 1 : 0,
    recentLast === 'code.review' ? 1 : 0,
    session.territory === 'real-del-monte' ? 1 : 0,
  ];
}

export function scoreIntent(intent: string, session: HyperPredictSession): number {
  const features = sessionFeatures(session);
  const weights = INTENT_WEIGHTS[intent] ?? features.map(() => 0);
  return weights.reduce((acc, weight, index) => acc + weight * (features[index] ?? 0), 0);
}

export function valueScore(
  _intent: string,
  session: HyperPredictSession,
  baseValue: number
): number {
  let value = baseValue;
  if (session.role === 'architect' || session.role === 'guardian') value += 0.05;
  if (session.deviceTrusted) value += 0.03;
  if (session.risk === 'high' || session.risk === 'critical') value -= 0.15;
  return Math.max(0, Math.min(1, value));
}

function expectedCost(task: PrefetchTaskDefinition): number {
  return task.energyKwh * 10000 + task.latencyMs / 1000 + 0.05;
}

export function createHyperPredict(options: HyperPredictOptions = {}): HyperPredictEngine {
  const policy = options.policy ?? DEFAULT_HYPERPREDICT_POLICY;
  const budget: EnergyBudget = options.budget ?? {
    maxWatts: 35,
    maxLatencyMs: 120,
    maxEnergyKwh: 0.00005,
    carbonBudgetDailyKwh: 12,
  };
  const catalog = options.catalog ?? DEFAULT_PREFETCH_CATALOG;
  const audit = options.audit ?? (() => undefined);
  const now = options.now ?? (() => Date.now());
  const ledger = new EnergyLedger(budget);
  const cache = new Map<string, { artifacts: readonly string[]; expiresAt: number }>();
  const counters = {
    observations: 0,
    denied: 0,
    deferred: 0,
    prefetchDecisions: 0,
    prepared: 0,
    cacheHits: 0,
  };
  let preparedThisSession = 0;

  function decide(
    _session: HyperPredictSession,
    task: PrefetchTaskDefinition,
    confidence: number,
    value: number,
    cost: number
  ): { decision: PrefetchDecision; reason: string } {
    if (policy.forbiddenPrefetch.includes(task.intent))
      return { decision: 'DENY', reason: 'PREFETCH_FORBIDDEN_BY_CROWN' };
    if (!policy.allowedPrefetch.includes(task.intent))
      return { decision: 'DENY', reason: 'INTENT_NOT_REGISTERED' };
    if (confidence < policy.minimumConfidence)
      return { decision: 'DENY', reason: 'CONFIDENCE_BELOW_THRESHOLD' };
    if (policy.mode === 'observe-only') return { decision: 'OBSERVE', reason: 'OBSERVE_ONLY_MODE' };
    if (value <= cost) return { decision: 'OBSERVE', reason: 'VALUE_NOT_ABOVE_COST' };
    if (!ledger.canSpend(task.energyKwh))
      return { decision: 'DEFER', reason: 'ENERGY_BUDGET_EXCEEDED' };
    if (task.latencyMs > budget.maxLatencyMs)
      return { decision: 'DEFER', reason: 'LATENCY_BUDGET_EXCEEDED' };
    if (preparedThisSession >= policy.maxPrefetchTasksPerUser)
      return { decision: 'DEFER', reason: 'PREFETCH_TASK_LIMIT' };
    return { decision: 'PREFETCH', reason: 'VALUE_ABOVE_COST' };
  }

  function predict(session: HyperPredictSession): readonly IntentPrediction[] {
    const predictions: IntentPrediction[] = [];
    for (const task of catalog) {
      const confidence = sigmoid(scoreIntent(task.intent, session));
      const value = valueScore(task.intent, session, task.value);
      const cost = expectedCost(task);
      const { decision, reason } = decide(session, task, confidence, value, cost);
      const decisionHash = sha256Hex(
        canonicalJson({ subject: session.subject, intent: task.intent, confidence, decision })
      );
      if (decision === 'OBSERVE') counters.observations += 1;
      else if (decision === 'DENY') counters.denied += 1;
      else if (decision === 'DEFER') counters.deferred += 1;
      else counters.prefetchDecisions += 1;
      audit({
        type: 'hyperpredict.intent.predicted',
        subject: session.subject,
        risk: session.risk,
        intent: task.intent,
        decision,
        confidence,
        expectedValue: value,
        expectedCost: cost,
        policyVersion: policy.version,
      });
      predictions.push({
        intent: task.intent,
        confidence,
        expectedValue: value,
        expectedCost: cost,
        energyKwh: task.energyKwh,
        latencyMs: task.latencyMs,
        artifacts: task.artifacts,
        decision,
        reason,
        decisionHash,
      });
    }
    return Object.freeze([...predictions].sort((a, b) => b.confidence - a.confidence));
  }

  function prepare(session: HyperPredictSession, prediction: IntentPrediction): PrefetchOutcome {
    if (prediction.decision !== 'PREFETCH') {
      audit({
        type: 'hyperpredict.prefetch.rejected',
        subject: session.subject,
        risk: session.risk,
        intent: prediction.intent,
        decision: prediction.decision,
        confidence: prediction.confidence,
        expectedValue: prediction.expectedValue,
        expectedCost: prediction.expectedCost,
        policyVersion: policy.version,
      });
      return Object.freeze({
        status: 'not-prepared',
        intent: prediction.intent,
        cacheKey: '',
        artifacts: Object.freeze([]),
        energyKwh: 0,
        expiresAt: null,
        reason: prediction.reason,
      });
    }
    const task = catalog.find((item) => item.intent === prediction.intent);
    if (!task) {
      return Object.freeze({
        status: 'not-prepared',
        intent: prediction.intent,
        cacheKey: '',
        artifacts: Object.freeze([]),
        energyKwh: 0,
        expiresAt: null,
        reason: 'TASK_NOT_FOUND',
      });
    }
    if (preparedThisSession >= policy.maxPrefetchTasksPerUser || !ledger.canSpend(task.energyKwh)) {
      audit({
        type: 'hyperpredict.energy.exceeded',
        subject: session.subject,
        risk: session.risk,
        intent: task.intent,
        decision: 'DEFER',
        confidence: prediction.confidence,
        expectedValue: prediction.expectedValue,
        expectedCost: prediction.expectedCost,
        policyVersion: policy.version,
      });
      return Object.freeze({
        status: 'deferred',
        intent: task.intent,
        cacheKey: '',
        artifacts: Object.freeze([]),
        energyKwh: 0,
        expiresAt: null,
        reason: 'ENERGY_BUDGET_EXCEEDED',
      });
    }

    const cacheKey = sha256Hex(
      canonicalJson({
        subject: session.subject,
        intent: task.intent,
        territory: session.territory,
        artifacts: task.artifacts,
      })
    );
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now()) {
      counters.cacheHits += 1;
      audit({
        type: 'hyperpredict.cache.hit',
        subject: session.subject,
        risk: session.risk,
        intent: task.intent,
        decision: 'PREFETCH',
        confidence: prediction.confidence,
        expectedValue: prediction.expectedValue,
        expectedCost: prediction.expectedCost,
        policyVersion: policy.version,
      });
      return Object.freeze({
        status: 'cache-hit',
        intent: task.intent,
        cacheKey,
        artifacts: cached.artifacts,
        energyKwh: 0,
        expiresAt: cached.expiresAt,
        reason: 'CACHE_HIT',
      });
    }

    const artifacts = Object.freeze(task.artifacts);
    const result: Record<string, unknown> = task.run(session);
    void result;
    ledger.spend(task.energyKwh);
    const expiresAt = now() + task.ttlSeconds * 1000;
    cache.set(cacheKey, { artifacts, expiresAt });
    preparedThisSession += 1;
    counters.prepared += 1;
    audit({
      type: 'hyperpredict.prefetch.completed',
      subject: session.subject,
      risk: session.risk,
      intent: task.intent,
      decision: 'PREFETCH',
      confidence: prediction.confidence,
      expectedValue: prediction.expectedValue,
      expectedCost: prediction.expectedCost,
      policyVersion: policy.version,
    });
    return Object.freeze({
      status: 'prepared',
      intent: task.intent,
      cacheKey,
      artifacts,
      energyKwh: task.energyKwh,
      expiresAt,
      reason: 'PREPARED',
    });
  }

  return {
    predict,
    prepare,
    budgetUsed: () => ledger.usedEnergyKwh(),
    stats: () => Object.freeze({ ...counters }),
    catalog: () => catalog,
  };
}
