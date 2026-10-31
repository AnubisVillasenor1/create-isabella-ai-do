import type { MultiplierBound, PricingInput, PricingQuote } from './types';

// SCER Dynamic Pricing (state: draft | engine-generated).
// Motor determinista y puro: multiplica la base por cada factor (clampeado a sus
// límites) y aplica el descuento de fidelidad. Cotizar NO cobra (fundsMoved=false).

/** Límites duros por factor de precio. */
export const PRICING_BOUNDS: Readonly<Record<string, MultiplierBound>> = {
  demand: { min: 0.8, max: 2.5 },
  compute: { min: 1, max: 3 },
  scarcity: { min: 1, max: 5 },
  risk: { min: 1, max: 2 },
};

/** Descuento máximo de fidelidad (0..0.5). */
export const MAX_LOYALTY_DISCOUNT = 0.5;

function clamp(value: number, bound: MultiplierBound, factor: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Pricing factor "${factor}" must be a finite number.`);
  }
  return Math.min(bound.max, Math.max(bound.min, value));
}

/**
 * Cotiza un precio dinámico. Multiplica la base por cada factor (clampeado a sus
 * límites) y aplica el descuento de fidelidad. Devuelve el desglose completo para
 * auditoría; el precio final nunca es negativo.
 */
export function quotePrice(input: PricingInput): PricingQuote {
  if (!Number.isInteger(input.basePriceMinor) || input.basePriceMinor < 0) {
    throw new Error('Pricing basePriceMinor must be a non-negative integer (units minor).');
  }

  const factors: readonly { name: string; raw: number | undefined; bound: MultiplierBound }[] = [
    {
      name: 'demand',
      raw: input.demandMultiplier,
      bound: PRICING_BOUNDS.demand as MultiplierBound,
    },
    {
      name: 'compute',
      raw: input.computeMultiplier,
      bound: PRICING_BOUNDS.compute as MultiplierBound,
    },
    {
      name: 'scarcity',
      raw: input.scarcityMultiplier,
      bound: PRICING_BOUNDS.scarcity as MultiplierBound,
    },
    { name: 'risk', raw: input.riskMultiplier, bound: PRICING_BOUNDS.risk as MultiplierBound },
  ];

  let product = 1;
  const breakdown = factors.map(({ name, raw, bound }) => {
    const value = clamp(raw ?? 1, bound, name);
    product *= value;
    return { factor: name, value, min: bound.min, max: bound.max, applied: value !== 1 };
  });

  const discount = clamp(
    input.loyaltyDiscount ?? 0,
    { min: 0, max: MAX_LOYALTY_DISCOUNT },
    'loyaltyDiscount'
  );

  const finalPriceMinor = Math.max(0, Math.round(input.basePriceMinor * product * (1 - discount)));

  return { basePriceMinor: input.basePriceMinor, discount, finalPriceMinor, breakdown };
}
