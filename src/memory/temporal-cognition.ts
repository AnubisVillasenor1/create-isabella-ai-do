/**
 * Temporal Cognition Engine (YUN Ω) — memoria temporal soberana (state: draft | engine-generated).
 *
 * Gestiona pasado, presente, futuro, simulación y contrafactuales con versionado monótono y hash-chained.
 * Cada versión captura un snapshot inmutable del estado cognitivo; permite rollback, diff y contrafactual.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
import { createHash } from 'node:crypto';

export interface TemporalSnapshot<T = unknown> {
  readonly version: number;
  readonly timestamp: string;
  readonly label: string;
  readonly state: T;
  readonly parentVersion: number | null;
  readonly hash: string;
}

export interface CounterfactualResult<T> {
  readonly baseVersion: number;
  readonly scenario: string;
  readonly projectedState: T;
  readonly confidence: number;
}

export class TemporalCognitionEngine<T = unknown> {
  private readonly versions: TemporalSnapshot<T>[] = [];
  private current = 0;

  get currentVersion(): number {
    return this.current;
  }
  get size(): number {
    return this.versions.length;
  }

  record(
    state: T,
    label = 'snapshot',
    parentVersion: number | null = this.current === 0 ? null : this.current
  ): TemporalSnapshot<T> {
    const version = this.versions.length + 1;
    const timestamp = new Date().toISOString();
    const snap: Omit<TemporalSnapshot<T>, 'hash'> = {
      version,
      timestamp,
      label,
      state: structuredClone(state),
      parentVersion,
    };
    const hash = createHash('sha256').update(JSON.stringify(snap)).digest('hex');
    const full: TemporalSnapshot<T> = { ...snap, hash };
    this.versions.push(full);
    this.current = version;
    return full;
  }

  get(version: number): TemporalSnapshot<T> | undefined {
    return this.versions.find((v) => v.version === version);
  }

  list(): readonly TemporalSnapshot<T>[] {
    return [...this.versions];
  }

  rollback(version: number): TemporalSnapshot<T> {
    const target = this.get(version);
    if (target === undefined) throw new RangeError('TEMPORAL: unknown version');
    this.current = version;
    return target;
  }

  diff(fromVersion: number, toVersion: number): { from: number; to: number; changed: boolean } {
    const a = this.get(fromVersion);
    const b = this.get(toVersion);
    if (a === undefined || b === undefined) throw new RangeError('TEMPORAL: unknown version');
    return { from: fromVersion, to: toVersion, changed: a.hash !== b.hash };
  }

  /** Contrafactual: proyecta un estado derivado aplicando una transformación sobre una versión base. */
  counterfactual(
    baseVersion: number,
    scenario: string,
    transform: (state: T) => T,
    confidence = 0.5
  ): CounterfactualResult<T> {
    const base = this.get(baseVersion);
    if (base === undefined) throw new RangeError('TEMPORAL: unknown base version');
    if (confidence < 0 || confidence > 1) throw new RangeError('TEMPORAL: confidence must be 0..1');
    const projected = transform(structuredClone(base.state));
    return { baseVersion, scenario, projectedState: projected, confidence };
  }

  /** Simulación: ejecuta una función sobre el estado actual y registra el resultado como nueva versión si se solicita. */
  simulate(transform: (state: T) => T, label = 'simulation', persist = false): T {
    const cur = this.get(this.current);
    if (cur === undefined) throw new RangeError('TEMPORAL: no current state');
    const next = transform(structuredClone(cur.state));
    if (persist) this.record(next, label, this.current);
    return next;
  }

  verify(): { valid: boolean; reasons: string[]; count: number } {
    const reasons: string[] = [];
    let prev: number | null = null;
    this.versions.forEach((v, i) => {
      const recompute = createHash('sha256')
        .update(
          JSON.stringify({
            version: v.version,
            timestamp: v.timestamp,
            label: v.label,
            state: v.state,
            parentVersion: v.parentVersion,
          })
        )
        .digest('hex');
      if (recompute !== v.hash) reasons.push(`HASH_MISMATCH@${i}`);
      if (v.parentVersion !== prev && !(v.parentVersion === null && i === 0))
        reasons.push(`PARENT_MISMATCH@${i}`);
      prev = v.version;
    });
    return { valid: reasons.length === 0, reasons, count: this.versions.length };
  }
}
