/**
 * Planificación y anticipación Ω∞ (state: implemented | tested).
 *
 *   ΩX-03 Meta-Planning Core — plan acotado con dependencias, riesgo y presupuesto.
 *   ΩX-04 Dynamic Chain Optimizer — ranking determinista de cadenas de ejecución.
 *   ΩX-05 Predictive Context Engine — recuperación híbrida BM25 + vector + etiquetas.
 *   ΩX-10 Predictive Tool Invocation — predicción de herramientas read-only, sin ejecutar.
 *   ΩX-24 Latency Elimination Framework — presupuesto de latencia por etapas.
 *
 * Ningún plan autoriza efectos: describe pasos que el runtime real puede ejecutar.
 * La recuperación de contexto usa la base curada del repositorio, no internet.
 */
import { Bm25Index, reciprocalRankFusion } from '../memory/bm25';
import { KNOWLEDGE_ENTRIES } from '../agents/knowledge';
import { MicroBatcher, type ExpertId, type TokenRoutingResult } from './routing';
import { StreamingVectorIndex } from './memory';
import { clamp, clamp01, truncateText } from './text';

export interface ContextDocument {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly source: string;
  readonly tags: readonly string[];
}

export const DEFAULT_CONTEXT_DOCS: readonly ContextDocument[] = KNOWLEDGE_ENTRIES.map((entry) => ({
  id: entry.id,
  title: entry.title,
  text: entry.body,
  source: entry.source,
  tags: entry.tags,
}));

export interface ContextHit {
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
  readonly source: string;
  readonly score: number;
  readonly channels: {
    readonly lexical: number;
    readonly semantic: number;
    readonly tags: number;
  };
}

function rankOf(ranking: readonly { readonly id: string }[], id: string): number {
  const index = ranking.findIndex((entry) => entry.id === id);
  return index === -1 ? 0 : 1 - index / Math.max(1, ranking.length);
}

export class PredictiveContextEngine {
  private readonly docs = new Map<string, ContextDocument>();
  private readonly lexical = new Bm25Index(256, 4_000);
  private readonly semantic = new StreamingVectorIndex({ dimension: 128, maxDocs: 256 });
  private readonly batcher: MicroBatcher<
    { readonly query: string; readonly limit: number },
    ContextHit[]
  >;

  constructor(documents: readonly ContextDocument[] = DEFAULT_CONTEXT_DOCS) {
    for (const doc of documents) {
      if (!doc.id || this.docs.has(doc.id)) continue;
      this.docs.set(doc.id, doc);
      this.lexical.add(doc.id, `${doc.title} ${doc.tags.join(' ')} ${doc.text}`);
      this.semantic.upsert(doc.id, `${doc.title} ${doc.tags.join(' ')} ${doc.text}`, {
        source: doc.source,
      });
    }
    this.batcher = new MicroBatcher<{ query: string; limit: number }, ContextHit[]>({
      maxBatchSize: 8,
      maxDelayMs: 0,
      handler: (items) =>
        Promise.resolve(items.map((item) => this.predict(item.query, item.limit))),
    });
  }

  get size(): number {
    return this.docs.size;
  }

  predict(query: string, limit = 5): ContextHit[] {
    const normalized = typeof query === 'string' ? query.trim() : '';
    if (!normalized) return [];
    const boundedLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
    const lexicalHits = this.lexical.search(normalized, 12);
    const semanticHits = this.semantic.search(normalized, 12);
    const tagHits = this.rankByTags(normalized);
    const fused = reciprocalRankFusion(
      [lexicalHits.map((hit) => hit.id), semanticHits.map((hit) => hit.record.id), tagHits],
      20
    ).slice(0, boundedLimit);
    return fused.flatMap((entry) => {
      const doc = this.docs.get(entry.id);
      if (!doc) return [];
      const lexicalScore = lexicalHits.find((hit) => hit.id === entry.id)?.score;
      const semanticScore = semanticHits.find((hit) => hit.record.id === entry.id)?.score;
      return [
        {
          id: doc.id,
          title: doc.title,
          snippet: truncateText(doc.text, 320),
          source: doc.source,
          score: Math.round(entry.score * 10_000) / 10_000,
          channels: {
            lexical: lexicalScore === undefined ? 0 : Math.round(lexicalScore * 1_000) / 1_000,
            semantic: semanticScore === undefined ? 0 : Math.round(semanticScore * 1_000) / 1_000,
            tags:
              Math.round(
                rankOf(
                  tagHits.map((id) => ({ id })),
                  doc.id
                ) * 1_000
              ) / 1_000,
          },
        },
      ];
    });
  }

  async prefetch(queries: readonly string[], limit = 4): Promise<Map<string, ContextHit[]>> {
    const unique = [
      ...new Set(queries.map((query) => query.trim()).filter((query) => query.length > 0)),
    ].slice(0, 32);
    const settled = await Promise.all(
      unique.map((query) => this.batcher.submit({ query, limit }).catch(() => [] as ContextHit[]))
    );
    return new Map(unique.map((query, index) => [query, settled[index] ?? []]));
  }

  stats(): {
    readonly documents: number;
    readonly indexVersion: number;
    readonly prefetch: ReturnType<
      MicroBatcher<{ query: string; limit: number }, ContextHit[]>['stats']
    >;
  } {
    return {
      documents: this.docs.size,
      indexVersion: this.semantic.currentVersion,
      prefetch: this.batcher.stats(),
    };
  }

  private rankByTags(query: string): string[] {
    const terms = new Set(
      query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length >= 3)
    );
    if (terms.size === 0) return [];
    const scored: Array<{ id: string; score: number }> = [];
    for (const doc of this.docs.values()) {
      const tags = new Set(
        doc.tags
          .join(' ')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 3)
      );
      let matched = 0;
      for (const term of terms) {
        if (tags.has(term)) matched += 1;
        else if ([...tags].some((tag) => tag.startsWith(term) || term.startsWith(tag)))
          matched += 0.5;
      }
      if (matched > 0) scored.push({ id: doc.id, score: matched / terms.size });
    }
    return scored
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .map((entry) => entry.id);
  }
}

export interface ChainCandidate {
  readonly id: string;
  readonly quality: number;
  readonly latencyMs: number;
  readonly risk: number;
  readonly cost: number;
}

export interface RankedChain extends ChainCandidate {
  readonly score: number;
  readonly components: {
    readonly quality: number;
    readonly speed: number;
    readonly safety: number;
    readonly economy: number;
  };
}

export interface ChainWeights {
  readonly quality: number;
  readonly speed: number;
  readonly safety: number;
  readonly economy: number;
}

const DEFAULT_CHAIN_WEIGHTS: ChainWeights = {
  quality: 0.45,
  speed: 0.3,
  safety: 0.15,
  economy: 0.1,
};

export class ChainOptimizer {
  private readonly weights: ChainWeights;

  constructor(weights: Partial<ChainWeights> = {}) {
    const merged = { ...DEFAULT_CHAIN_WEIGHTS, ...weights };
    const total = merged.quality + merged.speed + merged.safety + merged.economy;
    if (!Number.isFinite(total) || total <= 0)
      throw new RangeError('CHAIN: weights must sum to a positive value');
    this.weights = {
      quality: merged.quality / total,
      speed: merged.speed / total,
      safety: merged.safety / total,
      economy: merged.economy / total,
    };
  }

  rank(
    candidates: readonly ChainCandidate[],
    options: { readonly latencyBudgetMs?: number } = {}
  ): RankedChain[] {
    const budget = Math.max(1, options.latencyBudgetMs ?? 1_000);
    return candidates
      .filter(
        (candidate) =>
          Number.isFinite(candidate.quality) &&
          Number.isFinite(candidate.latencyMs) &&
          Number.isFinite(candidate.risk) &&
          Number.isFinite(candidate.cost)
      )
      .map((candidate) => {
        const speed = clamp01(1 - candidate.latencyMs / budget);
        const safety = clamp01(1 - candidate.risk);
        const economy = clamp01(1 - candidate.cost);
        const score = clamp01(
          this.weights.quality * clamp01(candidate.quality) +
            this.weights.speed * speed +
            this.weights.safety * safety +
            this.weights.economy * economy
        );
        return {
          ...candidate,
          score: Math.round(score * 10_000) / 10_000,
          components: {
            quality: Math.round(clamp01(candidate.quality) * 1_000) / 1_000,
            speed: Math.round(speed * 1_000) / 1_000,
            safety: Math.round(safety * 1_000) / 1_000,
            economy: Math.round(economy * 1_000) / 1_000,
          },
        };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }

  select(
    candidates: readonly ChainCandidate[],
    options: { readonly latencyBudgetMs?: number } = {}
  ): RankedChain | undefined {
    return this.rank(candidates, options)[0];
  }
}

export type PlanIntent =
  'conversational' | 'factual' | 'analytical' | 'operational' | 'creative' | 'governance';
export type PlanRisk = 'low' | 'medium' | 'high';
export type PlanStrategy = 'fast' | 'grounded' | 'deep';
export type PlanStepId =
  | 'governance.input'
  | 'route.tokens'
  | 'context.predict'
  | 'generate.response'
  | 'reflect.review'
  | 'quality.assess'
  | 'finalize';

export interface PlanStep {
  readonly id: PlanStepId;
  readonly title: string;
  readonly dependsOn: readonly PlanStepId[];
  readonly required: boolean;
  readonly estimatedMs: number;
  readonly risk: PlanRisk;
}

export interface ExecutionPlan {
  readonly intent: PlanIntent;
  readonly goal: string;
  readonly strategy: PlanStrategy;
  readonly steps: readonly PlanStep[];
  readonly estimatedMs: number;
  readonly budgetMs: number;
  readonly risk: PlanRisk;
  readonly rankedStrategies: readonly RankedChain[];
  readonly note: string;
}

const INTENT_BY_EXPERT: Readonly<Record<ExpertId, PlanIntent>> = {
  reasoning: 'analytical',
  memory: 'factual',
  security: 'governance',
  governance: 'governance',
  retrieval: 'factual',
  tooling: 'operational',
  language: 'creative',
  planning: 'operational',
  science: 'analytical',
  economy: 'operational',
  music: 'creative',
  operations: 'operational',
};

const HIGH_RISK =
  /\b(password|contrasena|contraseña|secreto|secret|credencial|token|api[_ -]?key|admin|root|sudo|elimina|borra|destruye|despliega|instala|ejecuta|pago|cobro|stripe|transferencia)\b/i;
const MEDIUM_RISK =
  /\b(plan|estrategia|configura|configuracion|poliza|politica|permiso|aprobar|riesgo|produccion)\b/i;

function riskOf(input: string, intent: PlanIntent): PlanRisk {
  if (HIGH_RISK.test(input) || intent === 'governance') return 'high';
  if (MEDIUM_RISK.test(input) || intent === 'operational') return 'medium';
  return 'low';
}

export class MetaPlanner {
  constructor(private readonly optimizer: ChainOptimizer = new ChainOptimizer()) {}

  plan(
    input: string,
    options: {
      readonly route?: TokenRoutingResult;
      readonly budgetMs?: number;
      readonly maxBudgetMs?: number;
      readonly strategyBias?: Partial<Record<PlanStrategy, number>>;
    } = {}
  ): ExecutionPlan {
    const text = typeof input === 'string' ? input.trim() : '';
    const route = options.route;
    const topExpert = route?.topExperts[0]?.id ?? 'language';
    const intent = INTENT_BY_EXPERT[topExpert] ?? 'conversational';
    const risk = riskOf(text, intent);
    const budgetMs = clamp(
      Math.trunc(options.budgetMs ?? 1_200),
      100,
      options.maxBudgetMs ?? 8_000
    );
    const retrievalSignal = route
      ? (route.expertWeights.memory ?? 0) +
        (route.expertWeights.retrieval ?? 0) +
        (route.expertWeights.science ?? 0)
      : 0;
    const reasoningSignal = route
      ? (route.expertWeights.reasoning ?? 0) +
        (route.expertWeights.governance ?? 0) +
        (route.expertWeights.planning ?? 0)
      : 0;

    const ranked = this.optimizer.rank(
      [
        {
          id: 'fast',
          quality: 0.55 + 0.1 * (intent === 'conversational' ? 1 : 0),
          latencyMs: 120,
          risk: 0.05,
          cost: 0,
        },
        {
          id: 'grounded',
          quality: 0.62 + 0.28 * Math.min(1, retrievalSignal * 3),
          latencyMs: 320,
          risk: 0.08,
          cost: 0.02,
        },
        {
          id: 'deep',
          quality: 0.64 + 0.2 * Math.min(1, reasoningSignal * 3),
          latencyMs: 640,
          risk: 0.12,
          cost: 0.05,
        },
      ].map((candidate) => ({
        ...candidate,
        quality: clamp01(
          candidate.quality + (options.strategyBias?.[candidate.id as PlanStrategy] ?? 0)
        ),
      })),
      { latencyBudgetMs: budgetMs }
    );
    const strategy = (ranked[0]?.id ?? 'fast') as PlanStrategy;
    const retrievalRequired = strategy !== 'fast';

    const steps: PlanStep[] = [
      {
        id: 'governance.input',
        title: 'Validar entrada antes de cualquier generación',
        dependsOn: [],
        required: true,
        estimatedMs: 3,
        risk,
      },
      {
        id: 'route.tokens',
        title: 'Rutear tokens a expertos y elegir estrategia',
        dependsOn: ['governance.input'],
        required: true,
        estimatedMs: 3,
        risk: 'low',
      },
    ];
    if (retrievalRequired) {
      steps.push({
        id: 'context.predict',
        title: 'Predecir y recuperar contexto local relevante',
        dependsOn: ['route.tokens'],
        required: false,
        estimatedMs: strategy === 'deep' ? 60 : 25,
        risk: 'low',
      });
    }
    steps.push(
      {
        id: 'generate.response',
        title: 'Generar respuesta con el motor disponible',
        dependsOn: retrievalRequired ? ['context.predict'] : ['route.tokens'],
        required: true,
        estimatedMs: strategy === 'fast' ? 260 : 520,
        risk,
      },
      {
        id: 'reflect.review',
        title: 'Revisar claims, garantías y cobertura',
        dependsOn: ['generate.response'],
        required: true,
        estimatedMs: 6,
        risk: 'low',
      },
      {
        id: 'quality.assess',
        title: 'Medir calidad cognitiva de la respuesta',
        dependsOn: ['reflect.review'],
        required: true,
        estimatedMs: 3,
        risk: 'low',
      },
      {
        id: 'finalize',
        title: 'Registrar traza y devolver resultado gobernado',
        dependsOn: ['quality.assess'],
        required: true,
        estimatedMs: 2,
        risk: 'low',
      }
    );

    const estimatedMs = steps.reduce((total, step) => total + step.estimatedMs, 0);
    const firstSentence = text.match(/[^.!?…]+[.!?…]?/)?.[0]?.trim() ?? text;
    return {
      intent,
      goal: truncateText(firstSentence || 'responder al usuario', 160),
      strategy,
      steps,
      estimatedMs,
      budgetMs,
      risk,
      rankedStrategies: ranked,
      note: 'Plan determinista y acotado; no ejecuta herramientas ni concede autoridad.',
    };
  }
}

export interface ToolPrediction {
  readonly toolId: string;
  readonly confidence: number;
  readonly reason: string;
  readonly sideEffect: 'read';
  readonly autoExecute: false;
}

interface PredictionRule {
  readonly toolId: string;
  readonly reason: string;
  readonly pattern: RegExp;
}

const TOOL_RULES: readonly PredictionRule[] = [
  {
    toolId: 'clock.now',
    reason: 'La consulta pide fecha u hora actual.',
    pattern: /\b(hora|fecha|dia|día|ahora|time|date)\b/i,
  },
  {
    toolId: 'math.evaluate',
    reason: 'La consulta contiene una operación aritmética.',
    pattern: /(?:\d+\s*[+\-*/^%]\s*\d+|\bcalcula\b|\bcuanto es\b|\bcuánto es\b)/i,
  },
  {
    toolId: 'text.summarize',
    reason: 'Se solicita resumir un texto.',
    pattern: /\b(resume|resumen|sintetiza|summarize|summary)\b/i,
  },
  {
    toolId: 'knowledge.search',
    reason: 'Se piden datos sobre el ecosistema o documentación local.',
    pattern:
      /\b(isabella|tamv|plataforma|api|bookpi|skills|precios|marketplace|memoria|proveedor|modelo|repo)\b/i,
  },
  {
    toolId: 'platform.status',
    reason: 'Se pregunta por el estado del nodo o del runtime.',
    pattern: /\b(estado|status|salud|health|readiness|nodo|servidor|latencia)\b/i,
  },
  {
    toolId: 'skills.list',
    reason: 'Se consulta el catálogo de skills.',
    pattern: /\b(skills?|habilidades|capacidades)\b/i,
  },
];

export class ToolPredictor {
  predict(input: string, limit = 3): ToolPrediction[] {
    const text = typeof input === 'string' ? input : '';
    if (!text.trim()) return [];
    const predictions: ToolPrediction[] = [];
    for (const rule of TOOL_RULES) {
      const matches = text.match(new RegExp(rule.pattern.source, 'gi'))?.length ?? 0;
      if (matches === 0) continue;
      predictions.push({
        toolId: rule.toolId,
        // Más coincidencias del mismo tipo de señal elevan la confianza, con techo explícito.
        confidence: clamp(0.55 + 0.1 * matches, 0.55, 0.95),
        reason: rule.reason,
        sideEffect: 'read',
        autoExecute: false,
      });
    }
    return predictions
      .sort((a, b) => b.confidence - a.confidence || a.toolId.localeCompare(b.toolId))
      .slice(0, Math.max(1, Math.min(6, limit)));
  }
}

export interface StageTiming {
  readonly stage: string;
  readonly atMs: number;
  readonly deltaMs: number;
}

export interface LatencySnapshot {
  readonly budgetMs: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly expired: boolean;
  readonly utilization: number;
  readonly stages: readonly StageTiming[];
}

export class LatencyEliminationController {
  private readonly budgetMs: number;
  private readonly startedAt: number;
  private readonly stages: StageTiming[] = [];
  private lastAt: number;

  constructor(budgetMs = 1_200, now: number = Date.now()) {
    if (!Number.isFinite(budgetMs) || budgetMs <= 0)
      throw new RangeError('LATENCY: budgetMs must be positive');
    this.budgetMs = Math.min(60_000, budgetMs);
    this.startedAt = now;
    this.lastAt = now;
  }

  mark(stage: string, now: number = Date.now()): StageTiming {
    const safeStage =
      typeof stage === 'string' && stage.trim() ? stage.trim().slice(0, 48) : 'unnamed';
    const deltaMs = Math.max(0, now - this.lastAt);
    this.lastAt = Math.max(this.lastAt, now);
    const timing = { stage: safeStage, atMs: Math.max(0, now - this.startedAt), deltaMs };
    this.stages.push(timing);
    if (this.stages.length > 24) this.stages.shift();
    return timing;
  }

  remainingMs(now: number = Date.now()): number {
    return Math.max(0, this.budgetMs - Math.max(0, now - this.startedAt));
  }

  expired(now: number = Date.now()): boolean {
    return this.remainingMs(now) <= 0;
  }

  allowsOptional(estimatedMs: number, now: number = Date.now()): boolean {
    return Number.isFinite(estimatedMs) && estimatedMs >= 0 && this.remainingMs(now) > estimatedMs;
  }

  snapshot(now: number = Date.now()): LatencySnapshot {
    const elapsedMs = Math.max(0, now - this.startedAt);
    return {
      budgetMs: this.budgetMs,
      elapsedMs,
      remainingMs: Math.max(0, this.budgetMs - elapsedMs),
      expired: elapsedMs >= this.budgetMs,
      utilization: Math.round(clamp01(elapsedMs / this.budgetMs) * 1_000) / 1_000,
      stages: [...this.stages],
    };
  }
}
