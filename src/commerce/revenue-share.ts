/**
 * state: engine-generated
 * COMMERCE — política única de reparto de ingresos: creador 50–80 %, plataforma 50–20 %.
 *
 * Reglas (dueño del producto):
 *  1. Pool = ingreso neto confirmado (bruto − reembolsos − comisión del procesador − impuestos).
 *  2. Por defecto 75 % para usuarios elegibles y 25 % plataforma. La política admite 50–80 % para el creador; todo en centavos enteros y el remanente de redondeo queda en plataforma.
 *  3. Elegible = plan de pago (premium/vip/enterprise) con suscripción `active` (no `trialing`, no impago).
 *     Los usuarios `free` NO tienen derecho a monetización, generen la actividad que generen.
 *  4. El pool de usuarios se prorratea por puntos de contribución (método del mayor residuo, determinista).
 *
 * Esto calcula; NO paga. El pago real (Stripe Connect, KYC, retenciones fiscales) es otra capa.
 * Invariante: suma(líneas) + plataforma + noAsignado === neto.
 */

import type { PlanId, SubscriptionStatus } from './types';

export const MIN_USER_SHARE_BPS = 5000;
export const USER_SHARE_BPS = 7500;
export const MAX_USER_SHARE_BPS = 8000;
export const BPS_DENOMINATOR = 10000;
export const REVENUE_SHARE_POLICY_VERSION = 'revenue-share-v5.0.0' as const;

export type CreatorShareTier = 'STARTER' | 'PROFESSIONAL' | 'ADVANCED' | 'ELITE' | 'SOVEREIGN';
export type CreatorShareStream = 'standard' | 'hyperautomation';

const CREATOR_TIER_BPS: Readonly<Record<CreatorShareTier, number>> = Object.freeze({
  STARTER: 5000,
  PROFESSIONAL: 6000,
  ADVANCED: 7000,
  ELITE: 8000,
  SOVEREIGN: 8000,
});

const HYPERAUTOMATION_TIER_BPS: Readonly<Record<CreatorShareTier, number>> = Object.freeze({
  STARTER: 5000,
  PROFESSIONAL: 6000,
  ADVANCED: 7000,
  ELITE: 7500,
  SOVEREIGN: 8000,
});

export interface PlatformRevenueAllocation {
  readonly phoenixFundCents: number;
  readonly infrastructureCents: number;
  readonly daoCents: number;
}

export function splitPlatformRevenue(platformCents: number): PlatformRevenueAllocation {
  assertCents('platformCents', platformCents);
  const phoenixFundCents = Number((BigInt(platformCents) * 2000n) / BigInt(BPS_DENOMINATOR));
  const infrastructureCents = Number((BigInt(platformCents) * 3000n) / BigInt(BPS_DENOMINATOR));
  const daoCents = platformCents - phoenixFundCents - infrastructureCents;
  return Object.freeze({ phoenixFundCents, infrastructureCents, daoCents });
}

export function creatorShareBpsForTier(
  tier: CreatorShareTier,
  stream: CreatorShareStream = 'standard'
): number {
  const rate =
    stream === 'hyperautomation' ? HYPERAUTOMATION_TIER_BPS[tier] : CREATOR_TIER_BPS[tier];
  if (!Number.isInteger(rate) || rate < MIN_USER_SHARE_BPS || rate > MAX_USER_SHARE_BPS) {
    throw new Error('REVENUE_SHARE: creator tier rate outside 50–80% policy.');
  }
  return rate;
}

const PAID_PLANS: ReadonlySet<PlanId> = new Set<PlanId>(['premium', 'vip', 'enterprise']);

export type IneligibleReason = 'free_plan' | 'subscription_not_active' | 'no_contribution';

export interface EarnDecision {
  readonly eligible: boolean;
  readonly reason?: IneligibleReason;
}

/** ¿Puede este usuario participar en la monetización? Solo plan de pago con suscripción activa. */
export function canEarn(plan: PlanId, status: SubscriptionStatus): EarnDecision {
  if (!PAID_PLANS.has(plan)) return { eligible: false, reason: 'free_plan' };
  if (status !== 'active') return { eligible: false, reason: 'subscription_not_active' };
  return { eligible: true };
}

export interface ShareParticipant {
  readonly userId: string;
  readonly plan: PlanId;
  readonly status: SubscriptionStatus;
  /** Puntos de contribución del periodo (≥ 0, finitos). */
  readonly points: number;
}

export interface RevenueShareInput {
  readonly grossCents: number;
  readonly refundsCents?: number;
  readonly processorFeesCents?: number;
  readonly taxesCents?: number;
  readonly participants: readonly ShareParticipant[];
  /** Porción de usuarios en puntos base; solo se permite de 5000 (50 %) a 8000 (80 %), por defecto 7500 (75 %). */
  readonly userShareBps?: number;
}

export interface ShareLine {
  readonly userId: string;
  readonly amountCents: number;
  readonly eligible: boolean;
  readonly reason?: IneligibleReason;
}

export interface RevenueShareResult {
  readonly policyVersion: typeof REVENUE_SHARE_POLICY_VERSION;
  readonly netCents: number;
  readonly userPoolCents: number;
  readonly platformCents: number;
  /** Parte del pool de usuarios sin destinatarios elegibles; queda en reserva de plataforma. */
  readonly unallocatedCents: number;
  readonly lines: readonly ShareLine[];
}

function assertCents(name: string, v: number): void {
  if (!Number.isSafeInteger(v) || v < 0) {
    throw new Error(`REVENUE_SHARE: ${name} debe ser un entero de centavos ≥ 0.`);
  }
}

export function computeRevenueShare(input: RevenueShareInput): RevenueShareResult {
  const refunds = input.refundsCents ?? 0;
  const fees = input.processorFeesCents ?? 0;
  const taxes = input.taxesCents ?? 0;
  const bps = input.userShareBps ?? USER_SHARE_BPS;
  assertCents('grossCents', input.grossCents);
  assertCents('refundsCents', refunds);
  assertCents('processorFeesCents', fees);
  assertCents('taxesCents', taxes);
  if (!Number.isInteger(bps) || bps < MIN_USER_SHARE_BPS || bps > MAX_USER_SHARE_BPS) {
    throw new Error('REVENUE_SHARE: userShareBps fuera de rango 5000..8000.');
  }
  const net = input.grossCents - refunds - fees - taxes;
  if (net < 0) throw new Error('REVENUE_SHARE: deducciones superan el ingreso bruto.');

  const seen = new Set<string>();
  const decided = input.participants.map((p) => {
    if (!p.userId) throw new Error('REVENUE_SHARE: userId vacío.');
    if (seen.has(p.userId)) throw new Error(`REVENUE_SHARE: userId duplicado ${p.userId}.`);
    seen.add(p.userId);
    if (!Number.isFinite(p.points) || p.points < 0) {
      throw new Error(`REVENUE_SHARE: puntos inválidos para ${p.userId}.`);
    }
    const d = canEarn(p.plan, p.status);
    if (!d.eligible) return { p, eligible: false as const, reason: d.reason };
    if (p.points === 0) return { p, eligible: false as const, reason: 'no_contribution' as const };
    return { p, eligible: true as const, reason: undefined };
  });

  // BigInt evita desbordar 2^53 al multiplicar centavos × bps.
  const userPool = Number((BigInt(net) * BigInt(bps)) / BigInt(BPS_DENOMINATOR));
  const eligible = decided
    .filter((d) => d.eligible)
    .sort((a, b) => (a.p.userId < b.p.userId ? -1 : 1));
  const totalPoints = eligible.reduce((sum, d) => sum + d.p.points, 0);
  // A finite input can still overflow when aggregated. Reject rather than silently
  // allocating money with Infinity or a denominator beyond safe numeric precision.
  if (
    eligible.length > 0 &&
    (!Number.isFinite(totalPoints) || totalPoints > Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('REVENUE_SHARE: total contribution points exceed safe numeric precision.');
  }

  const payouts = new Map<string, number>();
  let distributed = 0;
  if (eligible.length > 0 && totalPoints > 0) {
    const rows = eligible.map((d) => {
      // Divide first: multiplying cents by a large points value first can lose
      // integer precision even when the final share is bounded by userPool.
      const exact = userPool * (d.p.points / totalPoints);
      const base = Math.floor(exact);
      return { id: d.p.userId, base, frac: exact - base };
    });
    distributed = rows.reduce((s, r) => s + r.base, 0);
    let left = userPool - distributed;
    // mayor residuo; empate → userId ascendente (rows ya viene ordenado por userId)
    const order = [...rows].sort((a, b) => b.frac - a.frac);
    for (const r of order) {
      if (left <= 0) break;
      r.base += 1;
      left -= 1;
    }
    for (const r of rows) payouts.set(r.id, r.base);
    distributed = userPool - Math.max(left, 0);
  }

  const unallocated = userPool - distributed;
  const platform = net - userPool;
  const platformAllocation = splitPlatformRevenue(platform);
  const lines: ShareLine[] = decided
    .map((d) => ({
      userId: d.p.userId,
      amountCents: d.eligible ? (payouts.get(d.p.userId) ?? 0) : 0,
      eligible: d.eligible,
      ...(d.reason ? { reason: d.reason } : {}),
    }))
    .sort((a, b) => (a.userId < b.userId ? -1 : 1));

  return {
    policyVersion: REVENUE_SHARE_POLICY_VERSION,
    netCents: net,
    userPoolCents: userPool,
    platformCents: platform,
    ...platformAllocation,
    unallocatedCents: unallocated,
    lines,
  };
}
