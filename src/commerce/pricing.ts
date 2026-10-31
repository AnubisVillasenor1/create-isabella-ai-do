import type { PlanId } from './types';

export type BillingInterval = 'month' | 'year';

export interface BillingPrice {
  id: string;
  planId: Exclude<PlanId, 'free' | 'enterprise'>;
  name: string;
  description: string;
  currency: 'usd';
  unitAmount: number;
  interval: BillingInterval;
  stripePriceId: string;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export const BILLING_PRICES: readonly BillingPrice[] = [
  {
    id: 'premium-monthly',
    planId: 'premium',
    name: 'Isabella Premium',
    description: 'Workspace personal con herramientas comerciales, analítica y créditos de IA.',
    currency: 'usd',
    unitAmount: 2500,
    interval: 'month',
    stripePriceId: env('STRIPE_PRICE_PREMIUM_MONTHLY'),
  },
  {
    id: 'premium-yearly',
    planId: 'premium',
    name: 'Isabella Premium anual',
    description: 'Premium anual con precio preferente y créditos de IA incluidos.',
    currency: 'usd',
    unitAmount: 25000,
    interval: 'year',
    stripePriceId: env('STRIPE_PRICE_PREMIUM_YEARLY'),
  },
  {
    id: 'vip-monthly',
    planId: 'vip',
    name: 'Isabella VIP',
    description: 'Automatización programada, workspaces ampliados y revisión prioritaria.',
    currency: 'usd',
    unitAmount: 7900,
    interval: 'month',
    stripePriceId: env('STRIPE_PRICE_VIP_MONTHLY'),
  },
  {
    id: 'vip-yearly',
    planId: 'vip',
    name: 'Isabella VIP anual',
    description: 'VIP anual para operación intensiva y múltiples workspaces.',
    currency: 'usd',
    unitAmount: 79000,
    interval: 'year',
    stripePriceId: env('STRIPE_PRICE_VIP_YEARLY'),
  },
];

export function billingPriceById(id: string): BillingPrice | undefined {
  return BILLING_PRICES.find((price) => price.id === id);
}

export function billingPricesPublic() {
  return BILLING_PRICES.map(({ stripePriceId: _stripePriceId, ...price }) => price);
}

export function billingPriceIsConfigured(price: BillingPrice): boolean {
  return price.stripePriceId.length > 0;
}

export function billingPricePlan(id: string): PlanId | undefined {
  return billingPriceById(id)?.planId;
}

export function billingPriceIdForPlan(
  planId: Exclude<PlanId, 'free' | 'enterprise'>,
  interval: BillingInterval
): string {
  return `${planId}-${interval === 'year' ? 'yearly' : 'monthly'}`;
}
