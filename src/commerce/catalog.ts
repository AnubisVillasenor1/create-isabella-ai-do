/**
 * state: engine-generated
 * COMMERCE — presentation catalog derived ONLY from server prices and plan configs.
 * Adds what the raw price list hides: annual savings, effective monthly price, a single
 * "recommended" plan, human labels for quotas/features. Pure; no payment, no authority granted.
 * CAPABILITY ≠ AUTHORITY: showing a plan never entitles anyone to it — entitlements stay with verified subscriptions.
 */
import { BILLING_PRICES, type BillingPrice } from './pricing';
import { PLAN_ORDER, PLANS, UNLIMITED } from './plans';
import type { PlanId, QuotaKey } from './types';

export interface CatalogPrice {
  readonly id: string;
  readonly interval: 'month' | 'year';
  readonly unitAmount: number;
  /** Price per month in minor units; yearly prices are divided by 12 and rounded. */
  readonly effectiveMonthly: number;
  readonly configured: boolean;
}

export interface CatalogPlan {
  readonly id: PlanId;
  readonly label: string;
  readonly description: string;
  readonly recommended: boolean;
  readonly contactSales: boolean;
  readonly monthly: CatalogPrice | null;
  readonly yearly: CatalogPrice | null;
  /** Percent saved by paying yearly vs 12 monthly payments (0 when not comparable). */
  readonly yearlySavingsPct: number;
  /** Whole-or-fractional months free implied by the yearly price (rounded to 0.1). */
  readonly monthsFree: number;
  readonly highlights: readonly string[];
}

export interface PricingCatalog {
  readonly currency: 'usd';
  readonly recommendedPlan: PlanId;
  readonly plans: readonly CatalogPlan[];
  readonly disclaimer: string;
}

const QUOTA_LABELS: Readonly<Record<QuotaKey, string>> = {
  active_offers: 'ofertas activas',
  active_campaigns: 'campañas activas',
  connections_per_platform: 'conexiones por plataforma',
  attribution_events_per_day: 'eventos de atribución al día',
  leads_per_month: 'leads al mes',
  workspaces: 'workspaces',
};

const HIGHLIGHT_QUOTAS: readonly QuotaKey[] = [
  'workspaces',
  'active_offers',
  'active_campaigns',
  'leads_per_month',
];

export const RECOMMENDED_PLAN: PlanId = 'premium';

const fmt = (n: number): string => n.toLocaleString('es-MX');

function toCatalogPrice(p: BillingPrice): CatalogPrice {
  return {
    id: p.id,
    interval: p.interval,
    unitAmount: p.unitAmount,
    effectiveMonthly: p.interval === 'year' ? Math.round(p.unitAmount / 12) : p.unitAmount,
    configured: p.stripePriceId.length > 0,
  };
}

export function yearlySavings(
  monthly: number,
  yearly: number
): { pct: number; monthsFree: number } {
  if (!(monthly > 0) || !(yearly > 0)) return { pct: 0, monthsFree: 0 };
  const full = monthly * 12;
  if (yearly >= full) return { pct: 0, monthsFree: 0 };
  return {
    pct: Math.round(((full - yearly) / full) * 1000) / 10,
    monthsFree: Math.round(((full - yearly) / monthly) * 10) / 10,
  };
}

function highlightsFor(plan: PlanId): string[] {
  const config = PLANS[plan];
  const out: string[] = [];
  for (const key of HIGHLIGHT_QUOTAS) {
    const limit = config.quotas[key];
    if (limit === 0) continue;
    const label = limit === 1 && key === 'workspaces' ? 'workspace' : QUOTA_LABELS[key];
    out.push(limit === UNLIMITED ? `${label} ilimitados` : `${fmt(limit)} ${label}`);
  }
  if (config.features.length > 0)
    out.push(`${config.features.length} capacidades comerciales incluidas`);
  return out;
}

export function buildPricingCatalog(
  prices: readonly BillingPrice[] = BILLING_PRICES
): PricingCatalog {
  const plans: CatalogPlan[] = PLAN_ORDER.map((id) => {
    const config = PLANS[id];
    const month = prices.find((p) => p.planId === id && p.interval === 'month');
    const year = prices.find((p) => p.planId === id && p.interval === 'year');
    const savings =
      month && year ? yearlySavings(month.unitAmount, year.unitAmount) : { pct: 0, monthsFree: 0 };
    return {
      id,
      label: config.label,
      description: config.description,
      recommended: id === RECOMMENDED_PLAN,
      contactSales: config.contractRequired,
      monthly: month ? toCatalogPrice(month) : null,
      yearly: year ? toCatalogPrice(year) : null,
      yearlySavingsPct: savings.pct,
      monthsFree: savings.monthsFree,
      highlights: highlightsFor(id),
    };
  });
  return {
    currency: 'usd',
    recommendedPlan: RECOMMENDED_PLAN,
    plans,
    disclaimer:
      'Isabella registra el estado verificado de la suscripción; el cobro lo procesa un proveedor externo. Esta vista no cobra ni concede acceso.',
  };
}
