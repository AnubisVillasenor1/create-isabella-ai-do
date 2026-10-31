/**
 * Profit Guard — protects pricing from non-finite values and below-cost prices.
 *
 * marginBps is gross margin on revenue (not markup on cost):
 * price = cost / (1 - margin). A 25% margin on $100 cost means $133.34,
 * not $125.00 (which only yields a 20% gross margin).
 */
export interface ProfitContext {
  readonly cost: number;
  readonly marginBps: number; // basis points, e.g. 2500 = 25% gross margin
  readonly demandFactor?: number;
  readonly loadFactor?: number;
  readonly valueFactor?: number;
}

const MAX_MARGIN_BPS = 9_900;
const MAX_DYNAMIC_FACTOR = 10;
const cents = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100;
// Floor pricing must round UP, otherwise currency rounding can undercut the promised margin.
const centsCeiling = (amount: number): number => Math.ceil((amount - Number.EPSILON) * 100) / 100;

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`PROFIT: ${name} must be a finite number >= 0`);
  }
}

function factorOrDefault(value: number | undefined, name: string): number {
  const factor = value ?? 1;
  if (!Number.isFinite(factor) || factor <= 0 || factor > MAX_DYNAMIC_FACTOR) {
    throw new RangeError(`PROFIT: ${name} must be finite and in (0, ${MAX_DYNAMIC_FACTOR}]`);
  }
  return factor;
}

export function minimumProfitablePrice(cost: number, marginBps: number): number {
  if (!Number.isFinite(cost) || cost < 0) throw new RangeError('PROFIT: cost must be >= 0');
  if (!Number.isFinite(marginBps) || marginBps < 0)
    throw new RangeError('PROFIT: marginBps must be >= 0');
  return Math.round(cost * (1 + marginBps / 10_000) * 100) / 100;
}

export function profitablePrice(ctx: ProfitContext): number {
  const min = minimumProfitablePrice(ctx.cost, ctx.marginBps);
  const dynamic =
    ctx.cost * (ctx.demandFactor ?? 1) * (ctx.loadFactor ?? 1) * (ctx.valueFactor ?? 1);
  const candidate = Math.max(min, dynamic);
  // Fail-closed: nunca por debajo del mínimo.
  return Math.max(min, Math.round(candidate * 100) / 100);
}

/**
 * Volatile process-local accumulator for telemetry only.
 * Do not use this class as the source of truth for billing or financial reporting.
 */
export class ProfitGuard {
  private revenue = 0;
  private cost = 0;

  record(revenue: number, cost: number): void {
    assertFiniteNonNegative(revenue, 'revenue');
    assertFiniteNonNegative(cost, 'cost');
    const nextRevenue = this.revenue + cents(revenue);
    const nextCost = this.cost + cents(cost);
    if (!Number.isFinite(nextRevenue) || !Number.isFinite(nextCost)) {
      throw new RangeError('PROFIT: accounting accumulator overflow');
    }
    this.revenue = cents(nextRevenue);
    this.cost = cents(nextCost);
  }

  snapshot(): { revenue: number; cost: number; profit: number; margin: number } {
    const revenue = cents(this.revenue);
    const cost = cents(this.cost);
    const profit = cents(revenue - cost);
    const margin = revenue > 0 ? profit / revenue : 0;
    return { revenue, cost, profit, margin };
  }

  reset(): void {
    this.revenue = 0;
    this.cost = 0;
  }
}

export const profitGuard = new ProfitGuard();
