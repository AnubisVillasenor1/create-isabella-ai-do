/**
 * Presupuesto de costo/tokens por tenant con reservas (state: draft | engine-generated).
 *
 * Flujo: reserve(estimado) ANTES de llamar al proveedor → settle(real) o release(). Fail-closed: si la
 * reserva no cabe en el presupuesto del periodo (día UTC), se rechaza sin llamar. Montos en micro-USD
 * enteros (sin errores de coma flotante). Memoria de proceso; con varias instancias hace falta almacén compartido.
 */
export class BudgetDeniedError extends Error {
  constructor(readonly tenant: string, readonly requested: number, readonly remaining: number) {
    super(`COST_BUDGET: denied for tenant (requested ${requested}µUSD, remaining ${remaining}µUSD)`);
    this.name = "BudgetDeniedError";
  }
}

export interface Reservation {
  readonly id: string;
  readonly tenant: string;
  readonly amount: number;
  readonly period: string;
}

interface TenantState {
  period: string;
  spent: number;
  reserved: number;
  overrun: number;
}

export function estimateCostMicroUsd(tokensIn: number, tokensOut: number, usdPerMTokIn: number, usdPerMTokOut: number): number {
  for (const v of [tokensIn, tokensOut, usdPerMTokIn, usdPerMTokOut]) if (!Number.isFinite(v) || v < 0) throw new RangeError("COST_BUDGET: inputs must be finite and >= 0");
  // (tokens / 1e6) * USD/Mtok * 1e6 µUSD = tokens * USD/Mtok  (µUSD)
  return Math.ceil(tokensIn * usdPerMTokIn + tokensOut * usdPerMTokOut);
}

const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

export class CostBudget {
  private readonly tenants = new Map<string, TenantState>();
  private readonly limits = new Map<string, number>();
  private readonly open = new Map<string, Reservation>();
  private seq = 0;

  constructor(private readonly defaultDailyLimit: number, private readonly maxOpenReservations = 10_000) {
    if (!Number.isInteger(defaultDailyLimit) || defaultDailyLimit < 0) throw new RangeError("COST_BUDGET: limit must be a non-negative integer (µUSD)");
  }

  setLimit(tenant: string, dailyLimit: number): void {
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0) throw new RangeError("COST_BUDGET: limit must be a non-negative integer");
    this.limits.set(tenant, dailyLimit);
  }

  private state(tenant: string, now: number): TenantState {
    const period = utcDay(now);
    let s = this.tenants.get(tenant);
    if (s === undefined || s.period !== period) {
      // Cambio de día: el gasto cerrado se reinicia; las reservas abiertas se mantienen en su periodo original.
      s = { period, spent: 0, reserved: 0, overrun: 0 };
      this.tenants.set(tenant, s);
    }
    return s;
  }

  remaining(tenant: string, now = Date.now()): number {
    const s = this.state(tenant, now);
    return Math.max(0, (this.limits.get(tenant) ?? this.defaultDailyLimit) - s.spent - s.reserved);
  }

  reserve(tenant: string, amount: number, now = Date.now()): Reservation {
    if (typeof tenant !== "string" || tenant.length === 0 || tenant.length > 128) throw new RangeError("COST_BUDGET: invalid tenant");
    if (!Number.isInteger(amount) || amount < 0) throw new RangeError("COST_BUDGET: amount must be a non-negative integer");
    const left = this.remaining(tenant, now);
    if (amount > left || this.open.size >= this.maxOpenReservations) throw new BudgetDeniedError(tenant, amount, left);
    const s = this.state(tenant, now);
    s.reserved += amount;
    const r: Reservation = { id: `res-${(this.seq += 1)}`, tenant, amount, period: s.period };
    this.open.set(r.id, r);
    return r;
  }

  private close(id: string): { r: Reservation; s: TenantState | undefined } {
    const r = this.open.get(id);
    if (r === undefined) throw new RangeError("COST_BUDGET: unknown or already closed reservation");
    this.open.delete(id);
    const s = this.tenants.get(r.tenant);
    return { r, s: s !== undefined && s.period === r.period ? s : undefined };
  }

  /** Registra el costo real. Si excede lo reservado, el exceso se contabiliza como overrun (visible, nunca oculto). */
  settle(id: string, actual: number): { charged: number; overrun: number } {
    if (!Number.isInteger(actual) || actual < 0) throw new RangeError("COST_BUDGET: actual must be a non-negative integer");
    const { r, s } = this.close(id);
    const overrun = Math.max(0, actual - r.amount);
    if (s !== undefined) {
      s.reserved -= r.amount;
      s.spent += actual;
      s.overrun += overrun;
    }
    return { charged: actual, overrun };
  }

  /** La llamada no ocurrió: devuelve la reserva. */
  release(id: string): void {
    const { r, s } = this.close(id);
    if (s !== undefined) s.reserved -= r.amount;
  }

  usage(tenant: string, now = Date.now()): { period: string; spent: number; reserved: number; overrun: number; remaining: number } {
    const s = this.state(tenant, now);
    return { period: s.period, spent: s.spent, reserved: s.reserved, overrun: s.overrun, remaining: this.remaining(tenant, now) };
  }
}
