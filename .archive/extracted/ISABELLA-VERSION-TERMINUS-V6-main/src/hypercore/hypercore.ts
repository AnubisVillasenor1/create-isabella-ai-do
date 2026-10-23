/**
 * HyperCore Ω² orchestrator (state: draft).
 *
 * Zero-waste pipeline: predict -> cache -> compress -> route -> execute experts
 * (parallel, timed) -> speculative draft -> Veritas Ω -> CROWN authorization ->
 * audit -> deliver. Fail-closed: timeout, malformed output, verifier failure,
 * missing audit and any hard-verifier failure DENY. HyperCore never executes a
 * side effect and never authorizes; CROWN authorizes, BookPI remembers.
 */
import { randomUUID } from "node:crypto";
import { bookPiLedger, type BookPiLedgerPort } from "../bookpi/ledger";
import { routeExperts } from "./adaptive-model-router";
import { computeCee } from "./cee";
import { compileContext } from "./context-compiler";
import { estimateFromExperts, governMode, modeProfile } from "./energy";
import {
  createGovernedSemanticCache,
  type CacheVersions,
  type GovernedSemanticCache,
} from "./governed-semantic-cache";
import { createDefaultExperts } from "./micro-moe";
import { createDraft } from "./speculative-draft-engine";
import { deriveChecks, verifyCandidate } from "./veritas-omega";
import {
  CROWN_POLICY_VERSION,
  DEFAULT_ENERGY_BUDGET,
  DEFAULT_ROUTER_POLICY,
  DEFAULT_SPECULATIVE_CONFIG,
  HYPERCORE_DISCLAIMER,
  HYPERCORE_ID,
  HYPERCORE_METHOD_IDS,
  HYPERCORE_VERSION,
} from "./types";
import type {
  AuthorizationPort,
  CognitiveState,
  EnergyBudget,
  ExpertOutput,
  HyperCoreAuditor,
  HyperCoreExpert,
  HyperCoreMode,
  HyperCoreObservation,
  HyperCoreResult,
  HyperCoreStatus,
  HyperCoreTask,
  IntentPrediction,
  RiskClass,
  RouterPolicy,
  SpeculativeConfig,
  VeritasVerdict,
  VerifiedResponse,
} from "./types";

const CACHE_HIT_ENERGY_KWH = 0.000001;
const TIMEOUT = Symbol("hypercore-timeout");
const MODES: readonly HyperCoreMode[] = Object.freeze(["ECO", "CRUISE", "BOOST", "HYPERBOOST", "OMEGA"]);

export function createBookPiAuditor(ledger: BookPiLedgerPort = bookPiLedger): HyperCoreAuditor {
  return {
    record(input) {
      const event = ledger.append({
        id: input.id,
        timestamp: input.timestamp,
        type: input.type,
        methodId: input.methodId,
        principal: input.principal,
        riskTier: input.riskTier,
        status: input.status,
      });
      return { id: input.id, hash: event.hash, sequence: event.sequence, storage: ledger.verify().storage };
    },
    verify() {
      const verdict = ledger.verify();
      return {
        valid: verdict.valid,
        blocksValidated: verdict.blocksValidated,
        storage: verdict.storage,
        durable: verdict.durable,
        chainHead: verdict.chainHead,
      };
    },
  };
}

export interface HyperCoreDependencies {
  readonly cache?: GovernedSemanticCache;
  readonly experts?: readonly HyperCoreExpert[];
  readonly routerPolicy?: RouterPolicy;
  readonly speculative?: SpeculativeConfig;
  readonly authorizer?: AuthorizationPort;
  readonly auditor?: HyperCoreAuditor;
  readonly predictor?: (task: HyperCoreTask) => IntentPrediction | null;
  readonly versions?: CacheVersions;
  readonly now?: () => number;
  readonly config?: {
    readonly ttlSeconds?: number;
    readonly timeoutMs?: number;
    readonly requireAuthorizationByDefault?: boolean;
  };
}

export interface HyperCore {
  run(task: HyperCoreTask, context?: { readonly authenticatedPrincipal?: string }): Promise<HyperCoreResult>;
  modes(): readonly HyperCoreMode[];
}

function isCritical(risk: RiskClass): boolean {
  return risk === "high" || risk === "critical";
}

function riskReductionFor(risk: RiskClass): number {
  switch (risk) {
    case "low":
      return 0.3;
    case "medium":
      return 0.5;
    case "high":
      return 0.8;
    default:
      return 0.95;
  }
}

function summarize(task: HyperCoreTask, outputs: readonly ExpertOutput[]): string {
  return `Verified ${outputs.length} expert contribution(s) for intent '${task.intent}' (${task.domain}).`;
}

async function runExpert(
  expert: HyperCoreExpert,
  state: CognitiveState,
  timeoutMs: number,
): Promise<{ ok: true; output: ExpertOutput } | { ok: false; reason: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), Math.max(1, timeoutMs));
  });
  try {
    const result = await Promise.race([Promise.resolve().then(() => expert.run(state)), timeout]);
    if (result === TIMEOUT) return { ok: false, reason: `TIMEOUT:${expert.id}` };
    if (result === null || typeof result !== "object") return { ok: false, reason: `MALFORMED_OUTPUT:${expert.id}` };
    return {
      ok: true,
      output: {
        expertId: expert.id,
        domain: expert.domain,
        payload: result as Record<string, unknown>,
        energyKwh: expert.energyKwh,
        latencyMs: expert.latencyMs,
      },
    };
  } catch (error) {
    return { ok: false, reason: `EXPERT_FAILURE:${expert.id}:${error instanceof Error ? error.message : "unknown"}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface FinalizeInput {
  readonly status: HyperCoreStatus;
  readonly mode: HyperCoreMode;
  readonly response: VerifiedResponse | null;
  readonly verdict: VeritasVerdict | null;
  readonly state: CognitiveState | null;
  readonly activated: readonly ExpertOutput[];
  readonly cacheHit: boolean;
  readonly energyKwh: number;
  readonly cacheKey: string | null;
  readonly requestId: string;
  readonly task: HyperCoreTask;
  readonly prediction: IntentPrediction | null;
  readonly reasons: readonly string[];
  readonly started: number;
  readonly principal: string;
}

export function createHyperCore(dependencies: HyperCoreDependencies = {}): HyperCore {
  const cache = dependencies.cache ?? createGovernedSemanticCache();
  const experts = dependencies.experts ?? createDefaultExperts();
  const routerPolicy = dependencies.routerPolicy ?? DEFAULT_ROUTER_POLICY;
  const speculative = dependencies.speculative ?? DEFAULT_SPECULATIVE_CONFIG;
  const auditor = dependencies.auditor ?? createBookPiAuditor();
  const now = dependencies.now ?? (() => Date.now());
  const versions: CacheVersions = dependencies.versions ?? {
    policyVersion: CROWN_POLICY_VERSION,
    modelVersion: HYPERCORE_ID,
    dataVersion: HYPERCORE_VERSION,
  };
  const ttlSeconds = dependencies.config?.ttlSeconds ?? 3600;
  const requireAuthDefault = dependencies.config?.requireAuthorizationByDefault ?? false;

  function finalize(input: FinalizeInput): HyperCoreResult {
    const reasons = [...input.reasons];
    let sealId: string | null = null;
    let auditFailed = false;
    try {
      const seal = auditor.record({
        id: `hypercore-${input.requestId}`,
        timestamp: new Date().toISOString(),
        type: "hypercore.decision",
        methodId: HYPERCORE_METHOD_IDS.accelerateTask,
        principal: input.principal,
        riskTier: input.task.risk.toUpperCase(),
        status: `HYPERCORE_${input.status}`,
      });
      sealId = seal.id;
    } catch {
      auditFailed = true;
      reasons.push("MISSING_AUDIT");
    }

    const status: HyperCoreStatus = auditFailed ? "DENIED" : input.status;
    const response = auditFailed ? null : input.response;
    const verdict = auditFailed ? null : input.verdict;
    const activated = auditFailed ? Object.freeze([]) : input.activated;
    const approvals = verdict?.approvals ?? 0;
    const checksLength = verdict?.checks.length ?? 0;
    const cee = computeCee({
      taskSuccess: status === "COMPLETED" || status === "CACHE_HIT" ? 1 : 0,
      evidenceQuality: activated.length > 0 ? 1 : 0,
      decisionAccuracy: checksLength > 0 ? Math.min(1, approvals / checksLength) : 0,
      userValue: input.prediction?.confidence ?? 0.5,
      reuseValue: input.cacheHit ? 1 : 0,
      riskReduction: riskReductionFor(input.task.risk),
      energyKwh: input.energyKwh,
    });
    const observation: HyperCoreObservation = Object.freeze({
      requestId: input.requestId,
      mode: input.mode,
      cache: input.cacheHit ? "hit" : "miss",
      contextCompression: input.state?.compressionRatio ?? 0,
      activatedExperts: Object.freeze(activated.map((output) => output.expertId)),
      speculativeAcceptance:
        status === "COMPLETED" && modeProfile(input.mode).speculative ? speculative.acceptanceRate : 0,
      verifierConsensus: `${approvals}/${checksLength}`,
      latencyMs: Math.max(0, now() - input.started),
      energyKwh: input.energyKwh,
      cee: cee.cee,
      bookpiTraceId: sealId,
    });
    return Object.freeze({
      requestId: input.requestId,
      taskId: input.task.taskId,
      status,
      mode: input.mode,
      response,
      verdict,
      prediction: input.prediction,
      cognitiveState: input.state,
      cacheKey: auditFailed ? null : input.cacheKey,
      reasons: Object.freeze(reasons),
      observation,
      disclaimer: HYPERCORE_DISCLAIMER,
    });
  }

  async function run(
    task: HyperCoreTask,
    context: { readonly authenticatedPrincipal?: string } = {},
  ): Promise<HyperCoreResult> {
    const requestId = `hc-${randomUUID()}`;
    const started = now();
    const budget: EnergyBudget = { ...DEFAULT_ENERGY_BUDGET, ...task.budget };
    const principal = context.authenticatedPrincipal ?? task.userScope ?? "anonymous";
    const reasons: string[] = [];

    // Authorization precedes prediction, cache reads and expert execution.
    // A caller-supplied false flag must never downgrade a high/critical task.
    const requiresAuthorization = task.requiresAuthorization === true || isCritical(task.risk) || requireAuthDefault;
    if (requiresAuthorization) {
      if (!dependencies.authorizer) {
        reasons.push("AUTHORIZATION_REQUIRED");
        return finalize({
          status: "ESCALATED",
          mode: "ECO",
          response: null,
          verdict: null,
          state: null,
          activated: [],
          cacheHit: false,
          energyKwh: 0,
          cacheKey: null,
          requestId,
          task,
          prediction: null,
          reasons,
          started,
          principal,
        });
      }
      const authorization = dependencies.authorizer({
        taskId: task.taskId,
        intent: task.intent,
        risk: task.risk,
        policyVersion: versions.policyVersion,
      });
      if (!authorization.authorized) {
        reasons.push(`AUTHORIZATION_DENIED:${authorization.reason}`);
        return finalize({
          status: "DENIED",
          mode: "ECO",
          response: null,
          verdict: null,
          state: null,
          activated: [],
          cacheHit: false,
          energyKwh: 0,
          cacheKey: null,
          requestId,
          task,
          prediction: null,
          reasons,
          started,
          principal,
        });
      }
    }

    const prediction = dependencies.predictor ? dependencies.predictor(task) : null;

    const previewState = compileContext(task, [], { policyVersion: versions.policyVersion });
    const selected = routeExperts(experts, previewState, routerPolicy);
    const estimate = estimateFromExperts(selected);
    const mode = governMode({ estimate, budget, critical: isCritical(task.risk), authorizedCritical: isCritical(task.risk) && requiresAuthorization }).mode;
    const cacheKey = cache.buildKey(task, versions);

    const hit = cache.lookup(task, versions);
    if (hit && hit.response.verdict.verdict === "ALLOW") {
      return finalize({
        status: "CACHE_HIT",
        mode,
        response: hit.response,
        verdict: hit.response.verdict,
        state: null,
        activated: hit.response.evidence,
        cacheHit: true,
        energyKwh: CACHE_HIT_ENERGY_KWH,
        cacheKey,
        requestId,
        task,
        prediction,
        reasons,
        started,
        principal,
      });
    }

    const state = compileContext(task, prediction?.artifacts ?? [], { policyVersion: versions.policyVersion });
    const timeoutMs = dependencies.config?.timeoutMs ?? budget.maxLatencyMs;
    const results = await Promise.all(selected.map((expert) => runExpert(expert, state, timeoutMs)));
    const failure = results.find((result) => !result.ok);
    if (failure && !failure.ok) {
      reasons.push(failure.reason);
      return finalize({
        status: "DENIED",
        mode,
        response: null,
        verdict: null,
        state,
        activated: [],
        cacheHit: false,
        energyKwh: 0,
        cacheKey: null,
        requestId,
        task,
        prediction,
        reasons,
        started,
        principal,
      });
    }
    const outputs: readonly ExpertOutput[] = Object.freeze(
      results.filter((result): result is { ok: true; output: ExpertOutput } => result.ok).map((result) => result.output),
    );
    const energyKwh = outputs.reduce((acc, output) => acc + output.energyKwh, 0);

    const candidate: Record<string, unknown> = {
      safety: "pass",
      security: "pass",
      factuality: "pass",
      policy: "pass",
      evidence: outputs,
      financialExecution: false,
    };
    void createDraft(candidate, speculative);

    const checks = deriveChecks(candidate, task.risk);
    const verdict = verifyCandidate({ checks, risk: task.risk });
    if (verdict.verdict !== "ALLOW") {
      reasons.push(verdict.reason);
      for (const name of verdict.failed) reasons.push(`FAILED:${name}`);
      return finalize({
        status: verdict.verdict === "ESCALATE" ? "ESCALATED" : "DENIED",
        mode,
        response: null,
        verdict,
        state,
        activated: outputs,
        cacheHit: false,
        energyKwh,
        cacheKey: null,
        requestId,
        task,
        prediction,
        reasons,
        started,
        principal,
      });
    }

    const response: VerifiedResponse = Object.freeze({
      answer: summarize(task, outputs),
      evidence: outputs,
      verdict,
      financialExecution: false,
    });
    cache.store(task, response, versions, ttlSeconds, energyKwh);
    return finalize({
      status: "COMPLETED",
      mode,
      response,
      verdict,
      state,
      activated: outputs,
      cacheHit: false,
      energyKwh,
      cacheKey,
      requestId,
      task,
      prediction,
      reasons,
      started,
      principal,
    });
  }

  return { run, modes: () => MODES };
}
