import { describe, expect, it } from 'vitest';
import {
  EconomicLedger,
  TreasuryRuntime,
  SettlementLedger,
  computeSettlementBreakdown,
  exactSplitByBasisPoints,
  DEFAULT_SETTLEMENT_POLICY,
} from '../../src/economy';

const POLICY = (over: Partial<typeof DEFAULT_SETTLEMENT_POLICY> = {}) => ({
  ...DEFAULT_SETTLEMENT_POLICY,
  ...over,
});

describe('SCER settlement breakdown (bigint, exact conservation)', () => {
  it('reparte bruto con la política por defecto 15/5 sin pérdida', () => {
    const b = computeSettlementBreakdown(100_000n, 'USD', POLICY());
    expect(b.platformFeeMinor).toBe('15000');
    expect(b.reserveMinor).toBe('5000');
    expect(b.creatorNetMinor).toBe('80000');
    expect(b.royaltyPoolMinor).toBe('0');
    expect(b.affiliateCommissionMinor).toBe('0');
    const sum =
      BigInt(b.platformFeeMinor) +
      BigInt(b.reserveMinor) +
      BigInt(b.affiliateCommissionMinor) +
      BigInt(b.royaltyPoolMinor) +
      BigInt(b.creatorNetMinor);
    expect(sum).toBe(100_000n);
  });

  it('sub-reparte la bolsa de regalías de forma exacta entre beneficiarios', () => {
    const b = computeSettlementBreakdown(100_000n, 'USD', POLICY({ royaltyBps: 2_000 }), [
      { partyId: 'dataset', role: 'dataset', basisPoints: 6_000 },
      { partyId: 'federation', role: 'federation', basisPoints: 4_000 },
    ]);
    expect(b.royaltyPoolMinor).toBe('20000');
    expect(b.creatorNetMinor).toBe('60000');
    expect(b.royaltyShares.map((s) => s.amountMinor)).toEqual(['12000', '8000']);
  });

  it('rechaza sobreasignación de basis points', () => {
    expect(() =>
      computeSettlementBreakdown(1000n, 'USD', POLICY({ platformFeeBps: 6000, reserveBps: 5000 }))
    ).toThrow('SETTLEMENT_POLICY_OVERALLOCATION');
  });

  it('exige beneficiarios cuando hay bolsa de regalías', () => {
    expect(() => computeSettlementBreakdown(1000n, 'USD', POLICY({ royaltyBps: 1000 }))).toThrow(
      'SETTLEMENT_ROYALTY_PARTIES_REQUIRED'
    );
  });

  it('rechaza beneficiarios sin bolsa de regalías', () => {
    expect(() =>
      computeSettlementBreakdown(1000n, 'USD', POLICY({ royaltyBps: 0 }), [
        { partyId: 'dataset', role: 'dataset', basisPoints: 10_000 },
      ])
    ).toThrow('SETTLEMENT_ROYALTY_WITHOUT_POOL');
  });

  it('el split exacto conserva el total ante fracciones de redondeo', () => {
    const split = exactSplitByBasisPoints(100n, [
      { key: 'a', bps: 3333 },
      { key: 'b', bps: 3333 },
      { key: 'c', bps: 3334 },
    ]);
    const total = [...split.values()].reduce((acc, v) => acc + v, 0n);
    expect(total).toBe(100n);
  });
});

describe('SCER settlement lifecycle (maturation + fail-closed payouts)', () => {
  function build(nowStart = '2026-01-01T00:00:00.000Z') {
    let now = nowStart;
    const clock = () => now;
    const ledger = new EconomicLedger(clock);
    const treasury = new TreasuryRuntime(ledger);
    const settlements = new SettlementLedger(treasury, ledger, clock);
    return { now: () => now, setNow: (v: string) => (now = v), ledger, treasury, settlements };
  }

  it('crea en estado held, sella settlement.computed y madura acreditando saldo', () => {
    const ctx = build();
    const rec = ctx.settlements.createSettlement({
      settlementId: 's1',
      executionId: 'e1',
      offerId: 'o1',
      creatorId: 'c1',
      grossMinor: 100_000n,
      currency: 'USD',
    });
    expect(rec.status).toBe('held');
    expect(ctx.settlements.availableBalance('c1')).toBe(0n);

    // Antes de la maduración no hay saldo.
    expect(ctx.settlements.matureSettlements()).toHaveLength(0);

    ctx.setNow('2026-01-16T00:00:00.000Z');
    const matured = ctx.settlements.matureSettlements();
    expect(matured).toHaveLength(1);
    expect(matured[0]?.status).toBe('matured');
    expect(ctx.settlements.availableBalance('c1')).toBe(80_000n);
    expect(ctx.ledger.verifyIntegrity()).toBe(true);
  });

  it('rechaza duplicados de settlementId', () => {
    const ctx = build();
    const input = {
      settlementId: 's1',
      executionId: 'e1',
      offerId: 'o1',
      creatorId: 'c1',
      grossMinor: 1000n,
      currency: 'USD',
    };
    ctx.settlements.createSettlement(input);
    expect(() => ctx.settlements.createSettlement(input)).toThrow('SETTLEMENT_DUPLICATE');
  });

  it('paga sólo con KYC, mínimo y saldo; fail-closed en cada puerta', () => {
    const ctx = build();
    ctx.settlements.createSettlement({
      settlementId: 's1',
      executionId: 'e1',
      offerId: 'o1',
      creatorId: 'c1',
      grossMinor: 100_000n,
      currency: 'USD',
    });
    ctx.setNow('2026-01-16T00:00:00.000Z');
    ctx.settlements.matureSettlements();

    // Sin KYC.
    expect(() =>
      ctx.settlements.requestPayout({ creatorId: 'c1', amountMinor: 6000n, currency: 'USD', kycVerified: false })
    ).toThrow('PAYOUT_KYC_REQUIRED');
    // Por debajo del mínimo ($50 = 5000).
    expect(() =>
      ctx.settlements.requestPayout({ creatorId: 'c1', amountMinor: 4000n, currency: 'USD', kycVerified: true })
    ).toThrow('PAYOUT_BELOW_MINIMUM');
    // Saldo insuficiente (disponible 80000).
    expect(() =>
      ctx.settlements.requestPayout({ creatorId: 'c1', amountMinor: 90_000n, currency: 'USD', kycVerified: true })
    ).toThrow('TREASURY_INSUFFICIENT_FUNDS');

    const payout = ctx.settlements.requestPayout({
      creatorId: 'c1',
      amountMinor: 20_000n,
      currency: 'USD',
      kycVerified: true,
    });
    expect(payout.status).toBe('requested');
    expect(ctx.settlements.availableBalance('c1')).toBe(60_000n);

    const paid = ctx.settlements.confirmPayoutPaid(payout.id);
    expect(paid.status).toBe('paid');
    expect(() => ctx.settlements.confirmPayoutPaid(payout.id)).toThrow('PAYOUT_ALREADY_PAID');
    expect(ctx.ledger.verifyIntegrity()).toBe(true);
  });

  it('un payout fallido por saldo NO crea registro ni drena la bóveda', () => {
    const ctx = build();
    ctx.settlements.createSettlement({
      settlementId: 's1',
      executionId: 'e1',
      offerId: 'o1',
      creatorId: 'c1',
      grossMinor: 10_000n,
      currency: 'USD',
    });
    ctx.setNow('2026-01-16T00:00:00.000Z');
    ctx.settlements.matureSettlements();
    const before = ctx.settlements.availableBalance('c1');
    expect(() =>
      ctx.settlements.requestPayout({ creatorId: 'c1', amountMinor: 999_999n, currency: 'USD', kycVerified: true })
    ).toThrow();
    expect(ctx.settlements.availableBalance('c1')).toBe(before);
    expect(ctx.settlements.listPayouts()).toHaveLength(0);
  });
});
