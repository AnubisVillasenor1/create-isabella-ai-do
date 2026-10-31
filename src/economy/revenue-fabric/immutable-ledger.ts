/**
 * Immutable Double-Entry Ledger
 * state: engine-generated
 * Append-only ledger with hash chain for audit integrity.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { SettlementResult } from './normalized-settlement';

export type LedgerAccount =
  | 'GATEWAY_CLEARING'
  | 'GROSS_REVENUE'
  | 'DIRECT_COST'
  | 'TAX_PAYABLE'
  | 'GATEWAY_FEES'
  | 'EMERGENCY_VAULT'
  | 'INNOVATION_VAULT'
  | 'TREASURY_VAULT'
  | 'CREATOR_WALLET'
  | 'PLATFORM_REVENUE'
  | 'PHOENIX_FUND'
  | 'INFRASTRUCTURE_REVENUE'
  | 'DAO_TREASURY';

export type LedgerDirection = 'DEBIT' | 'CREDIT';

export type LedgerPosting = {
  readonly account: LedgerAccount;
  readonly direction: LedgerDirection;
  /** Integer minor units (e.g. cents), never floating-point major currency. */
  readonly amount: number;
  readonly memo: string;
};

export type LedgerJournal = {
  readonly journalId: string;
  readonly idempotencyKey: string;
  readonly settlementId?: string;
  readonly postings: readonly LedgerPosting[];
  readonly previousHash: string;
  readonly entryHash: string;
  readonly occurredAt: string;
  readonly policyVersion: string;
};

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('LEDGER_AMOUNT_INVALID');
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(minor / 100 - amount) > 0.000001) {
    throw new Error('LEDGER_AMOUNT_MUST_HAVE_MAX_TWO_DECIMALS');
  }
  return minor;
}

export class ImmutableLedger {
  private journals: Map<string, LedgerJournal> = new Map();
  private fingerprints: Map<string, string> = new Map();
  private previousHash: string = 'GENESIS';

  post(
    settlement: SettlementResult,
    opts: { settlementId?: string; occurredAt?: string } = {}
  ): LedgerJournal {
    const idempotencyKey = settlement.idempotencyKey;
    const postings = this.buildPostings(settlement);
    const fingerprint = sha256(
      stableStringify({
        idempotencyKey,
        stream: settlement.stream,
        currency: settlement.currency,
        grossAmount: settlement.grossAmount,
        directCost: settlement.directCost,
        taxAmount: settlement.taxAmount,
        gatewayFee: settlement.gatewayFee,
        userShare: settlement.userShare,
        platformShare: settlement.platformShare,
        creatorId: settlement.creatorId ?? null,
        creatorEligible: settlement.creatorEligible,
        policyVersion: settlement.policyVersion,
        externalPaymentId: settlement.externalPaymentId ?? null,
      })
    );
    const prior = this.journals.get(idempotencyKey);
    if (prior) {
      const knownFingerprint = this.fingerprints.get(idempotencyKey);
      if (knownFingerprint && knownFingerprint !== fingerprint) {
        throw new Error('LEDGER_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
      }
      const priorPayload = stableStringify({
        idempotencyKey,
        postings: postings.map((p) => ({ ...p, amount: p.amount.toString() })),
        previousHash: prior.previousHash,
        occurredAt: prior.occurredAt,
      });
      if (sha256(priorPayload) !== prior.entryHash) {
        throw new Error('LEDGER_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
      }
      return prior;
    }

    const debits = postings
      .filter((p) => p.direction === 'DEBIT')
      .reduce((s, p) => s + p.amount, 0);
    const credits = postings
      .filter((p) => p.direction === 'CREDIT')
      .reduce((s, p) => s + p.amount, 0);

    if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) {
      throw new Error('LEDGER: amounts must be safe integers');
    }
    if (debits !== credits) {
      throw new Error(`LEDGER_NOT_BALANCED: debits (${debits}) !== credits (${credits})`);
    }

    const payload = stableStringify({
      idempotencyKey,
      postings: postings.map((p) => ({ ...p, amount: p.amount.toString() })),
      previousHash: this.previousHash,
      occurredAt: opts.occurredAt || settlement.occurredAt,
    });

    const entryHash = sha256(payload);

    const journal: LedgerJournal = {
      journalId: crypto.randomUUID(),
      idempotencyKey,
      settlementId: opts.settlementId,
      postings,
      previousHash: this.previousHash,
      entryHash,
      occurredAt: opts.occurredAt || settlement.occurredAt,
      policyVersion: settlement.policyVersion,
    };

    this.journals.set(idempotencyKey, journal);
    this.fingerprints.set(idempotencyKey, fingerprint);
    this.previousHash = entryHash;

    return journal;
  }

  restore(journals: readonly LedgerJournal[]): void {
    if (this.journals.size > 0) throw new Error('LEDGER_RESTORE_REQUIRES_EMPTY_INSTANCE');
    const pending = new Map(journals.map((journal) => [journal.idempotencyKey, journal]));
    let expectedPreviousHash = 'GENESIS';
    while (pending.size > 0) {
      const next = [...pending.values()].find(
        (journal) => journal.previousHash === expectedPreviousHash
      );
      if (!next) throw new Error('LEDGER_RESTORE_CHAIN_DISCONNECTED');
      const payload = stableStringify({
        idempotencyKey: next.idempotencyKey,
        postings: next.postings.map((posting) => ({
          ...posting,
          amount: posting.amount.toString(),
        })),
        previousHash: next.previousHash,
        occurredAt: next.occurredAt,
      });
      if (sha256(payload) !== next.entryHash) throw new Error('LEDGER_RESTORE_HASH_MISMATCH');
      const debits = next.postings
        .filter((posting) => posting.direction === 'DEBIT')
        .reduce((sum, posting) => sum + posting.amount, 0);
      const credits = next.postings
        .filter((posting) => posting.direction === 'CREDIT')
        .reduce((sum, posting) => sum + posting.amount, 0);
      if (!Number.isSafeInteger(debits) || debits !== credits)
        throw new Error('LEDGER_RESTORE_UNBALANCED_JOURNAL');
      this.journals.set(next.idempotencyKey, next);
      pending.delete(next.idempotencyKey);
      expectedPreviousHash = next.entryHash;
    }
    this.previousHash = expectedPreviousHash;
  }

  getJournal(idempotencyKey: string): LedgerJournal | undefined {
    return this.journals.get(idempotencyKey);
  }

  getAllJournals(): readonly LedgerJournal[] {
    return Array.from(this.journals.values());
  }

  verifyChain(): boolean {
    let expectedHash = 'GENESIS';
    for (const journal of Array.from(this.journals.values())) {
      if (journal.previousHash !== expectedHash) {
        return false;
      }
      const payload = stableStringify({
        idempotencyKey: journal.idempotencyKey,
        postings: journal.postings.map((p) => ({ ...p, amount: p.amount.toString() })),
        previousHash: journal.previousHash,
        occurredAt: journal.occurredAt,
      });
      const computedHash = sha256(payload);
      if (computedHash !== journal.entryHash) {
        return false;
      }
      expectedHash = journal.entryHash;
    }
    return true;
  }

  private buildPostings(s: SettlementResult): LedgerPosting[] {
    const postings = (
      [
        {
          account: 'GATEWAY_CLEARING',
          direction: 'DEBIT',
          amount: toMinorUnits(s.grossAmount),
          memo: 'Ingreso bruto confirmado (centavos)',
        },
        {
          account: 'GROSS_REVENUE',
          direction: 'CREDIT',
          amount: toMinorUnits(s.grossAmount),
          memo: 'Reconocimiento de ingreso bruto (centavos)',
        },
        {
          account: 'GROSS_REVENUE',
          direction: 'DEBIT',
          amount: toMinorUnits(s.directCost),
          memo: 'Coste directo atribuible (centavos)',
        },
        {
          account: 'DIRECT_COST',
          direction: 'CREDIT',
          amount: toMinorUnits(s.directCost),
          memo: 'Consumo de infraestructura o terceros (centavos)',
        },
        {
          account: 'GROSS_REVENUE',
          direction: 'DEBIT',
          amount: toMinorUnits(s.taxAmount),
          memo: 'Impuesto retenido (centavos)',
        },
        {
          account: 'TAX_PAYABLE',
          direction: 'CREDIT',
          amount: toMinorUnits(s.taxAmount),
          memo: 'Pasivo fiscal (centavos)',
        },
        {
          account: 'GROSS_REVENUE',
          direction: 'DEBIT',
          amount: toMinorUnits(s.gatewayFee),
          memo: 'Comisión real de pasarela (centavos)',
        },
        {
          account: 'GATEWAY_FEES',
          direction: 'CREDIT',
          amount: toMinorUnits(s.gatewayFee),
          memo: 'Gasto de pasarela (centavos)',
        },
        {
          account: 'GROSS_REVENUE',
          direction: 'DEBIT',
          amount: toMinorUnits(s.operatingIncome),
          memo: 'Ingreso operativo (centavos)',
        },
        {
          account: 'EMERGENCY_VAULT',
          direction: 'CREDIT',
          amount: toMinorUnits(s.emergencyAmount),
          memo: 'Reserva de emergencia (centavos)',
        },
        {
          account: 'INNOVATION_VAULT',
          direction: 'CREDIT',
          amount: toMinorUnits(s.innovationAmount),
          memo: 'Reserva de innovación (centavos)',
        },
        {
          account: 'TREASURY_VAULT',
          direction: 'CREDIT',
          amount: toMinorUnits(s.treasuryAmount),
          memo: 'Reserva de tesorería (centavos)',
        },
        {
          account: 'CREATOR_WALLET',
          direction: 'CREDIT',
          amount: toMinorUnits(s.userShare),
          memo: 'Participación del creador (centavos)',
        },
        {
          account: 'PHOENIX_FUND',
          direction: 'CREDIT',
          amount: toMinorUnits(s.platformPhoenixFund),
          memo: '20% de la parte de plataforma · Fondo Fénix (centavos)',
        },
        {
          account: 'INFRASTRUCTURE_REVENUE',
          direction: 'CREDIT',
          amount: toMinorUnits(s.platformInfrastructure),
          memo: '30% de la parte de plataforma · Infraestructura (centavos)',
        },
        {
          account: 'DAO_TREASURY',
          direction: 'CREDIT',
          amount: toMinorUnits(s.platformDao),
          memo: '50% de la parte de plataforma · DAO (centavos)',
        },
      ] as LedgerPosting[]
    ).filter((posting) => posting.amount > 0);
    return postings;
  }
}

export const ledger = new ImmutableLedger();
