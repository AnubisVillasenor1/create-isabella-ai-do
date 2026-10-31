/**
 * REGALO 1 — CONFIANZA GANADA (Earned Trust / Fricción Adaptativa).
 *
 * state: draft | engine-generated.
 *
 * Problema que resuelve: el semáforo clasifica cada solicitud con el MISMO rigor
 * sin importar el historial. Resultado: fricción perpetua sobre lo que ya salió
 * bien miles de veces. Este módulo aprende —con evidencia append-only— qué
 * (principal, capacidad) merece una vía más fluida y rebaja la fricción SOLO
 * dentro de lo que ya estaba autorizado.
 *
 * Invariante (AGENTS.md): la confianza ganada **NO** concede autoridad, **NO**
 * eleva permisos y **NO** relaja nunca un flujo ROJO ni NARANJA (riesgo alto/crítico).
 * Solo ensancha la vía rápida desde AMARILLO→VERDE para riesgos bajos con muestra
 * suficiente. `authorityPath` permanece `FULL`.
 *
 * Fail-closed: sin muestra suficiente no se ensancha; lo destructivo/LO-que-falla
 * empuja la reputación hacia abajo (peso mayor que el éxito), nunca hacia arriba.
 */
import type { RiskTier } from '../authority/method-id';
import type { TrafficBand } from '../governance/traffic-light';
import { clamp, digest, round } from './util';

export const EARNED_TRUST_VERSION = '1.0.0' as const;
export const EARNED_TRUST_METHOD_ID =
  'A.TWINS.LEGACY.earned_trust.reduce_friction.v1.0.0.LOW.AUTONOMOUS' as const;
export const EARNED_TRUST_DISCLAIMER =
  'La confianza ganada reduce fricción dentro de lo ya autorizado; nunca concede autoridad, nunca relaja ROJO/NARANJA y no constituye facultad verificada.';

export const TRUST_OUTCOMES = ['ALLOWED', 'DENIED', 'ESCALATED'] as const;
export type TrustOutcome = (typeof TRUST_OUTCOMES)[number];

export const TRUST_TIERS = ['PROBATION', 'EMERGING', 'ESTABLISHED', 'TRUSTED'] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export interface TrustStats {
  readonly allowed: number;
  readonly denied: number;
  readonly escalated: number;
  readonly streak: number;
}

export interface TrustSnapshot {
  readonly version: typeof EARNED_TRUST_VERSION;
  readonly principalId: string;
  readonly capabilityId: string;
  readonly score: number;
  readonly tier: TrustTier;
  readonly samples: number;
  readonly stats: TrustStats;
  readonly digest: string;
}

export interface FrictionAdjustment {
  readonly originalBand: TrafficBand;
  readonly band: TrafficBand;
  readonly tier: TrustTier;
  readonly score: number;
  readonly samples: number;
  readonly adjusted: boolean;
  readonly reason: string;
  readonly digest: string;
}

const PRIOR = 1;
const DENY_WEIGHT = 3;
const ESCALATE_WEIGHT = 2;
const MIN_SAMPLES_FOR_TRUST = 5;
const WIDEN_SCORE_THRESHOLD = 70;

const BAND_ORDER: readonly TrafficBand[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

function emptyStats(): TrustStats {
  return { allowed: 0, denied: 0, escalated: 0, streak: 0 };
}

function assertKey(principalId: string, capabilityId: string): void {
  if (!principalId || !principalId.trim()) throw new Error('EARNED_TRUST_PRINCIPAL_REQUIRED');
  if (!capabilityId || !capabilityId.trim()) throw new Error('EARNED_TRUST_CAPABILITY_REQUIRED');
}

function assertOutcome(outcome: TrustOutcome): void {
  if (!(TRUST_OUTCOMES as readonly string[]).includes(outcome)) {
    throw new Error('EARNED_TRUST_OUTCOME_INVALID');
  }
}

export class EarnedTrustLedger {
  private readonly ledger = new Map<string, TrustStats>();

  private static keyOf(principalId: string, capabilityId: string): string {
    return `${principalId}::${capabilityId}`;
  }

  stats(principalId: string, capabilityId: string): TrustStats {
    return this.ledger.get(EarnedTrustLedger.keyOf(principalId, capabilityId)) ?? emptyStats();
  }

  /** Registra un resultado append-only y devuelve la foto resultante. */
  record(principalId: string, capabilityId: string, outcome: TrustOutcome): TrustSnapshot {
    assertKey(principalId, capabilityId);
    assertOutcome(outcome);
    const key = EarnedTrustLedger.keyOf(principalId, capabilityId);
    const current = this.ledger.get(key) ?? emptyStats();
    const next: TrustStats = {
      allowed: current.allowed + (outcome === 'ALLOWED' ? 1 : 0),
      denied: current.denied + (outcome === 'DENIED' ? 1 : 0),
      escalated: current.escalated + (outcome === 'ESCALATED' ? 1 : 0),
      streak: outcome === 'ALLOWED' ? current.streak + 1 : 0,
    };
    this.ledger.set(key, next);
    return this.snapshot(principalId, capabilityId);
  }

  score(principalId: string, capabilityId: string): number {
    const s = this.stats(principalId, capabilityId);
    const successes = s.allowed;
    const failures = s.denied * DENY_WEIGHT + s.escalated * ESCALATE_WEIGHT;
    return round(
      clamp((100 * (successes + PRIOR)) / (successes + failures + 2 * PRIOR), 0, 100),
      2
    );
  }

  tier(principalId: string, capabilityId: string): TrustTier {
    const s = this.stats(principalId, capabilityId);
    const samples = s.allowed + s.denied + s.escalated;
    const score = this.score(principalId, capabilityId);
    if (samples >= MIN_SAMPLES_FOR_TRUST && score >= 80) return 'TRUSTED';
    if (samples >= MIN_SAMPLES_FOR_TRUST && score >= 60) return 'ESTABLISHED';
    if (score >= 45) return 'EMERGING';
    return 'PROBATION';
  }

  snapshot(principalId: string, capabilityId: string): TrustSnapshot {
    assertKey(principalId, capabilityId);
    const stats = this.stats(principalId, capabilityId);
    const samples = stats.allowed + stats.denied + stats.escalated;
    const score = this.score(principalId, capabilityId);
    const tier = this.tier(principalId, capabilityId);
    return {
      version: EARNED_TRUST_VERSION,
      principalId,
      capabilityId,
      score,
      tier,
      samples,
      stats,
      digest: digest({ principalId, capabilityId, stats, score, tier }),
    };
  }

  snapshotAll(): readonly TrustSnapshot[] {
    const out: TrustSnapshot[] = [];
    for (const key of this.ledger.keys()) {
      const separator = key.indexOf('::');
      const principalId = key.slice(0, separator);
      const capabilityId = key.slice(separator + 2);
      out.push(this.snapshot(principalId, capabilityId));
    }
    return out;
  }

  /**
   * Ensancha la vía rápida cuando la evidencia lo permite. Nunca relaja ROJO/NARANJA.
   */
  reduceFriction(principalId: string, capabilityId: string, band: TrafficBand): FrictionAdjustment {
    if (!(BAND_ORDER as readonly string[]).includes(band)) {
      throw new Error('EARNED_TRUST_BAND_INVALID');
    }
    const snap = this.snapshot(principalId, capabilityId);
    if (band === 'RED') {
      return this.adjustment(band, band, snap, false, 'RED_NEVER_RELAXED_BY_TRUST');
    }
    if (band === 'ORANGE') {
      return this.adjustment(band, band, snap, false, 'HIGH_RISK_NEVER_RELAXED_BY_TRUST');
    }
    const trustworthy =
      (snap.tier === 'ESTABLISHED' || snap.tier === 'TRUSTED') &&
      snap.samples >= MIN_SAMPLES_FOR_TRUST &&
      snap.score >= WIDEN_SCORE_THRESHOLD;
    if (!trustworthy) {
      return this.adjustment(band, band, snap, false, 'INSUFFICIENT_EARNED_TRUST');
    }
    if (band === 'YELLOW') {
      return this.adjustment(band, 'GREEN', snap, true, 'EARNED_TRUST_WIDENS_FAST_LANE');
    }
    return this.adjustment(band, band, snap, false, 'ALREADY_FAST_LANE');
  }

  private adjustment(
    originalBand: TrafficBand,
    band: TrafficBand,
    snap: TrustSnapshot,
    adjusted: boolean,
    reason: string
  ): FrictionAdjustment {
    return {
      originalBand,
      band,
      tier: snap.tier,
      score: snap.score,
      samples: snap.samples,
      adjusted,
      reason,
      digest: digest({ originalBand, band, reason, ...snap.stats }),
    };
  }
}

/** Helper funcional de una sola pasada sobre un ledger existente. */
export function reduceFrictionWithTrust(
  ledger: EarnedTrustLedger,
  principalId: string,
  capabilityId: string,
  band: TrafficBand
): FrictionAdjustment {
  return ledger.reduceFriction(principalId, capabilityId, band);
}

/** La confianza ganada solo aplica cuando el riesgo del método es bajo. */
export function trustMayApply(riskTier: RiskTier): boolean {
  return riskTier === 'LOW' || riskTier === 'NEGLIGIBLE';
}
