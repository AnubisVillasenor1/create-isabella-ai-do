/**
 * Immutable Double-Entry Ledger
 * state: engine-generated
 * Append-only ledger with hash chain for audit integrity.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { SettlementResult } from "./normalized-settlement";

export type LedgerAccount =
  | "GATEWAY_CLEARING"
  | "GROSS_REVENUE"
  | "DIRECT_COST"
  | "TAX_PAYABLE"
  | "GATEWAY_FEES"
  | "EMERGENCY_VAULT"
  | "INNOVATION_VAULT"
  | "TREASURY_VAULT"
  | "CREATOR_WALLET"
  | "PLATFORM_REVENUE";

export type LedgerDirection = "DEBIT" | "CREDIT";

export type LedgerPosting = {
  readonly account: LedgerAccount;
  readonly direction: LedgerDirection;
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
  return JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export class ImmutableLedger {
  private journals: Map<string, LedgerJournal> = new Map();
  private previousHash: string = "GENESIS";

  post(
    settlement: SettlementResult,
    opts: { settlementId?: string; occurredAt?: string } = {}
  ): LedgerJournal {
    const idempotencyKey = settlement.idempotencyKey;

    if (this.journals.has(idempotencyKey)) {
      return this.journals.get(idempotencyKey)!;
    }

    const postings = this.buildPostings(settlement);

    const debits = postings.filter(p => p.direction === "DEBIT").reduce((s, p) => s + p.amount, 0);
    const credits = postings.filter(p => p.direction === "CREDIT").reduce((s, p) => s + p.amount, 0);

    if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) {
      throw new Error("LEDGER: amounts must be safe integers");
    }
    if (debits !== credits) {
      throw new Error(`LEDGER_NOT_BALANCED: debits (${debits}) !== credits (${credits})`);
    }

    const payload = stableStringify({
      idempotencyKey,
      postings: postings.map(p => ({ ...p, amount: p.amount.toString() })),
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
    this.previousHash = entryHash;

    return journal;
  }

  getJournal(idempotencyKey: string): LedgerJournal | undefined {
    return this.journals.get(idempotencyKey);
  }

  getAllJournals(): readonly LedgerJournal[] {
    return Array.from(this.journals.values());
  }

  verifyChain(): boolean {
    let expectedHash = "GENESIS";
    for (const journal of Array.from(this.journals.values()).sort((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt)
    )) {
      if (journal.previousHash !== expectedHash) {
        return false;
      }
      const payload = stableStringify({
        idempotencyKey: journal.idempotencyKey,
        postings: journal.postings.map(p => ({ ...p, amount: p.amount.toString() })),
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
    return [
      { account: "GATEWAY_CLEARING", direction: "DEBIT", amount: s.grossAmount, memo: "Ingreso bruto confirmado" },
      { account: "GROSS_REVENUE", direction: "CREDIT", amount: s.grossAmount, memo: "Reconocimiento de ingreso bruto" },
      { account: "GROSS_REVENUE", direction: "DEBIT", amount: s.directCost, memo: "Coste directo atribuible" },
      { account: "DIRECT_COST", direction: "CREDIT", amount: s.directCost, memo: "Consumo de infraestructura o terceros" },
      { account: "GROSS_REVENUE", direction: "DEBIT", amount: s.taxAmount, memo: "Impuesto retenido" },
      { account: "TAX_PAYABLE", direction: "CREDIT", amount: s.taxAmount, memo: "Pasivo fiscal" },
      { account: "GROSS_REVENUE", direction: "DEBIT", amount: s.gatewayFee, memo: "Comisión real de pasarela" },
      { account: "GATEWAY_FEES", direction: "CREDIT", amount: s.gatewayFee, memo: "Gasto de pasarela" },
      { account: "GROSS_REVENUE", direction: "DEBIT", amount: s.operatingIncome, memo: "Ingreso operativo" },
      { account: "EMERGENCY_VAULT", direction: "CREDIT", amount: s.emergencyAmount, memo: "Reserva de emergencia" },
      { account: "INNOVATION_VAULT", direction: "CREDIT", amount: s.innovationAmount, memo: "Reserva de innovación" },
      { account: "TREASURY_VAULT", direction: "CREDIT", amount: s.treasuryAmount, memo: "Reserva de tesorería" },
      { account: "GROSS_REVENUE", direction: "DEBIT", amount: s.distributablePool, memo: "Pool distribuible" },
      { account: "CREATOR_WALLET", direction: "CREDIT", amount: s.userShare, memo: "Participación del creador" },
      { account: "PLATFORM_REVENUE", direction: "CREDIT", amount: s.platformShare, memo: "Participación de la plataforma" },
    ];
  }
}

export const ledger = new ImmutableLedger();