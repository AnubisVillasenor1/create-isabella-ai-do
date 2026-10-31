// state: draft | engine-generated — Núcleo de Liquidación Soberana (Documento §6).
//
// Este módulo FUSIONA el flujo de liquidación y payouts del documento técnico de
// BookPI/Stripe Connect con el núcleo económico real del repo (SCER). Cubre la
// laguna genuina: existía el libro económico encadenado (`./ledger`), la bóveda
// de saldos (`./treasury`) y el reparto exacto por basis points (`./royalty`),
// pero NINGÚN módulo calculaba el ciclo de liquidación completo con maduración
// temporal y puertas de cumplimiento fail-closed.
//
// Principios aplicados (fiel al documento §7, y a AGENTS.md §1):
//   1. BookPI/ledger es la verdad económica: cada transición se sella en el
//      `EconomicLedger` encadenado. Ningún asiento se borra: se corrige con
//      entrada inversa (los estados avanzan, nunca retroceden destructivamente).
//   2. Ningún monto en flotantes: TODO se calcula en unidades menores (`bigint`).
//      (El `MonetizationEngine` legado usa `number`; este módulo lo corrige para
//      la liquidación y reutiliza el reparto exacto de `royalty.ts`.)
//   3. Ningún payout sin maduración, sin KYC y por debajo del mínimo: las puertas
//      son fail-closed. Ninguna acción financiera crítica sin CROWN: el registro
//      económico NO autoriza ni mueve dinero.
//   4. CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ PRODUCTION: calcular, firmar evidencia
//      y preparar liquidaciones no transfiere fondos. No se invoca Stripe aquí;
//      el riel de dinero es otra capa, humana y aprobada.
//
// Divergencias documentadas respecto del documento fuente (Python/orientativo):
//   - El documento firma con `createHash("sha3-512")` y "ML-DSA". Node soporta
//     SHA3-512, pero el ledger/anchor REALES del repo usan SHA-256
//     (`src/bookpi`, `src/skills/canonical-json`); mantenemos SHA-256 para
//     consistencia con la cadena verificable existente. La firma poscuántica
//     (ML-DSA) NO está disponible en este entorno → BLOCKED_ENVIRONMENT; no se
//     implementa la `signPostQuantum` del documento porque era un HMAC disfrazado
//     de PQC (haría una afirmación de seguridad falsa).
import type { EconomicLedger } from './ledger';
import type { TreasuryRuntime } from './treasury';
import { planRoyaltyDistribution, ROYALTY_TOTAL_BASIS_POINTS } from './royalty';
import type { RoyaltyParty, RoyaltyShare } from './types';

/** Denominador común de basis points (1/100 %). */
export const BASIS_POINTS_DENOMINATOR = ROYALTY_TOTAL_BASIS_POINTS;

/** Retiro mínimo por defecto: 5000 unidades menores = $50.00 USD. */
export const DEFAULT_MIN_PAYOUT_MINOR = 5000n;

/** Ventana de maduración por defecto (días) antes de liberar el saldo del creador. */
export const DEFAULT_MATURITY_DAYS = 14;

export type SettlementStatus = 'held' | 'matured' | 'closed';
export type PayoutStatus = 'requested' | 'paid';

/** Desglose exacto de una liquidación: la suma de partes IGUALA el bruto. */
export interface SettlementBreakdown {
  readonly grossMinor: string;
  readonly currency: string;
  readonly platformFeeMinor: string;
  readonly reserveMinor: string;
  readonly affiliateCommissionMinor: string;
  readonly royaltyPoolMinor: string;
  readonly creatorNetMinor: string;
  readonly royaltyShares: readonly RoyaltyShare[];
}

/** Política de reparto de primer nivel, en basis points sobre el bruto. */
export interface SettlementPolicy {
  readonly platformFeeBps: number;
  readonly reserveBps: number;
  readonly royaltyBps: number;
  readonly affiliateBps?: number;
}

/** Política por defecto del documento §6.2: 15 % plataforma, 5 % reserva. */
export const DEFAULT_SETTLEMENT_POLICY: SettlementPolicy = Object.freeze({
  platformFeeBps: 1_500,
  reserveBps: 500,
  royaltyBps: 0,
  affiliateBps: 0,
});

export interface CreateSettlementInput {
  readonly settlementId: string;
  readonly executionId: string;
  readonly offerId: string;
  readonly creatorId: string;
  readonly grossMinor: bigint;
  readonly currency: string;
  readonly policy?: SettlementPolicy;
  /** Beneficiarios de regalías (basis points suman 10 000 dentro de la bolsa de regalías). */
  readonly royaltyParties?: readonly RoyaltyParty[];
  readonly reference?: string;
}

export interface SettlementRecord {
  readonly id: string;
  readonly executionId: string;
  readonly offerId: string;
  readonly creatorId: string;
  readonly createdAt: string;
  readonly maturityDays: number;
  readonly status: SettlementStatus;
  readonly maturedAt: string | null;
  readonly breakdown: SettlementBreakdown;
}

export interface PayoutRecord {
  readonly id: string;
  readonly creatorId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly status: PayoutStatus;
  readonly requestedAt: string;
  readonly paidAt: string | null;
}

export interface RequestPayoutInput {
  readonly creatorId: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  /** Cumplimiento KYC/KYB verificado (documento §7 #7). Sin esto, fail-closed. */
  readonly kycVerified: boolean;
  readonly minPayoutMinor?: bigint;
  readonly reference?: string;
}

function assertBps(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > BASIS_POINTS_DENOMINATOR) {
    throw new Error(`SETTLEMENT_BPS_INVALID:${name}`);
  }
}

/**
 * Reparte `totalMinor` entre buckets definidos por basis points con un método de
 * resto mayor determinista: la suma de los cocientes iguala EXACTAMENTE el total
 * (sin pérdida por redondeo). Los cocientes parciales se ordenan por el residuo
 * fraccional descendente y, a igualdad, por clave ascendente.
 */
export function exactSplitByBasisPoints(
  totalMinor: bigint,
  buckets: readonly { readonly key: string; readonly bps: number }[]
): Map<string, bigint> {
  if (typeof totalMinor !== 'bigint' || totalMinor < 0n) {
    throw new Error('SETTLEMENT_TOTAL_INVALID');
  }
  const bpsSum = buckets.reduce((acc, b) => acc + b.bps, 0);
  if (bpsSum !== BASIS_POINTS_DENOMINATOR) {
    throw new Error(`SETTLEMENT_BPS_SUM_INVALID:got=${bpsSum}`);
  }
  const denom = BigInt(BASIS_POINTS_DENOMINATOR);
  const rows = buckets.map((b) => {
    const product = totalMinor * BigInt(b.bps);
    const base = product / denom;
    const frac = product % denom;
    return { key: b.key, base, frac };
  });
  const distributed = rows.reduce((acc, r) => acc + r.base, 0n);
  let remainder = totalMinor - distributed; // 0 <= remainder < buckets.length

  const order = [...rows].sort((a, b) =>
    a.frac === b.frac ? a.key.localeCompare(b.key) : b.frac > a.frac ? 1 : -1
  );
  const out = new Map<string, bigint>();
  for (const r of rows) out.set(r.key, r.base);
  for (const r of order) {
    if (remainder <= 0n) break;
    out.set(r.key, (out.get(r.key) ?? 0n) + 1n);
    remainder -= 1n;
  }
  return out;
}

/**
 * Calcula el desglose exacto de una liquidación. Invariante:
 *   platformFee + reserve + affiliate + royaltyPool + creatorNet === gross.
 * La bolsa de regalías se sub-reparte entre `royaltyParties` con reparto exacto.
 */
export function computeSettlementBreakdown(
  grossMinor: bigint,
  currency: string,
  policy: SettlementPolicy,
  royaltyParties: readonly RoyaltyParty[] = []
): SettlementBreakdown {
  if (typeof grossMinor !== 'bigint' || grossMinor < 0n) {
    throw new Error('SETTLEMENT_GROSS_INVALID');
  }
  if (typeof currency !== 'string' || currency.trim() === '') {
    throw new Error('SETTLEMENT_CURRENCY_REQUIRED');
  }
  const platformFeeBps = policy.platformFeeBps;
  const reserveBps = policy.reserveBps;
  const royaltyBps = policy.royaltyBps;
  const affiliateBps = policy.affiliateBps ?? 0;
  assertBps('platformFeeBps', platformFeeBps);
  assertBps('reserveBps', reserveBps);
  assertBps('royaltyBps', royaltyBps);
  assertBps('affiliateBps', affiliateBps);

  const claimedBps = platformFeeBps + reserveBps + royaltyBps + affiliateBps;
  if (claimedBps > BASIS_POINTS_DENOMINATOR) {
    throw new Error(`SETTLEMENT_POLICY_OVERALLOCATION:claimed=${claimedBps}`);
  }
  const creatorBps = BASIS_POINTS_DENOMINATOR - claimedBps;

  const buckets = [
    { key: 'platform', bps: platformFeeBps },
    { key: 'reserve', bps: reserveBps },
    { key: 'affiliate', bps: affiliateBps },
    { key: 'royalty', bps: royaltyBps },
    { key: 'creator', bps: creatorBps },
  ];
  const split = exactSplitByBasisPoints(grossMinor, buckets);
  const royaltyPoolMinor = split.get('royalty') ?? 0n;

  // La bolsa de regalías se sub-reparte de forma exacta entre beneficiarios.
  let royaltyShares: readonly RoyaltyShare[] = [];
  if (royaltyPoolMinor > 0n) {
    if (royaltyParties.length === 0) {
      throw new Error('SETTLEMENT_ROYALTY_PARTIES_REQUIRED');
    }
    royaltyShares = planRoyaltyDistribution(royaltyPoolMinor, royaltyParties).shares;
  } else if (royaltyParties.length > 0) {
    throw new Error('SETTLEMENT_ROYALTY_WITHOUT_POOL');
  }

  const platformFeeMinor = split.get('platform') ?? 0n;
  const reserveMinor = split.get('reserve') ?? 0n;
  const affiliateCommissionMinor = split.get('affiliate') ?? 0n;
  const creatorNetMinor = split.get('creator') ?? 0n;

  const sum =
    platformFeeMinor + reserveMinor + affiliateCommissionMinor + royaltyPoolMinor + creatorNetMinor;
  if (sum !== grossMinor) {
    // Fail-closed: jamas publicar un desglose que no concilie con el bruto.
    throw new Error('SETTLEMENT_CONSERVATION_BROKEN');
  }

  return {
    grossMinor: grossMinor.toString(),
    currency,
    platformFeeMinor: platformFeeMinor.toString(),
    reserveMinor: reserveMinor.toString(),
    affiliateCommissionMinor: affiliateCommissionMinor.toString(),
    royaltyPoolMinor: royaltyPoolMinor.toString(),
    creatorNetMinor: creatorNetMinor.toString(),
    royaltyShares,
  };
}

/**
 * Ciclo de vida de liquidaciones y payouts, sellado en el libro económico.
 * Dependencias inyectadas (`TreasuryRuntime`, `EconomicLedger`, reloj) para que
 * sea determinista y auditable en tests. NO mueve dinero ni invoca Stripe.
 */
export class SettlementLedger {
  private readonly settlements = new Map<string, SettlementRecord>();
  private readonly payouts = new Map<string, PayoutRecord>();
  private payoutSeq = 0;

  constructor(
    private readonly treasury: TreasuryRuntime,
    private readonly ledger: EconomicLedger,
    private readonly clock: () => string = () => new Date().toISOString()
  ) {}

  /** Id de parte en la bóveda para el saldo disponible de un creador. */
  private availableParty(creatorId: string): string {
    return `creator:${creatorId}`;
  }

  private assertId(name: string, value: string): void {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`SETTLEMENT_FIELD_REQUIRED:${name}`);
    }
  }

  createSettlement(input: CreateSettlementInput): SettlementRecord {
    this.assertId('settlementId', input.settlementId);
    this.assertId('executionId', input.executionId);
    this.assertId('offerId', input.offerId);
    this.assertId('creatorId', input.creatorId);
    if (this.settlements.has(input.settlementId)) {
      throw new Error(`SETTLEMENT_DUPLICATE:${input.settlementId}`);
    }
    const breakdown = computeSettlementBreakdown(
      input.grossMinor,
      input.currency,
      input.policy ?? DEFAULT_SETTLEMENT_POLICY,
      input.royaltyParties ?? []
    );
    const createdAt = this.clock();
    const record: SettlementRecord = {
      id: input.settlementId,
      executionId: input.executionId,
      offerId: input.offerId,
      creatorId: input.creatorId,
      createdAt,
      maturityDays: DEFAULT_MATURITY_DAYS,
      status: 'held',
      maturedAt: null,
      breakdown,
    };
    this.settlements.set(record.id, record);
    this.ledger.append({
      kind: 'settlement.computed',
      occurredAt: createdAt,
      payload: {
        settlementId: record.id,
        executionId: record.executionId,
        offerId: record.offerId,
        creatorId: record.creatorId,
        reference: input.reference,
        breakdown,
      },
    });
    return record;
  }

  settlement(id: string): SettlementRecord | undefined {
    return this.settlements.get(id);
  }

  list(): readonly SettlementRecord[] {
    return [...this.settlements.values()];
  }

  /**
   * Madura las liquidaciones `held` cuyo periodo de reserva/disputa venció.
   * Al madurar, acredita el neto del creador en su saldo disponible de la bóveda.
   * La reserva queda como pasivo de reserva (no se libera aquí). Idempotente por
   * settlement; cada maduración se sella una sola vez.
   */
  matureSettlements(): readonly SettlementRecord[] {
    const nowMs = Date.parse(this.clock());
    if (Number.isNaN(nowMs)) throw new Error('SETTLEMENT_CLOCK_INVALID');
    const matured: SettlementRecord[] = [];
    for (const record of [...this.settlements.values()]) {
      if (record.status !== 'held') continue;
      const matureAtMs = Date.parse(record.createdAt) + record.maturityDays * 86_400_000;
      if (nowMs < matureAtMs) continue;
      const netMinor = BigInt(record.breakdown.creatorNetMinor);
      const maturedAt = this.clock();
      const updated: SettlementRecord = { ...record, status: 'matured', maturedAt };
      this.settlements.set(record.id, updated);
      if (netMinor > 0n) {
        this.treasury.credit(this.availableParty(record.creatorId), netMinor, record.id);
      }
      this.ledger.append({
        kind: 'settlement.matured',
        occurredAt: maturedAt,
        payload: {
          settlementId: record.id,
          creatorId: record.creatorId,
          creditedMinor: netMinor.toString(),
          maturedAt,
        },
      });
      matured.push(updated);
    }
    return matured;
  }

  /** Saldo disponible (maduro) de un creador en la bóveda. */
  availableBalance(creatorId: string): bigint {
    this.assertId('creatorId', creatorId);
    return this.treasury.balance(this.availableParty(creatorId));
  }

  /**
   * Solicita un payout. Puertas fail-closed en orden:
   *   1. KYC/KYB verificado (documento §7 #7).
   *   2. Importe >= mínimo de retiro.
   *   3. Saldo disponible suficiente (débito de la bóveda, fail-closed).
   * Registra el evento; NO transfiere fondos (no hay riel de dinero aquí).
   */
  requestPayout(input: RequestPayoutInput): PayoutRecord {
    this.assertId('creatorId', input.creatorId);
    if (input.kycVerified !== true) throw new Error('PAYOUT_KYC_REQUIRED');
    const minPayout = input.minPayoutMinor ?? DEFAULT_MIN_PAYOUT_MINOR;
    if (typeof input.amountMinor !== 'bigint' || input.amountMinor <= 0n) {
      throw new Error('PAYOUT_AMOUNT_INVALID');
    }
    if (input.amountMinor < minPayout) throw new Error('PAYOUT_BELOW_MINIMUM');

    // El débito valida saldo suficiente y sella 'treasury.debit'; si falla, no
    // se crea el payout (fail-closed).
    this.treasury.debit(this.availableParty(input.creatorId), input.amountMinor, input.reference);

    this.payoutSeq += 1;
    const id = `payout-${this.payoutSeq}-${this.ledger.head()?.hash.slice(0, 8) ?? 'genesis'}`;
    const requestedAt = this.clock();
    const record: PayoutRecord = {
      id,
      creatorId: input.creatorId,
      amountMinor: input.amountMinor.toString(),
      currency: input.currency,
      status: 'requested',
      requestedAt,
      paidAt: null,
    };
    this.payouts.set(id, record);
    this.ledger.append({
      kind: 'payout.requested',
      occurredAt: requestedAt,
      payload: {
        payoutId: id,
        creatorId: input.creatorId,
        amountMinor: record.amountMinor,
        currency: input.currency,
        reference: input.reference,
      },
    });
    return record;
  }

  /**
   * Confirma el pago efectivo del riel externo (webhook Stripe→`payout.paid`,
   * documento §6.6). Marca el payout como pagado y sella la evidencia. Requiere
   * que el payout exista y esté `requested` (no permite reconfirmar → idempotente).
   */
  confirmPayoutPaid(payoutId: string): PayoutRecord {
    const record = this.payouts.get(payoutId);
    if (!record) throw new Error(`PAYOUT_NOT_FOUND:${payoutId}`);
    if (record.status === 'paid') throw new Error(`PAYOUT_ALREADY_PAID:${payoutId}`);
    const paidAt = this.clock();
    const updated: PayoutRecord = { ...record, status: 'paid', paidAt };
    this.payouts.set(payoutId, updated);
    this.ledger.append({
      kind: 'payout.released',
      occurredAt: paidAt,
      payload: { payoutId, creatorId: record.creatorId, amountMinor: record.amountMinor, paidAt },
    });
    return updated;
  }

  payout(id: string): PayoutRecord | undefined {
    return this.payouts.get(id);
  }

  listPayouts(): readonly PayoutRecord[] {
    return [...this.payouts.values()];
  }
}
