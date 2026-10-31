/**
 * Omega Runtime Ω∞ — orquestador ejecutable (state: implemented | tested | wired).
 *
 * Ejecuta, en este orden y dentro del proceso:
 *   gobernanza de entrada → ruteo de tokens → plan → memoria táctica →
 *   contexto predictivo (BM25 + vector + etiquetas) → predicción de herramientas →
 *   [el servidor genera la respuesta] → razonamiento → reflexión → calidad →
 *   gobernanza de salida → recompensa de evolución → traza pública.
 *
 * Autoridad: NONE. El runtime no ejecuta herramientas, no escribe memoria canónica,
 * no llama proveedores y no afirma producción. Cada resultado es acotado y explicable.
 */
import { ExecutiveTacticalMemory } from '../memory/executive-tactical-memory';
import {
  MetaPlanner,
  PredictiveContextEngine,
  ToolPredictor,
  type ContextDocument,
  type ContextHit,
  type ExecutionPlan,
  type PlanStrategy,
  type ToolPrediction,
} from './planning';
import {
  AdaptiveTokenRouter,
  CognitiveLoadBalancer,
  HyperEvolutionEngine,
  type ContextStrategy,
  type EvolutionArmSnapshot,
  type TokenRoutingResult,
} from './routing';
import {
  CognitiveQualityAssessor,
  GovernanceValidator,
  NeuroSymbolicReasoner,
  OMEGA_SAFE_BLOCKED_RESPONSE,
  ReflectionEngine,
  type GovernanceReport,
  type QualityReport,
  type ReflectionReport,
} from './reasoning';
import { LatencyEliminationController, type LatencySnapshot } from './planning';
import {
  BehavioralAnalyzer,
  AdaptiveThreatIntelligence,
  type BehaviorReport,
  type ThreatAssessment,
} from './security';
import { PostQuantumReadiness, type HybridReadiness } from './crypto';
import { DistributedKvFabric, FederatedKnowledgeSync } from './federation';
import { clamp01, hashId } from './text';

export * from './text';
export * from './reasoning';
export * from './memory';
export * from './routing';
export * from './planning';
export * from './federation';
export * from './security';
export * from './crypto';

export interface OmegaRuntimeOptions {
  readonly etmCapacity?: number;
  readonly kvNodes?: readonly string[];
  readonly contextDocs?: readonly ContextDocument[];
  readonly budgetMs?: number;
  readonly now?: () => number;
}

export interface OmegaPrepareInput {
  readonly input: string;
  readonly budgetMs?: number;
}

export interface OmegaPrepareResult {
  readonly input: string;
  readonly inputHash: string;
  readonly plan: ExecutionPlan;
  readonly routing: Pick<TokenRoutingResult, 'tokens' | 'topExperts' | 'entropy'>;
  readonly inputGovernance: GovernanceReport;
  readonly contextHits: readonly ContextHit[];
  readonly contextCacheHit: boolean;
  readonly toolPredictions: readonly ToolPrediction[];
  readonly threat: ThreatAssessment;
  readonly behavior: Pick<BehaviorReport, 'score' | 'level'>;
  readonly evolutionSuggested: ContextStrategy;
  readonly blocked: boolean;
  readonly blockedResponse: string | null;
  readonly latency: LatencySnapshot;
}

export interface OmegaFinalizeResult {
  readonly draft: string;
  readonly blocked: boolean;
  readonly blockedResponse: string | null;
  readonly reflection: ReflectionReport;
  readonly quality: QualityReport;
  readonly outputGovernance: GovernanceReport;
  readonly reasoning: {
    readonly extracted: number;
    readonly inferred: number;
    readonly contradictions: number;
    readonly consistent: boolean;
    readonly confidence: number;
  };
  readonly evolutionArm: ContextStrategy;
  readonly evolutionReward: number;
  readonly latency: LatencySnapshot;
}

export interface OmegaPublicSummary {
  readonly plan: {
    readonly intent: ExecutionPlan['intent'];
    readonly goal: string;
    readonly strategy: PlanStrategy;
    readonly risk: ExecutionPlan['risk'];
    readonly budgetMs: number;
    readonly estimatedMs: number;
    readonly steps: ReadonlyArray<{
      readonly id: string;
      readonly required: boolean;
      readonly estimatedMs: number;
      readonly risk: string;
    }>;
  };
  readonly routing: {
    readonly tokens: number;
    readonly topExperts: TokenRoutingResult['topExperts'];
    readonly entropy: number;
  };
  readonly inputGovernance: GovernanceReport;
  readonly context: {
    readonly hits: ReadonlyArray<{
      readonly id: string;
      readonly title: string;
      readonly source: string;
      readonly score: number;
    }>;
    readonly cacheHit: boolean;
  };
  readonly toolPredictions: readonly ToolPrediction[];
  readonly threat: {
    readonly score: number;
    readonly level: ThreatAssessment['level'];
    readonly signals: ThreatAssessment['signals'];
  };
  readonly behavior: { readonly score: number; readonly level: BehaviorReport['level'] };
  readonly evolution: {
    readonly suggested: ContextStrategy;
    readonly arm: ContextStrategy;
    readonly reward: number | null;
    readonly snapshot: readonly EvolutionArmSnapshot[];
  };
  readonly reflection: {
    readonly verdict: ReflectionReport['verdict'];
    readonly issues: ReflectionReport['issues'];
    readonly changes: readonly string[];
    readonly coverage: number;
  } | null;
  readonly quality: {
    readonly score: number;
    readonly verdict: QualityReport['verdict'];
    readonly metrics: QualityReport['metrics'];
    readonly issues: readonly string[];
  } | null;
  readonly outputGovernance: GovernanceReport | null;
  readonly reasoning: OmegaFinalizeResult['reasoning'] | null;
  readonly latency: LatencySnapshot;
  readonly authority: 'NONE';
  readonly executionPerformed: false;
  readonly omegaNetworkUsed: false;
  readonly note: string;
}

export interface OmegaRuntimeStatus {
  readonly schema: 'omega-runtime/1.0.0';
  readonly state: 'wired' | 'degraded';
  readonly authority: 'NONE';
  readonly executionPerformed: false;
  readonly capabilities: readonly string[];
  readonly counters: Readonly<{
    prepared: number;
    finalized: number;
    blockedInputs: number;
    blockedOutputs: number;
    contextHits: number;
    contextCacheHits: number;
  }>;
  readonly etm: ReturnType<ExecutiveTacticalMemory['stats']>;
  readonly context: ReturnType<PredictiveContextEngine['stats']>;
  readonly load: ReturnType<CognitiveLoadBalancer['snapshot']>;
  readonly evolution: readonly EvolutionArmSnapshot[];
  readonly kv: ReturnType<DistributedKvFabric['snapshot']>;
  readonly federation: ReturnType<FederatedKnowledgeSync['stats']>;
  readonly threat: ReturnType<AdaptiveThreatIntelligence['snapshot']>;
  readonly postQuantum: HybridReadiness;
  readonly note: string;
}

function armFor(strategy: PlanStrategy): ContextStrategy {
  return strategy === 'fast' ? 'lean' : strategy;
}

export class OmegaRuntime {
  private readonly etm: ExecutiveTacticalMemory;
  private readonly context: PredictiveContextEngine;
  private readonly planner = new MetaPlanner();
  private readonly router = new AdaptiveTokenRouter();
  private readonly governance = new GovernanceValidator();
  private readonly reasoner = new NeuroSymbolicReasoner();
  private readonly reflection = new ReflectionEngine();
  private readonly qa = new CognitiveQualityAssessor();
  private readonly load = new CognitiveLoadBalancer(64, 1_200, 8);
  private readonly evolution = new HyperEvolutionEngine();
  private readonly predictor = new ToolPredictor();
  private readonly kv: DistributedKvFabric;
  private readonly federation = new FederatedKnowledgeSync({
    nodeId: 'omega-local',
    maxRecords: 128,
  });
  private readonly behavior = new BehavioralAnalyzer();
  private readonly threats = new AdaptiveThreatIntelligence();
  private readonly now: () => number;
  private readonly defaultBudgetMs: number;
  private pqc: PostQuantumReadiness | null = null;
  private readonly counters = {
    prepared: 0,
    finalized: 0,
    blockedInputs: 0,
    blockedOutputs: 0,
    contextHits: 0,
    contextCacheHits: 0,
  };

  constructor(options: OmegaRuntimeOptions = {}) {
    const etmCapacity = options.etmCapacity ?? 256;
    this.etm = new ExecutiveTacticalMemory({
      capacity: etmCapacity,
      defaultTtlMs: 15 * 60 * 1_000,
    });
    this.context = new PredictiveContextEngine(options.contextDocs);
    this.kv = new DistributedKvFabric({
      nodeIds: options.kvNodes ?? ['omega-local-a', 'omega-local-b', 'omega-local-c'],
      replicationFactor: Math.min(3, options.kvNodes?.length ?? 3),
      maxKeys: 1_024,
    });
    this.now = options.now ?? Date.now;
    this.defaultBudgetMs = options.budgetMs ?? 1_500;
  }

  async prepare(input: OmegaPrepareInput): Promise<OmegaPrepareResult> {
    const raw = typeof input.input === 'string' ? input.input.trim() : '';
    if (!raw) throw new Error('OMEGA_INPUT_REQUIRED');
    const bounded = raw.slice(0, 20_000);
    const started = this.now();
    const loadToken = this.load.begin();
    const latency = new LatencyEliminationController(
      Math.max(100, Math.min(8_000, input.budgetMs ?? this.defaultBudgetMs)),
      started
    );
    this.counters.prepared += 1;

    const inputGovernance = this.governance.validateInput(bounded);
    const routing = this.router.route(bounded);
    latency.mark('governance+route', this.now());

    const evolutionSuggested = this.evolution.select();
    const biasStrategy: PlanStrategy = evolutionSuggested === 'lean' ? 'fast' : evolutionSuggested;
    const plan = this.planner.plan(bounded, {
      route: routing,
      budgetMs: latency.snapshot(this.now()).budgetMs,
      strategyBias: { [biasStrategy]: 0.04 },
    });
    latency.mark('plan', this.now());

    const riskPriority = plan.risk === 'high' ? 0.9 : plan.risk === 'medium' ? 0.65 : 0.4;
    this.safeRecord('goal', plan.goal, { intent: plan.intent, risk: plan.risk }, riskPriority);
    this.safeRecord(
      'plan',
      `Plan ${plan.strategy} · ${plan.intent}`,
      {
        strategy: plan.strategy,
        steps: plan.steps.map((step) => step.id),
        budgetMs: plan.budgetMs,
      },
      riskPriority
    );

    const threat = this.threats.assess(bounded);
    if (threat.level === 'high') {
      this.safeRecord(
        'priority',
        'Amenaza alta detectada en la entrada',
        {
          score: threat.score,
          signals: threat.signals.map((signal) => signal.code),
        },
        clamp01(threat.score)
      );
    }
    const toolPredictions = this.predictor.predict(bounded, 3);
    const behavior = this.behavior.observe(
      'public-cognition',
      {
        requestRate: 1,
        inputChars: bounded.length,
        uniqueTools: toolPredictions.length,
        deniedActions: inputGovernance.verdict === 'BLOCK' ? 1 : 0,
        errorRate: 0,
      },
      this.now()
    );

    if (inputGovernance.verdict === 'BLOCK') {
      this.counters.blockedInputs += 1;
      this.safeRecord(
        'decision',
        'Entrada bloqueada por gobernanza ΩX-21',
        {
          strategy: plan.strategy,
          findings: inputGovernance.findings.map((finding) => finding.code),
        },
        1
      );
      const snapshot = latency.snapshot(this.now());
      latency.mark('blocked', this.now());
      this.load.end(loadToken, snapshot.elapsedMs);
      return {
        input: bounded,
        inputHash: hashId(bounded, 16),
        plan,
        routing: {
          tokens: routing.tokens,
          topExperts: routing.topExperts,
          entropy: routing.entropy,
        },
        inputGovernance,
        contextHits: [],
        contextCacheHit: false,
        toolPredictions,
        threat,
        behavior: { score: behavior.score, level: behavior.level },
        evolutionSuggested,
        blocked: true,
        blockedResponse: OMEGA_SAFE_BLOCKED_RESPONSE,
        latency: latency.snapshot(this.now()),
      };
    }

    let contextHits: ContextHit[] = [];
    let contextCacheHit = false;
    if (plan.strategy !== 'fast' && latency.allowsOptional(25, this.now())) {
      const key = `omega:ctx:${hashId(`${bounded}|${plan.strategy}`, 24)}`;
      const cached = this.kv.get(key);
      if (cached.found && Array.isArray(cached.value)) {
        contextHits = cached.value as ContextHit[];
        contextCacheHit = true;
        this.counters.contextCacheHits += 1;
      } else {
        contextHits = this.context.predict(bounded, plan.strategy === 'deep' ? 5 : 3);
        this.counters.contextHits += contextHits.length;
        this.kv.set(key, contextHits, this.now());
      }
      latency.mark('context', this.now());
    }

    const snapshot = latency.snapshot(this.now());
    this.load.end(loadToken, snapshot.elapsedMs);
    return {
      input: bounded,
      inputHash: hashId(bounded, 16),
      plan,
      routing: { tokens: routing.tokens, topExperts: routing.topExperts, entropy: routing.entropy },
      inputGovernance,
      contextHits,
      contextCacheHit,
      toolPredictions,
      threat,
      behavior: { score: behavior.score, level: behavior.level },
      evolutionSuggested,
      blocked: false,
      blockedResponse: null,
      latency: latency.snapshot(this.now()),
    };
  }

  finalize(prepared: OmegaPrepareResult, draft: string): OmegaFinalizeResult {
    this.counters.finalized += 1;
    const started = this.now();
    const latency = new LatencyEliminationController(
      Math.max(100, prepared.plan.budgetMs),
      started
    );
    const arm = armFor(prepared.plan.strategy);
    const contextText = prepared.contextHits
      .map((hit) => `${hit.title}: ${hit.snippet}`)
      .join('\n');
    const boundedDraft = typeof draft === 'string' ? draft.trim().slice(0, 40_000) : '';
    const reasoning = this.reasoner.analyze({
      input: prepared.input,
      context: contextText,
      draft: boundedDraft,
    });
    latency.mark('reasoning', this.now());
    const reflection = this.reflection.reflect({
      input: prepared.input,
      draft: boundedDraft,
      contextText,
      contradictionCount: reasoning.contradictions.length,
    });
    latency.mark('reflection', this.now());
    const quality = this.qa.assess({
      input: prepared.input,
      draft: reflection.revisedDraft,
      contextText,
      contradictionCount: reasoning.contradictions.length,
    });
    latency.mark('quality', this.now());
    const outputGovernance = this.governance.validateOutput(reflection.revisedDraft);
    latency.mark('output-governance', this.now());

    const blocked =
      prepared.blocked || reflection.verdict === 'BLOCK' || outputGovernance.verdict === 'BLOCK';
    const finalDraft = blocked
      ? (prepared.blockedResponse ?? OMEGA_SAFE_BLOCKED_RESPONSE)
      : reflection.revisedDraft;
    const evolutionReward = blocked
      ? 0
      : clamp01(
          quality.score *
            (quality.verdict === 'BLOCK' ? 0.1 : reflection.verdict === 'REVISE' ? 0.85 : 1)
        );
    this.evolution.reward(arm, evolutionReward);
    if (blocked) this.counters.blockedOutputs += 1;

    this.safeRecord(
      'decision',
      `Decisión ${blocked ? 'BLOCK' : reflection.verdict}`,
      {
        strategy: prepared.plan.strategy,
        quality: Math.round(quality.score * 1_000) / 1_000,
        reflection: reflection.verdict,
        governance: outputGovernance.verdict,
        contradictions: reasoning.contradictions.length,
      },
      prepared.plan.risk === 'high' ? 1 : 0.7
    );

    this.federation.upsert(
      `decision:${hashId(`${prepared.inputHash}|${prepared.plan.strategy}`, 20)}`,
      {
        strategy: prepared.plan.strategy,
        quality: Math.round(quality.score * 1_000) / 1_000,
        reflection: reflection.verdict,
        governance: outputGovernance.verdict,
        blocked,
      },
      this.now()
    );

    return {
      draft: finalDraft,
      blocked,
      blockedResponse: blocked ? finalDraft : null,
      reflection,
      quality,
      outputGovernance,
      reasoning: {
        extracted: reasoning.counts.extracted,
        inferred: reasoning.counts.inferred,
        contradictions: reasoning.counts.contradictions,
        consistent: reasoning.consistent,
        confidence: Math.round(reasoning.confidence * 1_000) / 1_000,
      },
      evolutionArm: arm,
      evolutionReward: Math.round(evolutionReward * 1_000) / 1_000,
      latency: latency.snapshot(this.now()),
    };
  }

  publicSummary(
    prepared: OmegaPrepareResult,
    finalized?: OmegaFinalizeResult | null
  ): OmegaPublicSummary {
    return {
      plan: {
        intent: prepared.plan.intent,
        goal: prepared.plan.goal,
        strategy: prepared.plan.strategy,
        risk: prepared.plan.risk,
        budgetMs: prepared.plan.budgetMs,
        estimatedMs: prepared.plan.estimatedMs,
        steps: prepared.plan.steps.map((step) => ({
          id: step.id,
          required: step.required,
          estimatedMs: step.estimatedMs,
          risk: step.risk,
        })),
      },
      routing: {
        tokens: prepared.routing.tokens,
        topExperts: prepared.routing.topExperts,
        entropy: Math.round(prepared.routing.entropy * 1_000) / 1_000,
      },
      inputGovernance: prepared.inputGovernance,
      context: {
        hits: prepared.contextHits.map((hit) => ({
          id: hit.id,
          title: hit.title,
          source: hit.source,
          score: hit.score,
        })),
        cacheHit: prepared.contextCacheHit,
      },
      toolPredictions: prepared.toolPredictions,
      threat: {
        score: prepared.threat.score,
        level: prepared.threat.level,
        signals: prepared.threat.signals,
      },
      behavior: { score: prepared.behavior.score, level: prepared.behavior.level },
      evolution: {
        suggested: prepared.evolutionSuggested,
        arm: finalized?.evolutionArm ?? armFor(prepared.plan.strategy),
        reward: finalized?.evolutionReward ?? null,
        snapshot: this.evolution.snapshot(),
      },
      reflection: finalized
        ? {
            verdict: finalized.reflection.verdict,
            issues: finalized.reflection.issues,
            changes: finalized.reflection.changes,
            coverage: Math.round(finalized.reflection.coverage * 1_000) / 1_000,
          }
        : null,
      quality: finalized
        ? {
            score: Math.round(finalized.quality.score * 1_000) / 1_000,
            verdict: finalized.quality.verdict,
            metrics: finalized.quality.metrics,
            issues: finalized.quality.issues,
          }
        : null,
      outputGovernance: finalized?.outputGovernance ?? null,
      reasoning: finalized?.reasoning ?? null,
      latency: finalized?.latency ?? prepared.latency,
      authority: 'NONE',
      executionPerformed: false,
      omegaNetworkUsed: false,
      note: 'Runtime local y determinista. La generación externa, si ocurre, la decide la ruta del servidor; Ω∞ no concede autoridad ni ejecuta herramientas.',
    };
  }

  status(): OmegaRuntimeStatus {
    if (!this.pqc) this.pqc = new PostQuantumReadiness(undefined, 'omega-runtime-local');
    return {
      schema: 'omega-runtime/1.0.0',
      state: 'wired',
      authority: 'NONE',
      executionPerformed: false,
      capabilities: [
        'ΩX-01',
        'ΩX-02',
        'ΩX-03',
        'ΩX-04',
        'ΩX-05',
        'ΩX-06',
        'ΩX-08',
        'ΩX-09',
        'ΩX-10',
        'ΩX-11',
        'ΩX-12',
        'ΩX-13',
        'ΩX-14',
        'ΩX-15',
        'ΩX-16',
        'ΩX-17',
        'ΩX-18',
        'ΩX-19',
        'ΩX-20',
        'ΩX-21',
        'ΩX-23',
        'ΩX-24',
        'ΩX-25',
      ],
      counters: { ...this.counters },
      etm: this.etm.stats(),
      context: this.context.stats(),
      load: this.load.snapshot(),
      evolution: this.evolution.snapshot(),
      kv: this.kv.snapshot(),
      federation: this.federation.stats(),
      threat: this.threats.snapshot(),
      postQuantum: this.pqc.inventory(),
      note: 'Estado del runtime en proceso. No certifica producción, no sustituye observabilidad externa y no incluye firmas post-cuánticas reales.',
    };
  }

  private safeRecord(
    kind: 'goal' | 'plan' | 'decision' | 'priority',
    title: string,
    payload: Record<string, unknown>,
    priority: number
  ): void {
    try {
      this.etm.record(kind, title, payload, { priority });
    } catch {
      // La memoria táctica es una optimización acotada, nunca una dependencia dura del chat.
    }
  }
}
