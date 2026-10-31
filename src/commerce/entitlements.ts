/**
 * COMMERCE — entitlements (state: draft | engine-generated).
 *
 * Deterministic, side-effect-free entitlement and quota decisions derived from
 * the plan config and the VERIFIED subscription status. These are the single
 * source of truth the server uses to gate premium features and quotas.
 */
import { UNLIMITED, planIncludes, quotaFor, PLANS } from './plans';
import type { FeatureCode, PlanConfig, PlanId, QuotaKey, SubscriptionStatus } from './types';

export type EntitlementCode =
  | 'OK'
  | 'ACCOUNT_SUSPENDED'
  | 'SUBSCRIPTION_INACTIVE'
  | 'FEATURE_NOT_IN_PLAN'
  | 'QUOTA_EXCEEDED'
  | 'CONTRACT_REQUIRED';

export interface EntitlementDecision {
  readonly allowed: boolean;
  readonly code: EntitlementCode;
  readonly message: string;
  readonly feature?: FeatureCode;
  readonly quotaKey?: QuotaKey;
  readonly limit?: number;
  readonly used?: number;
}

const ACTIVE_STATES: readonly SubscriptionStatus[] = ['active', 'trialing'];

function statusGate(status: SubscriptionStatus): EntitlementDecision | null {
  if (status === 'suspended') {
    return {
      allowed: false,
      code: 'ACCOUNT_SUSPENDED',
      message: 'La cuenta está suspendida; las operaciones quedan en pausa.',
    };
  }
  return null;
}

export interface PlanEntitlements {
  readonly plan: PlanConfig;
  readonly features: readonly FeatureCode[];
  readonly quotas: Readonly<Record<QuotaKey, number>>;
  readonly unlimited: number;
}

export function planEntitlements(plan: PlanId): PlanEntitlements {
  const config = PLANS[plan];
  return Object.freeze({
    plan: config,
    features: config.features,
    quotas: config.quotas,
    unlimited: UNLIMITED,
  });
}

export function checkFeature(
  plan: PlanId,
  status: SubscriptionStatus,
  feature: FeatureCode
): EntitlementDecision {
  const gate = statusGate(status);
  if (gate) return { ...gate, feature };
  if (!ACTIVE_STATES.includes(status)) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_INACTIVE',
      message: 'Se requiere una suscripción activa para esta función.',
      feature,
    };
  }
  if (!planIncludes(plan, feature)) {
    return {
      allowed: false,
      code: 'FEATURE_NOT_IN_PLAN',
      message: `La función "${feature}" no está incluida en el plan ${PLANS[plan].label}.`,
      feature,
    };
  }
  return { allowed: true, code: 'OK', message: `Función "${feature}" habilitada.`, feature };
}

export function checkQuota(
  plan: PlanId,
  status: SubscriptionStatus,
  key: QuotaKey,
  used: number
): EntitlementDecision {
  const gate = statusGate(status);
  if (gate) return { ...gate, quotaKey: key };
  if (!ACTIVE_STATES.includes(status)) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_INACTIVE',
      message: 'Se requiere una suscripción activa para esta operación.',
      quotaKey: key,
      used,
    };
  }
  const limit = quotaFor(plan, key);
  if (limit === UNLIMITED) {
    return {
      allowed: true,
      code: 'OK',
      message: `Cuota "${key}" ilimitada.`,
      quotaKey: key,
      limit,
      used,
    };
  }
  if (used >= limit) {
    return {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      message: `Cuota "${key}" agotada (${used}/${limit}).`,
      quotaKey: key,
      limit,
      used,
    };
  }
  return {
    allowed: true,
    code: 'OK',
    message: `Cuota "${key}" disponible (${used}/${limit}).`,
    quotaKey: key,
    limit,
    used,
  };
}
