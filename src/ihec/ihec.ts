/**
 * ISABELLA Ω v3.1 · IHEC — Orquestador del Hyper Emergency Core.
 *
 * state: draft | engine-generated.
 *
 * Compone los 12 subsistemas y los 10 regalos de Perplexity en un ciclo de
 * continuidad gobernado: en el camino feliz devuelve el resultado del núcleo más
 * los regalos aplicados; ante un fallo soberano activa failover + recuperación +
 * crisis memory + mutación inmunológica (respuesta degradada); ante un fallo no
 * clasificado activa Omega Mode y reconstruye.
 *
 * Invariante (AGENTS.md §1): IHEC NO autoriza y NO ejecuta. `authorityPath`
 * permanece `FULL`; la conciencia humana decide y ejecuta.
 */
import {
  CognitiveGovernanceCore,
  CrisisMemoryEngine,
  DatasetFusionEngine,
  HyperCacheEngine,
  HyperMlFusionEngine,
  HyperRagEngine,
  HyperRecoveryEngine,
  HyperSentinelEngine,
  HyperSnapshotEngine,
  ImmuneMutationEngine,
  OmegaMode,
  SelfHealingTopologyEngine,
  VectorHyperIndex,
  type IhecCrisisRecord,
  type IhecDegradedResponse,
  type IhecGovernanceDecision,
  type IhecMutationGuard,
  type IhecOmegaResponse,
  type IhecSentinelVerdict,
  type IhecTopologyPlan,
} from './engines';
import {
  aetherVerdict,
  axiomExplain,
  chronosNexus,
  echoReconstruct,
  luminaHypothesize,
  novaSelectIndex,
  oracleConsensus,
  perplexityGiftById,
  prismaEvaluate,
  sentinelXAnalyze,
  terraAdapt,
  PERPLEXITY_GIFT_COUNT,
  type AetherResult,
  type AxiomResult,
  type ChronosResult,
  type EchoFragment,
  type EchoResult,
  type LuminaResult,
  type NovaResult,
  type OracleResult,
  type PrismaResult,
  type SentinelXResult,
  type TerraResult,
} from './gifts';
import {
  IHEC_DIVERGENCES,
  IHEC_LAYER_COUNT,
  IHEC_SPEC_ID,
  IHEC_SUBSYSTEM_COUNT,
  IHEC_VERSION,
} from './contract';

/** Excepción soberana: fallo clasificado en una federación. */
export class SovereignKernelError extends Error {
  readonly federation: string;
  readonly code: string;
  constructor(federation: string, code: string) {
    super(`Fallo soberano en ${federation}: ${code}`);
    this.name = 'SovereignKernelError';
    this.federation = federation;
    this.code = code;
  }
}

/** Los 12 subsistemas IHEC v3.1 instanciados. */
export class Ihec {
  readonly sentinel = new HyperSentinelEngine();
  readonly cache = new HyperCacheEngine();
  readonly snapshot = new HyperSnapshotEngine();
  readonly recovery = new HyperRecoveryEngine();
  readonly governance = new CognitiveGovernanceCore();
  readonly mlFusion = new HyperMlFusionEngine();
  readonly datasetFusion = new DatasetFusionEngine();
  readonly vectorIndex = new VectorHyperIndex();
  readonly rag = new HyperRagEngine();
  readonly crisisMemory = new CrisisMemoryEngine();
  readonly immuneMutation = new ImmuneMutationEngine();
  readonly topology = new SelfHealingTopologyEngine();
  readonly omegaMode = new OmegaMode();

  activateFailover(federation: string): IhecTopologyPlan {
    return this.topology.reconfigure(federation);
  }
}

export function createIhec(): Ihec {
  return new Ihec();
}

export interface IhecGiftPayload {
  readonly summary?: string;
  readonly memoryFragments?: readonly EchoFragment[];
  readonly past?: Record<string, unknown>;
  readonly present?: Record<string, unknown>;
  readonly semanticNoise?: number;
  readonly contextDrift?: number;
  readonly territory?: string;
  readonly profile?: string;
  readonly principles?: readonly string[];
  readonly partialData?: Record<string, unknown>;
}

export interface AppliedGifts {
  readonly prisma: PrismaResult;
  readonly echo: EchoResult;
  readonly axiom: AxiomResult;
  readonly nova: NovaResult;
  readonly oracle: OracleResult;
  readonly lumina: LuminaResult;
  readonly sentinelX: SentinelXResult;
  readonly terra: TerraResult;
  readonly chronos: ChronosResult;
  readonly aether: AetherResult;
}

/** Aplica los 10 regalos de Perplexity de forma determinista. Ninguno autoriza. */
export function applyPerplexityGifts(payload: IhecGiftPayload): AppliedGifts {
  return Object.freeze({
    prisma: prismaEvaluate({
      semanticNoise: payload.semanticNoise ?? 0,
      contextDrift: payload.contextDrift ?? 0,
    }),
    echo: echoReconstruct(payload.memoryFragments ?? []),
    axiom: axiomExplain({
      summary: payload.summary ?? 'Sin resumen provisto',
      evidence: payload.memoryFragments?.map((f) => f.source ?? 'fragment') ?? [],
    }),
    nova: novaSelectIndex({ latencyTargetMs: 5, accuracyTarget: 0.9 }),
    oracle: oracleConsensus(payload.summary ? [{ answer: payload.summary, confidence: 0.9 }] : []),
    lumina: luminaHypothesize({
      partialData: payload.partialData ?? {},
      conflicts: payload.principles ?? [],
    }),
    sentinelX: sentinelXAnalyze({
      payload,
      contextDrift: payload.contextDrift ?? 0,
      semanticNoise: payload.semanticNoise ?? 0,
    }),
    terra: terraAdapt({ territory: payload.territory, profile: payload.profile }),
    chronos: chronosNexus(payload.past ?? {}, payload.present ?? {}),
    aether: aetherVerdict({ summary: payload.summary ?? '' }, payload.principles ?? []),
  });
}

export interface IhecOk<T> {
  readonly status: 'ok';
  readonly result: T;
  readonly gifts: AppliedGifts;
  readonly sentinel: IhecSentinelVerdict;
  readonly authorityPath: 'FULL';
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
}

export interface IhecDegraded {
  readonly status: 'degraded';
  readonly reason: string;
  readonly response: IhecDegradedResponse;
  readonly topology: IhecTopologyPlan;
  readonly governance: readonly IhecGovernanceDecision[];
}

export interface IhecOmega {
  readonly status: 'omega';
  readonly response: IhecOmegaResponse;
  readonly crisis: readonly IhecCrisisRecord[];
  readonly guards: readonly IhecMutationGuard[];
}

export type IhecRunResult<T> = IhecOk<T> | IhecDegraded | IhecOmega;

/**
 * Ejecuta el núcleo (`core`) bajo la protección de IHEC. Determinista salvo por
 * marcas temporales. Fail-closed: un fallo soberano produce respuesta degradada
 * con recuperación; cualquier otro fallo activa Omega Mode. En ambos casos se
 * archiva la crisis y se genera una guarda (PENDING_REVIEW).
 */
export function runWithIhec<T>(
  ihec: Ihec,
  payload: IhecGiftPayload,
  core: () => T
): IhecRunResult<T> {
  const sentinel = ihec.sentinel.detect({
    signature: payload.summary,
    contextDrift: payload.contextDrift ?? 0,
    semanticNoise: payload.semanticNoise ?? 0,
  });

  try {
    const result = core();
    const gifts = applyPerplexityGifts(payload);
    return Object.freeze({
      status: 'ok' as const,
      result,
      gifts,
      sentinel,
      authorityPath: 'FULL' as const,
      authorizationPerformed: false as const,
      executionPerformed: false as const,
    });
  } catch (error) {
    if (error instanceof SovereignKernelError) {
      const topology = ihec.activateFailover(error.federation);
      const snapshot = ihec.snapshot.capture({
        state: { phase: 'failover', payloadSummary: payload.summary ?? '' },
      });
      const recovery = ihec.recovery.restore(snapshot);
      ihec.crisisMemory.record(error, snapshot.hash, 'FAILOVER');
      ihec.immuneMutation.generateGuard(error, 'normal');
      const response = ihec.governance.degradedResponse(payload, recovery, error.code);
      return Object.freeze({
        status: 'degraded' as const,
        reason: error.code,
        response,
        topology,
        governance: ihec.governance.trail(),
      });
    }

    const normalized = error instanceof Error ? error : new Error(String(error));
    ihec.omegaMode.freeze();
    ihec.omegaMode.saveGlobalState();
    ihec.omegaMode.quarantineCorrupted();
    ihec.omegaMode.activateSecondaryRuntime();
    ihec.crisisMemory.record(normalized, null, 'OMEGA');
    ihec.immuneMutation.generateGuard(normalized, 'critical');
    const response = ihec.omegaMode.rebuildAndRespond(payload);
    return Object.freeze({
      status: 'omega' as const,
      response,
      crisis: ihec.crisisMemory.all(),
      guards: ihec.immuneMutation.all(),
    });
  }
}

/** Resumen honesto de IHEC v3.1 (conteos y divergencias declaradas). */
export function ihecSummary(): {
  readonly spec: typeof IHEC_SPEC_ID;
  readonly version: typeof IHEC_VERSION;
  readonly subsystems: number;
  readonly layers: number;
  readonly gifts: number;
  readonly divergences: number;
} {
  return Object.freeze({
    spec: IHEC_SPEC_ID,
    version: IHEC_VERSION,
    subsystems: IHEC_SUBSYSTEM_COUNT,
    layers: IHEC_LAYER_COUNT,
    gifts: PERPLEXITY_GIFT_COUNT,
    divergences: IHEC_DIVERGENCES.length,
  });
}

export { perplexityGiftById };
