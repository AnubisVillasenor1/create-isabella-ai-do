/**
 * Privacidad diferencial (ε-DP) con mecanismo de Laplace y contador de presupuesto
 * con composición secuencial básica. Fail-closed: si el gasto excede el presupuesto
 * NO se libera ningún valor.
 *
 * state: draft | engine-generated (pendiente de revisión humana con nombre).
 *
 * Límites honestos: ruido continuo en coma flotante IEEE-754 es vulnerable a los
 * ataques de Mironov (2012) sobre bits menos significativos; para publicación real
 * redondear la salida a una rejilla (parámetro `resolution`) o usar mecanismo
 * discreto. La composición es la básica (suma de ε); no hay RDP/zCDP.
 */
import { randomBytes } from 'node:crypto';

/** Uniforme en (0,1) con 53 bits de CSPRNG; nunca devuelve 0 ni 1. */
export function secureUniform(): number {
  const buf = randomBytes(8);
  const hi = buf.readUInt32BE(0) >>> 11; // 21 bits
  const lo = buf.readUInt32BE(4); // 32 bits
  return (hi * 2 ** 32 + lo + 0.5) / 2 ** 53;
}

export function laplaceNoise(scale: number, uniform: () => number = secureUniform): number {
  if (!Number.isFinite(scale) || scale <= 0)
    throw new RangeError('DP: scale must be a positive finite number');
  const u = uniform() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

export class BudgetExceededError extends Error {
  constructor(
    readonly requested: number,
    readonly remaining: number
  ) {
    super(`DP: privacy budget exceeded (requested ε=${requested}, remaining ε=${remaining})`);
    this.name = 'BudgetExceededError';
  }
}

export interface DpRelease {
  readonly value: number;
  readonly epsilonSpent: number;
  readonly epsilonRemaining: number;
  readonly mechanism: 'laplace';
}

export class PrivacyBudget {
  private spent = 0;
  private readonly ledger: { label: string; epsilon: number }[] = [];

  constructor(readonly totalEpsilon: number) {
    if (!Number.isFinite(totalEpsilon) || totalEpsilon <= 0)
      throw new RangeError('DP: total epsilon must be positive and finite');
  }

  get remaining(): number {
    return Math.max(0, this.totalEpsilon - this.spent);
  }

  history(): readonly { label: string; epsilon: number }[] {
    return this.ledger.map((e) => ({ ...e }));
  }

  /** Reserva ε antes de liberar; lanza si no alcanza (sin gasto parcial). */
  charge(epsilon: number, label: string): void {
    if (!Number.isFinite(epsilon) || epsilon <= 0)
      throw new RangeError('DP: epsilon must be positive and finite');
    // tolerancia mínima para errores de coma flotante al agotar exactamente el presupuesto
    if (this.spent + epsilon > this.totalEpsilon + 1e-12)
      throw new BudgetExceededError(epsilon, this.remaining);
    this.spent += epsilon;
    this.ledger.push({ label, epsilon });
  }

  private release(
    trueValue: number,
    sensitivity: number,
    epsilon: number,
    label: string,
    resolution: number,
    uniform: () => number
  ): DpRelease {
    if (!Number.isFinite(trueValue)) throw new RangeError('DP: true value must be finite');
    if (!Number.isFinite(sensitivity) || sensitivity <= 0)
      throw new RangeError('DP: sensitivity must be positive and finite');
    if (!Number.isFinite(resolution) || resolution <= 0)
      throw new RangeError('DP: resolution must be positive and finite');
    this.charge(epsilon, label);
    const noisy = trueValue + laplaceNoise(sensitivity / epsilon, uniform);
    const value = Math.round(noisy / resolution) * resolution;
    return { value, epsilonSpent: epsilon, epsilonRemaining: this.remaining, mechanism: 'laplace' };
  }

  /** Conteo con sensibilidad 1 (adyacencia: añadir/quitar un individuo). */
  count(
    trueCount: number,
    epsilon: number,
    label = 'count',
    uniform: () => number = secureUniform
  ): DpRelease {
    if (!Number.isInteger(trueCount) || trueCount < 0)
      throw new RangeError('DP: count must be a non-negative integer');
    return this.release(trueCount, 1, epsilon, label, 1, uniform);
  }

  /** Suma con recorte a [lower, upper]; sensibilidad = max(|lower|,|upper|) (adyacencia añadir/quitar). */
  sum(
    values: readonly number[],
    lower: number,
    upper: number,
    epsilon: number,
    label = 'sum',
    uniform: () => number = secureUniform
  ): DpRelease {
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper)
      throw new RangeError('DP: invalid clamp bounds');
    const sensitivity = Math.max(Math.abs(lower), Math.abs(upper));
    if (sensitivity === 0) throw new RangeError('DP: clamp bounds must not both be zero');
    let total = 0;
    for (const v of values) {
      if (!Number.isFinite(v)) throw new RangeError('DP: values must be finite');
      total += Math.min(upper, Math.max(lower, v));
    }
    return this.release(total, sensitivity, epsilon, label, 1e-6, uniform);
  }
}
