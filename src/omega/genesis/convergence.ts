// state: draft | engine-generated — Convergencia Ω∞: un turno cognitivo gobernado de nueva
// generación (capstone que ORQUESTA los módulos de genesis en el orden canónico de la pila).
// Flujo: Fastlane → Zero-Trust (admisión) → Presupuesto cognitivo → Sociedad de agentes →
// Razonamiento híbrido → Memoria (FEM) → Observabilidad → Gemelo → Sello de evidencia BookPI.
// Es DETERMINISTA y FAIL-CLOSED: si la admisión Zero-Trust falla, el turno se registra como
// DENIED y NINGUNA etapa posterior eleva una conclusión a verdad. El sello de evidencia solo
// ocurre si se inyecta un ledger BookPI real; sin él, `sealed:false` (no se finge evidencia).
// Ninguna parte mueve dinero, firma PQC ni ejecuta acciones externas: compone y gobierna la
// RUTA. La autoridad la decide el humano conforme a AGENTS.md §1. Un turno verde es una
// capacidad computacional, NO producción verificada.
import { AdaptiveSemanticFastlane } from './fastlane-v2';
import { evaluateZeroTrust, type ZeroTrustSignals, type ZeroTrustDecision } from './zero-trust';
import {
  planCognitiveBudget,
  type GoalArchetype,
  type OrchestrationPlan,
} from './meta-orchestrator';
import { MicroAgentSociety, type SocietySelection } from './agent-society';
import { runHybridReasoning, type ReasoningClaim, type ReasoningVerdict } from './hybrid-reasoning';
import { FractalExecutiveMemory, type FemLevel } from './fem';
import {
  CognitiveObservability,
  type TurnObservation,
  type CognitiveMetrics,
} from './observability';
import { buildCognitiveTwin, type TwinSnapshot, type TwinSignals } from './cognitive-twin';
import { anchorLedger, type LedgerAnchor } from '../../bookpi/anchor';
import type { BookPiEvent, BookPiEventInput } from '../../bookpi/ledger';
import { sha256 } from '../../skills/canonical-json';

/** Method ID canónico del turno de convergencia (AGENTS.md §5). */
export const CONVERGENCE_METHOD_ID = 'TINA.GENESIS.CONVERGENCE.TURN.V1.MEDIUM.INSTITUTIONAL';

/** Puerto mínimo de evidencia: el ledger BookPI real (in-memory o durable) lo satisface. */
export interface EvidenceLedgerPort {
  append(input: BookPiEventInput): BookPiEvent;
  list(limit?: number): readonly BookPiEvent[];
}

export interface GenesisTurnRequest {
  readonly traceId: string;
  readonly actorDid: string;
  readonly input: string;
  readonly goal: GoalArchetype;
  readonly zeroTrust: ZeroTrustSignals;
  readonly highStakes?: boolean;
  readonly claims?: readonly ReasoningClaim[];
  readonly knownSourceIds?: readonly string[];
  readonly policyRef?: string;
  readonly horizonMs?: number;
}

export interface GenesisTurnDependencies {
  readonly fastlane?: AdaptiveSemanticFastlane;
  readonly society?: MicroAgentSociety;
  readonly memory?: FractalExecutiveMemory;
  readonly observability?: CognitiveObservability;
  readonly ledger?: EvidenceLedgerPort;
  readonly twinSignals?: TwinSignals;
  readonly clock?: () => string;
}

export type GenesisTurnStatus = 'ALLOWED' | 'DENIED';

export interface GenesisTurnResult {
  readonly traceId: string;
  readonly actorDid: string;
  readonly status: GenesisTurnStatus;
  readonly fastlane: ReturnType<AdaptiveSemanticFastlane['evaluate']>;
  readonly zeroTrust: ZeroTrustDecision;
  readonly plan: OrchestrationPlan;
  readonly society: SocietySelection;
  readonly reasoning: ReasoningVerdict | null;
  readonly memoryLevel: FemLevel | null;
  readonly metrics: CognitiveMetrics;
  readonly twin: TwinSnapshot | null;
  readonly sealed: boolean;
  readonly evidenceAnchor: LedgerAnchor | null;
  readonly fingerprint: string;
  readonly completedAt: string;
}

function defaultTwinSignals(): TwinSignals {
  return {
    availabilityRatio: 1,
    errorRate: 0,
    queueDepthRatio: 0,
    memoryUsageRatio: 0,
    trustMean: 0.5,
    policyCompliance: 1,
    evidenceChainValid: true,
  };
}

/**
 * Ejecuta un turno cognitivo gobernado de convergencia. Compone los módulos de genesis en el
 * orden de la pila L2→L11 y sella evidencia solo si hay ledger. Determinista salvo el reloj.
 */
export function runGenesisTurn(
  request: GenesisTurnRequest,
  deps: GenesisTurnDependencies = {}
): GenesisTurnResult {
  const clock = deps.clock ?? (() => new Date().toISOString());
  if (!request.traceId.trim()) throw new Error('GENESIS_TURN_TRACE_ID_REQUIRED');
  if (!request.actorDid.trim()) throw new Error('GENESIS_TURN_ACTOR_DID_REQUIRED');

  const fastlane = deps.fastlane ?? new AdaptiveSemanticFastlane();
  const society = deps.society ?? new MicroAgentSociety();
  const memory = deps.memory ?? new FractalExecutiveMemory(clock);
  const observability = deps.observability ?? new CognitiveObservability();

  // L2 — Fastlane adaptativo.
  const fastlaneResult = fastlane.evaluate(request.input);

  // L1/L11 — Admisión Zero-Trust (fail-closed antes de cualquier contexto).
  const zeroTrust = evaluateZeroTrust(request.zeroTrust, clock);
  const allowed = zeroTrust.allowed;

  // L8 — Presupuesto cognitivo (planificación).
  const plan = planCognitiveBudget(request.goal, { highStakes: request.highStakes === true });

  // L4 — Selección de especialistas por confianza.
  const societySelection = society.selectByTrust(undefined, 3);

  // L5/L6/L9 — Razonamiento híbrido (solo si la admisión pasó; si no, INSUFFICIENT por gobernanza).
  let reasoning: ReasoningVerdict | null = null;
  if (allowed) {
    reasoning = runHybridReasoning({
      question: request.input,
      claims: request.claims ?? [],
      knownSourceIds: request.knownSourceIds ?? [],
      policyRef: request.policyRef ?? (request.zeroTrust.policyCompliant ? 'omega.zero_trust' : ''),
    });
  }

  // L7 — Escritura en memoria según horizonte (solo turnos admitidos dejan huella).
  let memoryLevel: FemLevel | null = null;
  if (allowed && reasoning) {
    const written = memory.write(
      request.traceId,
      `${request.input} -> ${reasoning.verdict} (${reasoning.corroborated} corroboradas)`,
      request.horizonMs ?? 0
    );
    memoryLevel = written.level;
  }

  // L9 — Observabilidad: registra el turno (hallucinación = síntesis bloqueada con admisión).
  const hallucinated = allowed && reasoning !== null && reasoning.verdict === 'INSUFFICIENT';
  const observation: TurnObservation = {
    traceId: request.traceId,
    hallucinated,
    reasoningVerified: reasoning !== null && reasoning.verdict === 'SUPPORTED',
    toolLatencyMs: fastlaneResult.latencyBudgetMs,
    policyCompliant: allowed,
    risk: request.highStakes ? 'high' : 'low',
    memoryConsistent: memoryLevel !== null,
  };
  observability.record(observation);
  const metrics = observability.compute();

  // L10 — Gemelo digital (read-only) sobre señales (inyectadas o neutras por defecto).
  const twin = buildCognitiveTwin(
    {
      ...defaultTwinSignals(),
      trustMean: societySelection.meanTrust,
      policyCompliance: allowed ? 1 : 0,
      ...(deps.twinSignals ?? {}),
    },
    clock
  );

  // L11 — Sello de evidencia BookPI: solo si hay ledger real; nunca se fabrica evidencia.
  let evidenceAnchor: LedgerAnchor | null = null;
  let sealed = false;
  if (deps.ledger) {
    const eventInput: BookPiEventInput = {
      id: `ev-${request.traceId}`,
      timestamp: clock(),
      type: allowed ? 'genesis.turn.allowed' : 'genesis.turn.denied',
      methodId: CONVERGENCE_METHOD_ID,
      principal: request.actorDid,
      riskTier: request.highStakes ? 'HIGH' : 'MEDIUM',
      status: reasoning?.verdict ?? 'INSUFFICIENT',
    };
    deps.ledger.append(eventInput);
    evidenceAnchor = anchorLedger(deps.ledger.list(), clock);
    sealed = evidenceAnchor !== null;
  }

  const status: GenesisTurnStatus = allowed ? 'ALLOWED' : 'DENIED';
  const completedAt = clock();
  const fingerprint = sha256({
    traceId: request.traceId,
    status,
    zeroTrustAllowed: zeroTrust.allowed,
    reasoningVerdict: reasoning?.verdict ?? null,
    memoryLevel,
    planGoal: plan.goal,
    sealed,
    completedAt,
  });

  return Object.freeze({
    traceId: request.traceId,
    actorDid: request.actorDid,
    status,
    fastlane: fastlaneResult,
    zeroTrust,
    plan,
    society: societySelection,
    reasoning,
    memoryLevel,
    metrics,
    twin,
    sealed,
    evidenceAnchor,
    fingerprint,
    completedAt,
  });
}
