/**
 * Dynamic Pricing — precios dinámicos basados en demanda, uso y capacidad (state: draft | engine-generated).
 *
 * Ajusta precios según demanda, carga del sistema y valor cognitivo. Fail-closed: nunca negativo.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export interface PricingContext {
  readonly basePrice: number;
  readonly demandFactor: number;
  readonly loadFactor: number;
  readonly valueFactor: number;
}

export function dynamicPrice(ctx: PricingContext): number {
  if (!Number.isFinite(ctx.basePrice) || ctx.basePrice < 0)
    throw new RangeError('DYN: basePrice must be >= 0');
  if (!Number.isFinite(ctx.demandFactor) || ctx.demandFactor < 0)
    throw new RangeError('DYN: demandFactor must be >= 0');
  if (!Number.isFinite(ctx.loadFactor) || ctx.loadFactor < 0)
    throw new RangeError('DYN: loadFactor must be >= 0');
  if (!Number.isFinite(ctx.valueFactor) || ctx.valueFactor < 0)
    throw new RangeError('DYN: valueFactor must be >= 0');
  const raw = ctx.basePrice * ctx.demandFactor * ctx.loadFactor * ctx.valueFactor;
  return Math.max(0, Math.round(raw * 100) / 100);
}

export class DynamicPricingEngine {
  private readonly history: { price: number; ts: number }[] = [];
  private readonly maxHistory = 1000;

  price(ctx: PricingContext): number {
    const p = dynamicPrice(ctx);
    this.history.push({ price: p, ts: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();
    return p;
  }

  averagePrice(): number {
    if (this.history.length === 0) return 0;
    return this.history.reduce((s, h) => s + h.price, 0) / this.history.length;
  }

  surgeMultiplier(demand: number, capacity: number): number {
    if (capacity <= 0) return 1;
    const ratio = demand / capacity;
    if (ratio <= 1) return 1;
    return Math.min(3, 1 + (ratio - 1) * 0.5);
  }

  stats(): { samples: number; avgPrice: number } {
    return { samples: this.history.length, avgPrice: this.averagePrice() };
  }
}
