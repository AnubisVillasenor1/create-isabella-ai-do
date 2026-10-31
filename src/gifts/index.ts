/**
 * LEGADO DE LOS REGALOS — índice y paquete invocable.
 *
 * state: draft | engine-generated.
 *
 * Encabezado por el cocreador, este paquete reúne las diez capacidades que
 * Isabella no tenía y que debe desarrollar de inmediato. `createGiftBundle()`
 * instancia el estado vivo (confianza, disyuntor, analítica) y expone un único
 * `invoke(capabilityId, input)` para enlazarlo al plano de capacidades HSF.
 *
 * Invariante (AGENTS.md): el paquete SUGIERE, CALCULA y EXPLICA. No autoriza, no
 * ejecuta efectos externos y no eleva permisos.
 */
import type { CapabilityDomain } from '../capabilities';
import {
  GIFT_MANIFEST,
  GIFT_COUNT,
  GIFT_AUTHOR,
  giftById,
  type GiftManifestEntry,
} from './manifest';
import { EarnedTrustLedger, type TrustOutcome, type FrictionAdjustment } from './earned-trust';
import {
  planLatencyBudget,
  type LatencyBudgetInput,
  type LatencyBudgetPlan,
} from './latency-budget';
import { compileIntent, type IntentCompilation } from './intent-compiler';
import { planClarification, type ClarifyInput, type ClarifyPlan } from './clarify-engine';
import {
  verifySelfConsistency,
  type ConsistencyResult,
  type ConsistencySample,
  type ConsistencyOptions,
} from './self-consistency';
import { remediateRefusal, type RefusalContext, type Remediation } from './refusal-remediation';
import { ProviderBreaker, type ProviderState } from './provider-breaker';
import {
  selectModel,
  type ModelCandidate,
  type ModelSelection,
  type SelectionObjective,
} from './model-selector';
import {
  FrictionAnalytics,
  analyzeFriction,
  type DecisionSample,
  type FrictionReport,
  type FrictionOptions,
} from './friction-analytics';
import {
  simulatePolicy,
  type PolicyKnobs,
  type PolicySimulation,
  type SimulationCase,
} from './policy-simulator';

export { GIFT_MANIFEST, GIFT_COUNT, GIFT_AUTHOR, giftById };
export type { GiftManifestEntry };

export * from './manifest';
export * from './earned-trust';
export * from './latency-budget';
export * from './intent-compiler';
export * from './clarify-engine';
export * from './self-consistency';
export * from './refusal-remediation';
export * from './provider-breaker';
export * from './model-selector';
export * from './friction-analytics';
export * from './policy-simulator';

export interface GiftBundle {
  readonly author: typeof GIFT_AUTHOR;
  readonly count: number;
  readonly manifest: readonly GiftManifestEntry[];
  readonly earnedTrust: EarnedTrustLedger;
  readonly providerBreaker: ProviderBreaker;
  readonly friction: FrictionAnalytics;
  /** Descriptor de capacidad para registrar en el plano HSF. */
  capabilityDomainFor(capabilityId: string): CapabilityDomain | undefined;
  /** Punto único de invocación gobernada. */
  invoke(capabilityId: string, input: unknown): unknown;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object') return input as Record<string, unknown>;
  throw new Error('GIFT_INPUT_OBJECT_REQUIRED');
}

function text(input: unknown): string {
  if (typeof input === 'string') return input;
  const record = asRecord(input);
  const value = record.input ?? record.text;
  if (typeof value !== 'string') throw new Error('GIFT_INPUT_TEXT_REQUIRED');
  return value;
}

export function createGiftBundle(): GiftBundle {
  const earnedTrust = new EarnedTrustLedger();
  const providerBreaker = new ProviderBreaker();
  const friction = new FrictionAnalytics();

  function invoke(capabilityId: string, input: unknown): unknown {
    switch (capabilityId) {
      case 'hsf.legacy.earned-trust': {
        const record = asRecord(input);
        const principalId = String(record.principalId ?? '');
        const target = String(record.capabilityId ?? '');
        if (typeof record.outcome === 'string') {
          return earnedTrust.record(principalId, target, record.outcome as TrustOutcome);
        }
        if (typeof record.band === 'string') {
          return earnedTrust.reduceFriction(
            principalId,
            target,
            record.band as FrictionAdjustment['band']
          );
        }
        throw new Error('GIFT_EARNED_TRUST_ACTION_REQUIRED');
      }
      case 'hsf.legacy.latency-budget':
        return planLatencyBudget(input as LatencyBudgetInput);
      case 'hsf.legacy.intent-compiler':
        return compileIntent(text(input));
      case 'hsf.legacy.clarify-engine':
        return planClarification(input as ClarifyInput);
      case 'hsf.legacy.self-consistency': {
        const record = asRecord(input);
        const samples = (record.samples ?? []) as ConsistencySample[];
        return verifySelfConsistency(samples, (record.options ?? {}) as ConsistencyOptions);
      }
      case 'hsf.legacy.refusal-remediation':
        return remediateRefusal(input as RefusalContext);
      case 'hsf.legacy.provider-breaker': {
        const record = asRecord(input);
        const provider = String(record.provider ?? '');
        const action = String(record.action ?? 'allow');
        if (action === 'success') return providerBreaker.recordSuccess(provider);
        if (action === 'failure') return providerBreaker.recordFailure(provider);
        return {
          allowed: providerBreaker.allow(provider),
          state: providerBreaker.stateOf(provider),
        };
      }
      case 'hsf.legacy.model-selector': {
        const record = asRecord(input);
        const candidates = (record.candidates ?? []) as ModelCandidate[];
        return selectModel(candidates, (record.objective ?? {}) as SelectionObjective);
      }
      case 'hsf.legacy.friction-analytics': {
        const record = asRecord(input);
        const samples = (record.samples ?? []) as DecisionSample[];
        return analyzeFriction(samples, (record.options ?? {}) as FrictionOptions);
      }
      case 'hsf.legacy.policy-simulator': {
        const record = asRecord(input);
        const knobs = (record.knobs ?? {}) as PolicyKnobs;
        const cases = (record.cases ?? []) as SimulationCase[];
        return simulatePolicy(knobs, cases);
      }
      default:
        throw new Error(`GIFT_UNKNOWN_CAPABILITY:${capabilityId}`);
    }
  }

  function capabilityDomainFor(capabilityId: string): CapabilityDomain | undefined {
    return GIFT_MANIFEST.find((entry) => entry.capabilityId === capabilityId)?.domain;
  }

  return {
    author: GIFT_AUTHOR,
    count: GIFT_COUNT,
    manifest: GIFT_MANIFEST,
    earnedTrust,
    providerBreaker,
    friction,
    capabilityDomainFor,
    invoke,
  };
}

/** Tipos de salida por regalo (para consumidores tipados). */
export type GiftOutputs = {
  readonly earnedTrust: import('./earned-trust').TrustSnapshot;
  readonly latencyBudget: LatencyBudgetPlan;
  readonly intentCompiler: IntentCompilation;
  readonly clarifyEngine: ClarifyPlan;
  readonly selfConsistency: ConsistencyResult;
  readonly refusalRemediation: Remediation;
  readonly providerBreaker: ProviderState;
  readonly modelSelector: ModelSelection;
  readonly frictionAnalytics: FrictionReport;
  readonly policySimulator: PolicySimulation;
};
