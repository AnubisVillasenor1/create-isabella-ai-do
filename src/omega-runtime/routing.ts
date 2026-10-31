/**
 * Routing y adaptación Ω∞ (state: implemented | tested).
 *
 * ΩX-08 Adaptive Token Routing — ruteo heurístico token→experto (no neuronal).
 * ΩX-09 Micro-Batching Fabric — agrupación real de trabajos concurrentes.
 * ΩX-11 Cognitive Load Balancer — presión por latencia y trabajos en vuelo.
 * ΩX-25 Hyper Evolution Engine — bandido UCB1 que ajusta la estrategia de contexto.
 */
import { clamp01, normalizeText, tokenizeText } from './text';

export type ExpertId =
  | 'reasoning'
  | 'memory'
  | 'security'
  | 'governance'
  | 'retrieval'
  | 'tooling'
  | 'language'
  | 'planning'
  | 'science'
  | 'economy'
  | 'music'
  | 'operations';

const LEXICONS: Readonly<Record<ExpertId, readonly string[]>> = {
  reasoning: [
    'razon',
    'logica',
    'infer',
    'contradic',
    'prueba',
    'demuestra',
    'deduc',
    'conclu',
    'argument',
    'falacia',
  ],
  memory: [
    'memoria',
    'record',
    'historial',
    'contexto',
    'recuerd',
    'sesion',
    'etm',
    'ikes',
    'vector',
    'embedding',
  ],
  security: [
    'seguridad',
    'amenaza',
    'riesgo',
    'ataque',
    'vulnerab',
    'secreto',
    'credencial',
    'zero',
    'trust',
    'cifr',
  ],
  governance: [
    'gobern',
    'politica',
    'autoridad',
    'permiso',
    'aprob',
    'audit',
    'crown',
    'cumpl',
    'etica',
    'invariante',
  ],
  retrieval: [
    'busca',
    'recuper',
    'fuente',
    'document',
    'rag',
    'consulta',
    'indice',
    'bm25',
    'evidencia',
    'cita',
  ],
  tooling: [
    'herramienta',
    'tool',
    'ejecuta',
    'calcula',
    'hora',
    'resume',
    'agente',
    'api',
    'funcion',
    'skill',
  ],
  language: [
    'idioma',
    'espanol',
    'ingles',
    'traduc',
    'redact',
    'estilo',
    'texto',
    'palabra',
    'frase',
    'respuesta',
  ],
  planning: [
    'plan',
    'objetivo',
    'meta',
    'paso',
    'estrategia',
    'prioriza',
    'depend',
    'presupuesto',
    'tiempo',
    'latencia',
  ],
  science: [
    'ciencia',
    'investiga',
    'hipotesis',
    'experimento',
    'paper',
    'doi',
    'universidad',
    'dato',
    'metodo',
    'replica',
  ],
  economy: [
    'economia',
    'precio',
    'pago',
    'ingreso',
    'costo',
    'venta',
    'suscrip',
    'stripe',
    'wallet',
    'monetiz',
  ],
  music: [
    'musica',
    'cancion',
    'compos',
    'audio',
    'voz',
    'ritmo',
    'mezcla',
    'master',
    'tono',
    'melodia',
  ],
  operations: [
    'opera',
    'despliega',
    'servidor',
    'nodo',
    'estado',
    'readiness',
    'proceso',
    'infra',
    'docker',
    'kubernetes',
  ],
};

export interface TokenRoute {
  readonly token: string;
  readonly expert: ExpertId;
  readonly weight: number;
}

export interface TokenRoutingResult {
  readonly tokens: number;
  readonly expertWeights: Readonly<Record<ExpertId, number>>;
  readonly topExperts: readonly { readonly id: ExpertId; readonly weight: number }[];
  readonly tokenRoutes: readonly TokenRoute[];
  readonly entropy: number;
  readonly note: string;
}

function softenToken(token: string): string {
  return token.length > 5 ? token.slice(0, 5) : token.slice(0, 4);
}

export class AdaptiveTokenRouter {
  private readonly lexicons: Readonly<Record<ExpertId, ReadonlySet<string>>>;

  constructor(lexicons: Readonly<Record<ExpertId, readonly string[]>> = LEXICONS) {
    const built = {} as Record<ExpertId, ReadonlySet<string>>;
    for (const [expert, terms] of Object.entries(lexicons) as Array<
      [ExpertId, readonly string[]]
    >) {
      built[expert] = new Set(terms.map(softenToken));
    }
    this.lexicons = built;
  }

  route(input: string): TokenRoutingResult {
    const tokens = tokenizeText(input).slice(0, 120);
    const experts = Object.keys(this.lexicons) as ExpertId[];
    const totals = Object.fromEntries(experts.map((expert) => [expert, 0])) as Record<
      ExpertId,
      number
    >;
    const tokenRoutes: TokenRoute[] = [];
    for (const token of tokens) {
      const stem = softenToken(token);
      const scores = experts.map((expert) => {
        const lexicon = this.lexicons[expert];
        const hit = [...lexicon].some((term) => stem.startsWith(term) || term.startsWith(stem));
        return { expert, score: hit ? 1 : 0.02 };
      });
      const maxScore = Math.max(...scores.map((entry) => entry.score));
      const exps = scores.map((entry) => ({
        ...entry,
        exp: Math.exp((entry.score - maxScore) / 0.45),
      }));
      const sum = exps.reduce((total, entry) => total + entry.exp, 0);
      const weighted = exps.map((entry) => ({ expert: entry.expert, weight: entry.exp / sum }));
      weighted.sort((a, b) => b.weight - a.weight || a.expert.localeCompare(b.expert));
      const best = weighted[0];
      if (!best) continue;
      totals[best.expert] += best.weight;
      tokenRoutes.push({
        token,
        expert: best.expert,
        weight: Math.round(best.weight * 1_000) / 1_000,
      });
    }
    const totalWeight = Object.values(totals).reduce((total, value) => total + value, 0) || 1;
    for (const expert of experts) totals[expert] = totals[expert] / totalWeight;
    const topExperts = experts
      .map((id) => ({ id, weight: Math.round(totals[id] * 1_000) / 1_000 }))
      .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
      .slice(0, 3);
    const entropy =
      experts.length <= 1
        ? 0
        : clamp01(
            -experts.reduce(
              (total, expert) =>
                total + (totals[expert] > 0 ? totals[expert] * Math.log(totals[expert]) : 0),
              0
            ) / Math.log(experts.length)
          );
    return {
      tokens: tokens.length,
      expertWeights: totals,
      topExperts,
      tokenRoutes,
      entropy,
      note: 'Ruteo heurístico por léxico y softmax; no es un router neuronal entrenado.',
    };
  }
}

export interface MicroBatcherOptions<T, R> {
  readonly maxBatchSize: number;
  readonly maxDelayMs: number;
  readonly handler: (items: readonly T[]) => Promise<readonly R[]>;
}

interface PendingJob<T, R> {
  readonly value: T;
  readonly resolve: (value: R) => void;
  readonly reject: (error: unknown) => void;
}

export class MicroBatcher<T, R> {
  private readonly queue: PendingJob<T, R>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private readonly statsState = { batches: 0, items: 0, failures: 0, largestBatch: 0 };

  constructor(private readonly options: MicroBatcherOptions<T, R>) {
    if (
      !Number.isInteger(options.maxBatchSize) ||
      options.maxBatchSize < 1 ||
      options.maxBatchSize > 256
    ) {
      throw new RangeError('MICROBATCH: maxBatchSize must be 1..256');
    }
    if (
      !Number.isFinite(options.maxDelayMs) ||
      options.maxDelayMs < 0 ||
      options.maxDelayMs > 1_000
    ) {
      throw new RangeError('MICROBATCH: maxDelayMs must be 0..1000');
    }
  }

  get size(): number {
    return this.queue.length;
  }

  submit(value: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.queue.push({ value, resolve, reject });
      if (this.queue.length >= this.options.maxBatchSize) {
        void this.flush();
      } else {
        this.schedule();
      }
    });
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, this.options.maxBatchSize);
    try {
      const results = await this.options.handler(batch.map((job) => job.value));
      if (results.length !== batch.length) {
        throw new Error('MICROBATCH: handler returned a mismatched result length');
      }
      this.statsState.batches += 1;
      this.statsState.items += batch.length;
      this.statsState.largestBatch = Math.max(this.statsState.largestBatch, batch.length);
      batch.forEach((job, index) => {
        const result = results[index];
        if (result === undefined) job.reject(new Error('MICROBATCH: missing result'));
        else job.resolve(result);
      });
    } catch (error) {
      this.statsState.failures += 1;
      for (const job of batch) job.reject(error);
    } finally {
      this.flushing = false;
      if (this.queue.length > 0) this.schedule();
    }
  }

  stats(): {
    readonly batches: number;
    readonly items: number;
    readonly failures: number;
    readonly largestBatch: number;
    readonly pending: number;
  } {
    return { ...this.statsState, pending: this.queue.length };
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.maxDelayMs);
    const timer = this.timer as ReturnType<typeof setTimeout> & { unref?: () => void };
    timer.unref?.();
  }
}

export interface LoadSnapshot {
  readonly inFlight: number;
  readonly samples: number;
  readonly p95Ms: number;
  readonly pressure: number;
}

export class CognitiveLoadBalancer {
  private readonly samples: number[] = [];
  private inFlight = 0;
  private readonly active = new Set<number>();
  private token = 0;

  constructor(
    private readonly windowSize = 64,
    private readonly targetLatencyMs = 250,
    private readonly maxConcurrent = 8
  ) {
    if (windowSize < 8 || windowSize > 4_096) throw new RangeError('LOAD: windowSize out of range');
    if (!(targetLatencyMs > 0)) throw new RangeError('LOAD: targetLatencyMs must be positive');
    if (maxConcurrent < 1) throw new RangeError('LOAD: maxConcurrent must be positive');
  }

  begin(): number {
    this.token += 1;
    this.active.add(this.token);
    this.inFlight = this.active.size;
    return this.token;
  }

  end(token: number, latencyMs: number): void {
    if (!this.active.delete(token)) return;
    this.inFlight = this.active.size;
    if (Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.samples.push(latencyMs);
      if (this.samples.length > this.windowSize) this.samples.shift();
    }
  }

  pressure(): number {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p95 =
      sorted.length === 0
        ? 0
        : (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0);
    const latencyPressure = Math.min(1, p95 / this.targetLatencyMs);
    const concurrencyPressure = Math.min(1, this.inFlight / this.maxConcurrent);
    return clamp01(0.55 * latencyPressure + 0.45 * concurrencyPressure);
  }

  snapshot(): LoadSnapshot {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p95 =
      sorted.length === 0
        ? 0
        : (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0);
    return {
      inFlight: this.inFlight,
      samples: this.samples.length,
      p95Ms: Math.round(p95 * 10) / 10,
      pressure: Math.round(this.pressure() * 1_000) / 1_000,
    };
  }
}

export type ContextStrategy = 'lean' | 'grounded' | 'deep';

export interface EvolutionArmSnapshot {
  readonly arm: ContextStrategy;
  readonly pulls: number;
  readonly meanReward: number;
  readonly ucb: number;
}

export class HyperEvolutionEngine {
  private readonly stats = new Map<ContextStrategy, { pulls: number; total: number }>();

  constructor(
    private readonly arms: readonly ContextStrategy[] = ['lean', 'grounded', 'deep'],
    private readonly exploration = 1.2
  ) {
    if (arms.length === 0) throw new RangeError('EVOLUTION: at least one arm is required');
    for (const arm of arms) this.stats.set(arm, { pulls: 0, total: 0 });
  }

  select(): ContextStrategy {
    for (const arm of this.arms) {
      if ((this.stats.get(arm)?.pulls ?? 0) === 0) return arm;
    }
    const totalPulls = [...this.stats.values()].reduce((total, entry) => total + entry.pulls, 0);
    let best: ContextStrategy = this.arms[0] ?? 'lean';
    let bestValue = -Infinity;
    for (const arm of this.arms) {
      const entry = this.stats.get(arm);
      if (!entry || entry.pulls === 0) continue;
      const mean = entry.total / entry.pulls;
      const value =
        mean + this.exploration * Math.sqrt(Math.log(Math.max(1, totalPulls)) / entry.pulls);
      if (value > bestValue) {
        bestValue = value;
        best = arm;
      }
    }
    return best;
  }

  reward(arm: ContextStrategy, value: number): void {
    const entry = this.stats.get(arm);
    if (!entry) return;
    entry.pulls += 1;
    entry.total += clamp01(value);
  }

  snapshot(): readonly EvolutionArmSnapshot[] {
    const totalPulls = [...this.stats.values()].reduce((total, entry) => total + entry.pulls, 0);
    return this.arms.map((arm) => {
      const entry = this.stats.get(arm) ?? { pulls: 0, total: 0 };
      const mean = entry.pulls === 0 ? 0 : entry.total / entry.pulls;
      const ucb =
        entry.pulls === 0
          ? Infinity
          : mean + this.exploration * Math.sqrt(Math.log(Math.max(1, totalPulls)) / entry.pulls);
      return {
        arm,
        pulls: entry.pulls,
        meanReward: Math.round(mean * 10_000) / 10_000,
        ucb: Number.isFinite(ucb) ? Math.round(ucb * 10_000) / 10_000 : 9_999,
      };
    });
  }
}
