export const PLATFORM_SPLIT_ALLOCATION = Object.freeze({
  phoenixFundBps: 2_000,
  infrastructureBps: 3_000,
  daoBps: 5_000,
});

export const CREATOR_TIERS = {
  standard: { userBps: 5_000, platformBps: 5_000, label: "Estándar 50/50" },
  sovereign: { userBps: 7_500, platformBps: 2_500, label: "Soberanía 75/25" },
  elite: { userBps: 8_000, platformBps: 2_000, label: "Elite 80/20" },
} as const;

export type CreatorTier = keyof typeof CREATOR_TIERS;
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

export type RevenueSplit = {
  currency: string;
  grossCents: number;
  creatorCents: number;
  platformCents: number;
  phoenixFundCents: number;
  infrastructureCents: number;
  daoCents: number;
  creatorBps: number;
  platformBps: number;
  eligible: boolean;
  reason: string;
};

export function computeRevenueSplit(input: {
  grossCents: number;
  currency?: string;
  creatorTier: CreatorTier;
  subscriptionStatus: SubscriptionStatus;
  planId: string;
}): RevenueSplit {
  const currency = (input.currency ?? "USD").toUpperCase();
  if (!Number.isSafeInteger(input.grossCents) || input.grossCents < 0 || input.grossCents > 100_000_000) {
    throw new Error("INVALID_GROSS_CENTS");
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("INVALID_CURRENCY");
  const tier = CREATOR_TIERS[input.creatorTier];
  if (!tier) throw new Error("INVALID_CREATOR_TIER");

  const eligible = input.subscriptionStatus === "active" && input.planId !== "free";
  if (!eligible || input.grossCents === 0) {
    return {
      currency, grossCents: input.grossCents, creatorCents: 0,
      platformCents: input.grossCents, phoenixFundCents: Math.floor(input.grossCents * PLATFORM_SPLIT_ALLOCATION.phoenixFundBps / 10_000),
      infrastructureCents: Math.floor(input.grossCents * PLATFORM_SPLIT_ALLOCATION.infrastructureBps / 10_000),
      daoCents: input.grossCents - Math.floor(input.grossCents * PLATFORM_SPLIT_ALLOCATION.phoenixFundBps / 10_000) - Math.floor(input.grossCents * PLATFORM_SPLIT_ALLOCATION.infrastructureBps / 10_000),
      creatorBps: 0, platformBps: 10_000, eligible: false,
      reason: "CREATOR_REVENUE_REQUIRES_PAID_ACTIVE_SUBSCRIPTION",
    };
  }

  const creatorCents = Math.floor(input.grossCents * tier.userBps / 10_000);
  const platformCents = input.grossCents - creatorCents;
  const phoenixFundCents = Math.floor(platformCents * PLATFORM_SPLIT_ALLOCATION.phoenixFundBps / 10_000);
  const infrastructureCents = Math.floor(platformCents * PLATFORM_SPLIT_ALLOCATION.infrastructureBps / 10_000);
  const daoCents = platformCents - phoenixFundCents - infrastructureCents;

  if (creatorCents + phoenixFundCents + infrastructureCents + daoCents !== input.grossCents) {
    throw new Error("REVENUE_SPLIT_INVARIANT_FAILED");
  }

  return {
    currency, grossCents: input.grossCents, creatorCents, platformCents,
    phoenixFundCents, infrastructureCents, daoCents,
    creatorBps: tier.userBps, platformBps: tier.platformBps,
    eligible: true, reason: "PREVIEW_ONLY_NO_FUNDS_MOVED",
  };
}

export function getMonthlyPricing() {
  const referenceCents = parsePositiveInteger(process.env.ISABELLA_REFERENCE_AI_PRICE_CENTS, 2_000);
  const markupBps = parsePositiveInteger(process.env.ISABELLA_PRICE_MARKUP_BPS, 2_500);
  const monthlyCents = Math.ceil(referenceCents * (10_000 + markupBps) / 10_000);
  return {
    currency: "USD",
    referenceMonthlyCents: referenceCents,
    markupBps,
    monthlyCents,
    monthlyDisplay: (monthlyCents / 100).toFixed(2),
    pricingNote: "Precio de referencia configurable; no representa un promedio de mercado verificado. El precio publicado debe validarse antes de activar cobros.",
  };
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= 10_000_000 ? value : fallback;
}
