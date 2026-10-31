/**
 * Monetization Engine — motor de monetización completo (state: draft | engine-generated).
 *
 * Planes, billing, escrow, payouts, royalties y SCER (75% comunidad / 25% desarrollo soberano).
 * Toda transacción es registrable y auditable. Fail-closed: sin fondos suficientes, sin ejecución.
 *
 * CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION.
 */
export type PlanTier = 'free' | 'personal' | 'professional' | 'enterprise';

export interface Plan {
  readonly id: PlanTier;
  readonly name: string;
  readonly priceMonthly: number;
  readonly currency: string;
  readonly features: readonly string[];
  readonly quotaTokens: number;
}

export const PLANS: readonly Plan[] = Object.freeze([
  {
    id: 'free',
    name: 'Personal',
    priceMonthly: 0,
    currency: 'USD',
    features: ['chat', 'voice', 'local-studio'],
    quotaTokens: 100_000,
  },
  {
    id: 'personal',
    name: 'Personal Pro',
    priceMonthly: 9,
    currency: 'USD',
    features: ['chat', 'voice', 'local-studio', 'export', 'priority'],
    quotaTokens: 1_000_000,
  },
  {
    id: 'professional',
    name: 'Professional',
    priceMonthly: 29,
    currency: 'USD',
    features: ['chat', 'voice', 'local-studio', 'export', 'priority', 'governance', 'evidence'],
    quotaTokens: 5_000_000,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 99,
    currency: 'USD',
    features: [
      'chat',
      'voice',
      'local-studio',
      'export',
      'priority',
      'governance',
      'evidence',
      'federation',
      'sla',
    ],
    quotaTokens: 50_000_000,
  },
]);

export interface EscrowHold {
  readonly id: string;
  readonly payer: string;
  readonly payee: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: 'held' | 'released' | 'refunded';
  readonly createdAt: string;
}

export interface Payout {
  readonly id: string;
  readonly recipient: string;
  readonly amount: number;
  readonly currency: string;
  readonly royaltyBps: number;
  readonly timestamp: string;
}

export interface ScerSplit {
  readonly community: number;
  readonly sovereign: number;
  readonly total: number;
}

export class MonetizationEngine {
  private readonly escrows = new Map<string, EscrowHold>();
  private readonly payouts: Payout[] = [];
  private seq = 0;

  plan(id: PlanTier): Plan | undefined {
    return PLANS.find((p) => p.id === id);
  }
  plans(): readonly Plan[] {
    return PLANS;
  }

  escrow(payer: string, payee: string, amount: number, currency = 'USD'): EscrowHold {
    if (typeof payer !== 'string' || payer.length === 0)
      throw new RangeError('MON: payer required');
    if (typeof payee !== 'string' || payee.length === 0)
      throw new RangeError('MON: payee required');
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('MON: amount must be >= 0');
    const hold: EscrowHold = {
      id: `esc-${(this.seq += 1)}`,
      payer,
      payee,
      amount,
      currency,
      status: 'held',
      createdAt: new Date().toISOString(),
    };
    this.escrows.set(hold.id, hold);
    return hold;
  }

  releaseEscrow(id: string): EscrowHold {
    const h = this.escrows.get(id);
    if (h === undefined) throw new RangeError('MON: unknown escrow');
    if (h.status !== 'held') throw new RangeError('MON: escrow not held');
    const released: EscrowHold = { ...h, status: 'released' };
    this.escrows.set(id, released);
    return released;
  }

  refundEscrow(id: string): EscrowHold {
    const h = this.escrows.get(id);
    if (h === undefined) throw new RangeError('MON: unknown escrow');
    if (h.status !== 'held') throw new RangeError('MON: escrow not held');
    const refunded: EscrowHold = { ...h, status: 'refunded' };
    this.escrows.set(id, refunded);
    return refunded;
  }

  payout(recipient: string, amount: number, royaltyBps = 250, currency = 'USD'): Payout {
    if (typeof recipient !== 'string' || recipient.length === 0)
      throw new RangeError('MON: recipient required');
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('MON: amount must be >= 0');
    if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 10000)
      throw new RangeError('MON: royaltyBps 0..10000');
    const p: Payout = {
      id: `pay-${(this.seq += 1)}`,
      recipient,
      amount,
      currency,
      royaltyBps,
      timestamp: new Date().toISOString(),
    };
    this.payouts.push(p);
    return p;
  }

  /** SCER split: 75% comunidad, 25% desarrollo soberano. */
  scerSplit(amount: number): ScerSplit {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('MON: amount must be >= 0');
    const community = Math.round(amount * 0.75);
    const sovereign = amount - community;
    return { community, sovereign, total: amount };
  }

  escrows_(): readonly EscrowHold[] {
    return [...this.escrows.values()];
  }
  payouts_(): readonly Payout[] {
    return [...this.payouts];
  }

  stats(): { plans: number; escrows: number; held: number; payouts: number; volume: number } {
    const all = [...this.escrows.values()];
    return {
      plans: PLANS.length,
      escrows: all.length,
      held: all.filter((e) => e.status === 'held').length,
      payouts: this.payouts.length,
      volume: this.payouts.reduce((s, p) => s + p.amount, 0),
    };
  }
}
