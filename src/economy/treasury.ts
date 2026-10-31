import type { EconomicLedger } from './ledger';

// SCER Treasury Runtime (state: draft | engine-generated).
// Bóveda de saldos por parte. Cada movimiento se valida (importe > 0, saldo
// suficiente) y se sella como evidencia en el libro económico. Registrar un
// asiento aquí NO transfiere dinero real: es contabilidad interna auditables.

export interface TreasuryMovement {
  readonly partyId: string;
  readonly amountMinor: string;
  readonly balanceMinor: string;
  readonly reference?: string;
}

export class TreasuryRuntime {
  private readonly balances = new Map<string, bigint>();

  constructor(private readonly ledger: EconomicLedger) {}

  private assertParty(partyId: string): void {
    if (typeof partyId !== 'string' || partyId.trim() === '') {
      throw new Error('TREASURY_PARTY_REQUIRED');
    }
  }

  private assertAmount(amountMinor: bigint): void {
    if (typeof amountMinor !== 'bigint') {
      throw new Error('TREASURY_AMOUNT_INVALID');
    }
    if (amountMinor <= 0n) {
      throw new Error('TREASURY_AMOUNT_INVALID');
    }
  }

  balance(partyId: string): bigint {
    this.assertParty(partyId);
    return this.balances.get(partyId) ?? 0n;
  }

  credit(partyId: string, amountMinor: bigint, reference?: string): TreasuryMovement {
    this.assertParty(partyId);
    this.assertAmount(amountMinor);
    const balance = (this.balances.get(partyId) ?? 0n) + amountMinor;
    this.balances.set(partyId, balance);
    this.ledger.append({
      kind: 'treasury.credit',
      payload: {
        partyId,
        amountMinor: amountMinor.toString(),
        balanceMinor: balance.toString(),
        reference,
      },
    });
    return {
      partyId,
      amountMinor: amountMinor.toString(),
      balanceMinor: balance.toString(),
      reference,
    };
  }

  debit(partyId: string, amountMinor: bigint, reference?: string): TreasuryMovement {
    this.assertParty(partyId);
    this.assertAmount(amountMinor);
    const current = this.balances.get(partyId) ?? 0n;
    if (current < amountMinor) {
      throw new Error('TREASURY_INSUFFICIENT_FUNDS');
    }
    const balance = current - amountMinor;
    this.balances.set(partyId, balance);
    this.ledger.append({
      kind: 'treasury.debit',
      payload: {
        partyId,
        amountMinor: amountMinor.toString(),
        balanceMinor: balance.toString(),
        reference,
      },
    });
    return {
      partyId,
      amountMinor: amountMinor.toString(),
      balanceMinor: balance.toString(),
      reference,
    };
  }

  snapshot(): Readonly<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const partyId of [...this.balances.keys()].sort()) {
      out[partyId] = (this.balances.get(partyId) ?? 0n).toString();
    }
    return out;
  }

  totalMinor(): bigint {
    let total = 0n;
    for (const value of this.balances.values()) total += value;
    return total;
  }
}
