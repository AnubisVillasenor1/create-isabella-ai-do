// state: draft | engine-generated — Meta Cognitive Orchestrator (Documento §V).
// Planificador de PRESUPUESTO COGNITIVO: decide ANTES de ejecutar cuánto presupuesto
// relativo destinar a cada dimensión (razonamiento, evidencia, redacción, auditoría,
// verificación, memoria) y qué especialistas/herramientasinvocar. Es determinista y
// acotado: no ejecuta, no abre red, no autoriza. Reparte porcentajes enteros que suman
// exactamente 100 (método del resto más grande) para que el plan sea reproducible.
import { isGenesisLayer, layerIndex, type GenesisLayer } from './layers';

export const COGNITIVE_DIMENSIONS = [
  'reasoning',
  'evidence',
  'redaction',
  'audit',
  'verification',
  'memory',
] as const;
export type CognitiveDimension = (typeof COGNITIVE_DIMENSIONS)[number];

export type CognitiveBudget = Readonly<Record<CognitiveDimension, number>>;

export type GoalArchetype =
  | 'scientific_policy'
  | 'legal_review'
  | 'creative_writing'
  | 'data_analysis'
  | 'operational_status'
  | 'general_inquiry';

/** Asignaciones base por arquetipo (Documento §V: 40/20/15/10/10/5 para política científica). */
const ARCHETYPE_BASE: Readonly<Record<GoalArchetype, CognitiveBudget>> = Object.freeze({
  scientific_policy: {
    reasoning: 40,
    evidence: 20,
    redaction: 15,
    audit: 10,
    verification: 10,
    memory: 5,
  },
  legal_review: {
    reasoning: 25,
    evidence: 20,
    redaction: 15,
    audit: 20,
    verification: 15,
    memory: 5,
  },
  creative_writing: {
    reasoning: 20,
    evidence: 10,
    redaction: 45,
    audit: 5,
    verification: 10,
    memory: 10,
  },
  data_analysis: {
    reasoning: 35,
    evidence: 30,
    redaction: 10,
    audit: 5,
    verification: 15,
    memory: 5,
  },
  operational_status: {
    reasoning: 15,
    evidence: 15,
    redaction: 10,
    audit: 10,
    verification: 10,
    memory: 40,
  },
  general_inquiry: {
    reasoning: 30,
    evidence: 25,
    redaction: 15,
    audit: 5,
    verification: 15,
    memory: 10,
  },
});

export interface OrchestratorConstraints {
  /** Profundidad máxima de la pila a recorrer (capa L0–L11). Default 'L11'. */
  readonly maxLayer?: GenesisLayer;
  /** Presupuesto total relativo de energía/costo permitido (0..1000). Default 1000. */
  readonly energyUnits?: number;
  /** Refuerza dimensiones de riesgo (audit+verification) para objetivos sensibles. */
  readonly highStakes?: boolean;
}

export interface OrchestrationPlan {
  readonly goal: GoalArchetype;
  readonly budget: CognitiveBudget;
  readonly specialists: readonly string[];
  readonly maxLayer: GenesisLayer;
  readonly depth: number;
  readonly estimatedEnergyUnits: number;
  readonly rationale: string;
}

const SPECIALIST_BY_EMPHASIS: Readonly<Record<CognitiveDimension, readonly string[]>> =
  Object.freeze({
    reasoning: ['planner', 'reasoner'],
    evidence: ['evidence', 'citation'],
    redaction: ['writer'],
    audit: ['compliance', 'auditor'],
    verification: ['validator', 'verifier'],
    memory: ['recall', 'archivist'],
  });

/** Reparte `weights` como enteros que suman `total` (100) con el método del resto más grande. */
export function normalizeToHundred(weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0) {
    const even = Math.floor(100 / weights.length);
    const out = weights.map(() => even);
    let remainder = 100 - even * weights.length;
    for (let i = 0; i < out.length && remainder > 0; i += 1) {
      out[i] += 1;
      remainder -= 1;
    }
    return out;
  }
  const raw = weights.map((w) => (w / sum) * 100);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = 100 - floored.reduce((acc, f) => acc + f, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floored];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    out[order[cursor % order.length].i] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return out;
}

function budgetFromWeights(weights: readonly number[]): CognitiveBudget {
  const hundred = normalizeToHundred(weights);
  const budget = {} as Record<CognitiveDimension, number>;
  COGNITIVE_DIMENSIONS.forEach((dim, i) => {
    budget[dim] = hundred[i] ?? 0;
  });
  return Object.freeze(budget);
}

/**
 * Produce un plan de presupuesto cognitivo determinista para un objetivo. Con `highStakes`
 * refuerza auditoría y verificación (la gobernanza pesa más cuando el riesgo sube).
 */
export function planCognitiveBudget(
  goal: GoalArchetype,
  constraints: OrchestratorConstraints = {}
): OrchestrationPlan {
  const maxLayer: GenesisLayer =
    constraints.maxLayer && isGenesisLayer(constraints.maxLayer) ? constraints.maxLayer : 'L11';
  const base = ARCHETYPE_BASE[goal];
  const weights = COGNITIVE_DIMENSIONS.map((dim) => {
    const w = base[dim];
    if (constraints.highStakes && (dim === 'audit' || dim === 'verification')) return w * 1.5;
    return w;
  });
  const budget = budgetFromWeights(weights);
  const topDims = COGNITIVE_DIMENSIONS.slice()
    .sort((a, b) => budget[b] - budget[a])
    .slice(0, 2);
  const specialists = [...new Set(topDims.flatMap((dim) => SPECIALIST_BY_EMPHASIS[dim]))];
  const depth = layerIndex(maxLayer);
  const energyUnits = clamp(constraints.energyUnits ?? 1000, 0, 1000);
  return Object.freeze({
    goal,
    budget,
    specialists: Object.freeze(specialists),
    maxLayer,
    depth,
    estimatedEnergyUnits: energyUnits,
    rationale:
      `Presupuesto gobernado para '${goal}' con énfasis en ${topDims.join(', ')}; ` +
      `pila hasta ${maxLayer} (profundidad ${depth}); highStakes=${constraints.highStakes === true}.`,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Suma de verificación: un presupuesto siempre suma exactamente 100. */
export function budgetTotal(budget: CognitiveBudget): number {
  return COGNITIVE_DIMENSIONS.reduce((acc, dim) => acc + budget[dim], 0);
}
