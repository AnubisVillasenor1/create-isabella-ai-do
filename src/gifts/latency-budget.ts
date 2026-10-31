/**
 * REGALO 2 — PRESUPUESTO DE LATENCIA (Latency Budget Governor).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: turbo-planner decide qué filtros son obligatorios, pero
 * nada garantizaba que la respuesta cupiera en un plazo. Aquí se declara un plazo
 * (ms) y se decide: qué filtros obligatorios siempre corren, cuáles opcionales
 * caben y cuáles se difieren. Los obligatorios NUNCA se saltan por presupuesto.
 *
 * Invariante (AGENTS.md): no autoriza ni ejecuta; solo planifica tiempo. Si los
 * obligatorios exceden el plazo, se marca degradado y se reporta el exceso, sin
 * sacrificar la garantía. `authorityPath` permanece `FULL`.
 */
import { TURBO_FILTERS, type TurboFilter, type TurboPlan } from '../intelligence/turbo-planner';
import { digest, round } from './util';

export const LATENCY_BUDGET_VERSION = '1.0.0' as const;
export const LATENCY_BUDGET_METHOD_ID =
  'A.TWINS.LEGACY.latency_budget.plan.v1.0.0.LOW.AUTONOMOUS' as const;
export const LATENCY_BUDGET_DISCLAIMER =
  'El presupuesto de latencia decide qué filtros opcionales diferir; los obligatorios nunca se saltan y no concede autoridad.';

export const DEFAULT_FILTER_COST_MS: Readonly<Record<TurboFilter, number>> = Object.freeze({
  AEGIS: 2,
  CROWN: 3,
  SANITIZATION: 2,
  VIGIA: 4,
  GROUNDING: 25,
  CONTRADICTION: 8,
  PERMISSION_MAP: 6,
});

export interface LatencyBudgetInput {
  readonly plan: TurboPlan;
  /** Plazo total disponible en milisegundos (financiado por el cliente). */
  readonly budgetMs: number;
  readonly estimatedCosts?: Partial<Record<TurboFilter, number>>;
  /** Filtros opcionales deseados (además de los obligatorios), en orden de prioridad. */
  readonly optionalFilters?: readonly TurboFilter[];
}

export interface LatencyBudgetPlan {
  readonly version: typeof LATENCY_BUDGET_VERSION;
  readonly route: TurboPlan['route'];
  readonly budgetMs: number;
  readonly mandatoryFilters: readonly TurboFilter[];
  readonly runFilters: readonly TurboFilter[];
  readonly deferredOptionalFilters: readonly TurboFilter[];
  readonly estimatedMandatoryMs: number;
  readonly estimatedTotalMs: number;
  readonly withinBudget: boolean;
  readonly degraded: boolean;
  readonly overrunMs: number;
  readonly authorityPath: 'FULL';
  readonly reasons: readonly string[];
  readonly digest: string;
  readonly methodId: typeof LATENCY_BUDGET_METHOD_ID;
  readonly disclaimer: typeof LATENCY_BUDGET_DISCLAIMER;
}

function costOf(
  filter: TurboFilter,
  costs: Partial<Record<TurboFilter, number>> | undefined
): number {
  const provided = costs?.[filter];
  if (provided !== undefined && Number.isFinite(provided) && provided >= 0) return provided;
  return DEFAULT_FILTER_COST_MS[filter];
}

export function planLatencyBudget(input: LatencyBudgetInput): LatencyBudgetPlan {
  if (!input || !input.plan || !Array.isArray(input.plan.requiredFilters)) {
    throw new Error('LATENCY_PLAN_REQUIRED');
  }
  if (!Number.isFinite(input.budgetMs) || input.budgetMs <= 0) {
    throw new Error('LATENCY_BUDGET_INVALID');
  }

  const reasons: string[] = [];
  const mandatory = [...input.plan.requiredFilters];
  const mandatorySet = new Set<TurboFilter>(mandatory);

  let estimatedMandatoryMs = 0;
  for (const filter of mandatory) estimatedMandatoryMs += costOf(filter, input.estimatedCosts);

  const withinBudget = estimatedMandatoryMs <= input.budgetMs;
  const degraded = !withinBudget;
  const overrunMs = degraded ? round(estimatedMandatoryMs - input.budgetMs, 3) : 0;

  if (degraded) {
    reasons.push('MANDATORY_FILTERS_ALWAYS_RUN', 'BUDGET_EXCEEDED_BY_MANDATORY_FILTERS');
  } else {
    reasons.push('MANDATORY_FILTERS_WITHIN_BUDGET');
  }

  const requested = (input.optionalFilters ?? []).filter((filter) => !mandatorySet.has(filter));
  const seen = new Set<TurboFilter>();
  const optionalOrdered: TurboFilter[] = [];
  for (const filter of requested) {
    if ((TURBO_FILTERS as readonly string[]).includes(filter) && !seen.has(filter)) {
      seen.add(filter);
      optionalOrdered.push(filter);
    }
  }

  let remaining = input.budgetMs - estimatedMandatoryMs;
  const runFilters: TurboFilter[] = [...mandatory];
  const deferredOptionalFilters: TurboFilter[] = [];
  for (const filter of optionalOrdered) {
    const cost = costOf(filter, input.estimatedCosts);
    if (cost <= remaining) {
      runFilters.push(filter);
      remaining -= cost;
      reasons.push(`OPTIONAL_ADMITTED:${filter}`);
    } else {
      deferredOptionalFilters.push(filter);
      reasons.push(`OPTIONAL_DEFERRED:${filter}`);
    }
  }

  const estimatedTotalMs = round(
    runFilters.reduce((sum, filter) => sum + costOf(filter, input.estimatedCosts), 0),
    3
  );

  return {
    version: LATENCY_BUDGET_VERSION,
    route: input.plan.route,
    budgetMs: input.budgetMs,
    mandatoryFilters: Object.freeze(mandatory),
    runFilters: Object.freeze(runFilters),
    deferredOptionalFilters: Object.freeze(deferredOptionalFilters),
    estimatedMandatoryMs: round(estimatedMandatoryMs, 3),
    estimatedTotalMs,
    withinBudget,
    degraded,
    overrunMs,
    authorityPath: 'FULL',
    reasons: Object.freeze(reasons),
    digest: digest({
      route: input.plan.route,
      budgetMs: input.budgetMs,
      mandatory,
      runFilters,
      deferredOptionalFilters,
    }),
    methodId: LATENCY_BUDGET_METHOD_ID,
    disclaimer: LATENCY_BUDGET_DISCLAIMER,
  };
}
