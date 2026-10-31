/**
 * Feature flags deterministas con rollout porcentual (state: draft | engine-generated).
 *
 * - Cubeta = sha256(sal:clave:sujeto) → [0,100): estable por sujeto y MONÓTONA (quien está dentro al 10%
 *   sigue dentro al 50%).
 * - Fail-closed: bandera desconocida o malformada = apagada. Un kill switch del alcance de la bandera la apaga.
 * - Una bandera CONFIGURA exposición; no concede autoridad (CAPABILITY ≠ AUTHORITY).
 */
import { createHash } from 'node:crypto';

export interface FeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
  /** 0..100 (admite decimales hasta 0.01). */
  readonly rolloutPercent: number;
  readonly allowList?: readonly string[];
  readonly denyList?: readonly string[];
  /** Alcance del kill switch que apaga la bandera (p. ej. "feature:chat"). */
  readonly killScope?: string;
  readonly salt?: string;
}

export type FlagReason =
  | 'UNKNOWN_FLAG'
  | 'INVALID_SUBJECT'
  | 'KILL_SWITCH'
  | 'DISABLED'
  | 'DENY_LIST'
  | 'ALLOW_LIST'
  | 'ROLLOUT_IN'
  | 'ROLLOUT_OUT';

export interface FlagDecision {
  readonly key: string;
  readonly enabled: boolean;
  readonly reason: FlagReason;
  readonly bucket: number | null;
}

export interface HaltSource {
  isHalted(scope: string, now?: number): boolean;
}

const KEY_RE = /^[a-z0-9][a-z0-9._:-]{0,63}$/;

export function rolloutBucket(salt: string, key: string, subject: string): number {
  const h = createHash('sha256').update(`${salt}:${key}:${subject}`).digest();
  return (h.readUInt32BE(0) % 10_000) / 100;
}

export class FeatureFlags {
  private readonly flags = new Map<string, FeatureFlag>();

  constructor(private readonly halt?: HaltSource) {}

  define(flag: FeatureFlag): void {
    if (!KEY_RE.test(flag.key)) throw new RangeError('FLAGS: invalid key');
    if (
      !Number.isFinite(flag.rolloutPercent) ||
      flag.rolloutPercent < 0 ||
      flag.rolloutPercent > 100
    )
      throw new RangeError('FLAGS: rolloutPercent must be 0..100');
    this.flags.set(
      flag.key,
      Object.freeze({
        ...flag,
        allowList: [...(flag.allowList ?? [])],
        denyList: [...(flag.denyList ?? [])],
      })
    );
  }

  evaluate(key: string, subject: string, now = Date.now()): FlagDecision {
    const flag = this.flags.get(key);
    if (flag === undefined) return { key, enabled: false, reason: 'UNKNOWN_FLAG', bucket: null };
    if (typeof subject !== 'string' || subject.length === 0 || subject.length > 256)
      return { key, enabled: false, reason: 'INVALID_SUBJECT', bucket: null };
    if (flag.killScope !== undefined && this.halt?.isHalted(flag.killScope, now))
      return { key, enabled: false, reason: 'KILL_SWITCH', bucket: null };
    if (!flag.enabled) return { key, enabled: false, reason: 'DISABLED', bucket: null };
    if (flag.denyList?.includes(subject))
      return { key, enabled: false, reason: 'DENY_LIST', bucket: null };
    if (flag.allowList?.includes(subject))
      return { key, enabled: true, reason: 'ALLOW_LIST', bucket: null };
    const bucket = rolloutBucket(flag.salt ?? '', key, subject);
    return bucket < flag.rolloutPercent
      ? { key, enabled: true, reason: 'ROLLOUT_IN', bucket }
      : { key, enabled: false, reason: 'ROLLOUT_OUT', bucket };
  }

  /** Configuración sin listas de sujetos (no expone identificadores). */
  snapshot(): readonly {
    key: string;
    enabled: boolean;
    rolloutPercent: number;
    killScope: string | null;
    allow: number;
    deny: number;
  }[] {
    return [...this.flags.values()].map((f) => ({
      key: f.key,
      enabled: f.enabled,
      rolloutPercent: f.rolloutPercent,
      killScope: f.killScope ?? null,
      allow: f.allowList?.length ?? 0,
      deny: f.denyList?.length ?? 0,
    }));
  }
}
