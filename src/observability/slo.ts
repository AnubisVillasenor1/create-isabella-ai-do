/**
 * SLO y alertas por quema de presupuesto de error, multi-ventana multi-tasa
 * (Google SRE Workbook, cap. 5) — state: draft | engine-generated.
 *
 * burnRate = tasaDeError / (1 − objetivo). Una alerta exige que AMBAS ventanas (larga y corta) superen
 * el umbral: la larga da significancia, la corta evita alertar por algo que ya terminó.
 * Memoria acotada: cubetas por minuto con retención de 3 días. Métricas locales al proceso.
 */
export interface BurnRule {
  readonly id: string;
  readonly severity: 'PAGE' | 'TICKET';
  readonly burnRate: number;
  readonly longWindowMs: number;
  readonly shortWindowMs: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

export const DEFAULT_BURN_RULES: readonly BurnRule[] = Object.freeze([
  {
    id: 'fast-burn-1h',
    severity: 'PAGE',
    burnRate: 14.4,
    longWindowMs: HOUR,
    shortWindowMs: 5 * MIN,
  },
  { id: 'burn-6h', severity: 'PAGE', burnRate: 6, longWindowMs: 6 * HOUR, shortWindowMs: 30 * MIN },
  {
    id: 'slow-burn-1d',
    severity: 'TICKET',
    burnRate: 3,
    longWindowMs: 24 * HOUR,
    shortWindowMs: 2 * HOUR,
  },
  {
    id: 'slow-burn-3d',
    severity: 'TICKET',
    burnRate: 1,
    longWindowMs: 72 * HOUR,
    shortWindowMs: 6 * HOUR,
  },
]);

export interface SloAlert {
  readonly rule: string;
  readonly severity: 'PAGE' | 'TICKET';
  readonly burnLong: number;
  readonly burnShort: number;
}

export function burnRate(errorRatio: number, objective: number): number {
  if (!(objective > 0 && objective < 1)) throw new RangeError('SLO: objective must be in (0,1)');
  if (!(errorRatio >= 0 && errorRatio <= 1))
    throw new RangeError('SLO: errorRatio must be in [0,1]');
  return errorRatio / (1 - objective);
}

export class SloTracker {
  private readonly buckets = new Map<number, { good: number; bad: number }>();
  private readonly retentionMs = 72 * HOUR;

  constructor(
    readonly objective: number,
    private readonly rules: readonly BurnRule[] = DEFAULT_BURN_RULES
  ) {
    if (!(objective > 0 && objective < 1)) throw new RangeError('SLO: objective must be in (0,1)');
    for (const r of rules) {
      if (
        !(r.burnRate > 0) ||
        !(r.shortWindowMs > 0) ||
        r.shortWindowMs > r.longWindowMs ||
        r.longWindowMs > this.retentionMs
      )
        throw new RangeError(`SLO: invalid rule ${r.id}`);
    }
  }

  record(success: boolean, now = Date.now()): void {
    const key = Math.floor(now / MIN);
    const b = this.buckets.get(key) ?? { good: 0, bad: 0 };
    if (success) b.good += 1;
    else b.bad += 1;
    this.buckets.set(key, b);
    if (this.buckets.size > this.retentionMs / MIN + 5) this.prune(now);
  }

  private prune(now: number): void {
    const min = Math.floor((now - this.retentionMs) / MIN);
    for (const k of this.buckets.keys()) if (k < min) this.buckets.delete(k);
  }

  /** Proporción de errores en la ventana, o null si no hay tráfico (no se inventa un 0%). */
  errorRatio(windowMs: number, now = Date.now()): number | null {
    if (!(windowMs > 0) || windowMs > this.retentionMs)
      throw new RangeError('SLO: window out of range');
    const from = Math.floor((now - windowMs) / MIN) + 1;
    const to = Math.floor(now / MIN);
    let good = 0;
    let bad = 0;
    for (let k = from; k <= to; k += 1) {
      const b = this.buckets.get(k);
      if (b !== undefined) {
        good += b.good;
        bad += b.bad;
      }
    }
    const total = good + bad;
    return total === 0 ? null : bad / total;
  }

  evaluate(now = Date.now()): SloAlert[] {
    const alerts: SloAlert[] = [];
    for (const r of this.rules) {
      const long = this.errorRatio(r.longWindowMs, now);
      const short = this.errorRatio(r.shortWindowMs, now);
      if (long === null || short === null) continue;
      const burnLong = burnRate(long, this.objective);
      const burnShort = burnRate(short, this.objective);
      if (burnLong >= r.burnRate && burnShort >= r.burnRate)
        alerts.push({ rule: r.id, severity: r.severity, burnLong, burnShort });
    }
    return alerts;
  }

  /** Fracción del presupuesto consumida en la ventana (1 = agotado). null sin tráfico. */
  budgetConsumed(windowMs: number, now = Date.now()): number | null {
    const ratio = this.errorRatio(windowMs, now);
    return ratio === null ? null : ratio / (1 - this.objective);
  }
}
