/**
 * Jerarquía de claves con separación de propósito (HKDF-SHA256) y rotación en dos
 * fases (PREPARE → COMMIT), alineada con el diseño ISA-X (KEK/IK/BK/SK).
 *
 * state: draft | engine-generated (pendiente de revisión humana con nombre).
 *
 * Una clave derivada para un propósito/época/contexto NO sirve para otro. Tras
 * COMMIT, la época anterior queda en "retiring" (solo verificación/descifrado)
 * hasta `retireAfter`; luego se rechaza. No hay almacenamiento de claves derivadas:
 * se derivan bajo demanda de la raíz (que el llamador custodia, p. ej. en HSM/KMS).
 */
import { hkdfSync, randomBytes } from 'node:crypto';

export type KeyPurpose = 'KEK' | 'IK' | 'BK' | 'SK';
export const KEY_PURPOSES: readonly KeyPurpose[] = ['KEK', 'IK', 'BK', 'SK'];

export type EpochState = 'ACTIVE' | 'PREPARED' | 'RETIRING' | 'RETIRED';

export type KeyUse = 'protect' | 'verify';

interface EpochInfo {
  state: EpochState;
  retireAfter?: number;
}

export class KeyHierarchy {
  private readonly epochs = new Map<number, EpochInfo>();
  private active = 1;
  private readonly root: Buffer;

  constructor(
    rootSecret: Buffer,
    private readonly graceMs: number = 24 * 60 * 60 * 1000
  ) {
    if (!Buffer.isBuffer(rootSecret) || rootSecret.length < 32)
      throw new Error('KEYS: root secret must be a Buffer of at least 32 bytes');
    if (!Number.isFinite(graceMs) || graceMs < 0)
      throw new RangeError('KEYS: graceMs must be >= 0');
    this.root = Buffer.from(rootSecret);
    this.epochs.set(1, { state: 'ACTIVE' });
  }

  static generateRoot(): Buffer {
    return randomBytes(32);
  }

  get activeEpoch(): number {
    return this.active;
  }

  stateOf(epoch: number, now: number = Date.now()): EpochState | undefined {
    const info = this.epochs.get(epoch);
    if (info === undefined) return undefined;
    if (info.state === 'RETIRING' && info.retireAfter !== undefined && now >= info.retireAfter) {
      info.state = 'RETIRED';
    }
    return info.state;
  }

  /** Fase 1: anuncia la época siguiente (aún no se usa para proteger). Idempotente. */
  prepareRotation(): number {
    const next = this.active + 1;
    if (!this.epochs.has(next)) this.epochs.set(next, { state: 'PREPARED' });
    return next;
  }

  /** Fase 2: la época preparada pasa a ACTIVA; la anterior queda RETIRING con gracia. */
  commitRotation(now: number = Date.now()): number {
    const next = this.active + 1;
    const info = this.epochs.get(next);
    if (info === undefined || info.state !== 'PREPARED')
      throw new Error('KEYS: no prepared epoch to commit');
    const previous = this.epochs.get(this.active);
    if (previous !== undefined) {
      previous.state = 'RETIRING';
      previous.retireAfter = now + this.graceMs;
    }
    info.state = 'ACTIVE';
    this.active = next;
    return next;
  }

  abortRotation(): void {
    const next = this.active + 1;
    if (this.epochs.get(next)?.state === 'PREPARED') this.epochs.delete(next);
  }

  /** Revoca inmediatamente todas las épocas anteriores a la activa (compromiso de clave). */
  emergencyRetireOlder(): void {
    for (const [epoch, info] of this.epochs) {
      if (epoch < this.active) info.state = 'RETIRED';
    }
  }

  /**
   * Deriva una clave de 32 bytes. `protect` solo en época ACTIVA; `verify` también
   * en RETIRING. Épocas PREPARED/RETIRED/inexistentes se rechazan.
   */
  derive(
    purpose: KeyPurpose,
    context: string,
    use: KeyUse = 'protect',
    epoch: number = this.active,
    now: number = Date.now()
  ): Buffer {
    if (!KEY_PURPOSES.includes(purpose)) throw new Error('KEYS: unknown purpose');
    if (
      typeof context !== 'string' ||
      context.length === 0 ||
      context.length > 256 ||
      context.includes('\n')
    ) {
      throw new Error('KEYS: context must be a non-empty single-line string up to 256 chars');
    }
    const state = this.stateOf(epoch, now);
    if (state === undefined) throw new Error('KEYS: unknown epoch');
    if (state === 'RETIRED') throw new Error('KEYS: epoch retired');
    if (state === 'PREPARED') throw new Error('KEYS: epoch not yet active');
    if (state === 'RETIRING' && use === 'protect')
      throw new Error('KEYS: retiring epoch is verify-only');
    const info = `TAMV-ISA-X/v1/${purpose}/${epoch}/${context}`;
    return Buffer.from(hkdfSync('sha256', this.root, Buffer.alloc(0), info, 32));
  }
}
