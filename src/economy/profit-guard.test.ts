import { describe, expect, it } from 'vitest';
import { ProfitGuard, minimumProfitablePrice, profitablePrice } from './profit-guard';

describe('minimumProfitablePrice', () => {
  it('calculates gross margin on revenue rather than markup on cost', () => {
    expect(minimumProfitablePrice(100, 2_500)).toBe(133.34);
    expect(minimumProfitablePrice(100, 0)).toBe(100);
  });

  it('handles zero cost and rounds to cents', () => {
    expect(minimumProfitablePrice(0, 9_900)).toBe(0);
    expect(minimumProfitablePrice(10.005, 0)).toBe(10.01);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid cost %s', (cost) => {
    expect(() => minimumProfitablePrice(cost, 2_500)).toThrow(RangeError);
  });

  it.each([-1, 10_000, 2_500.5, Number.NaN])('rejects invalid margin %s', (margin) => {
    expect(() => minimumProfitablePrice(100, margin)).toThrow(RangeError);
  });
});

describe('profitablePrice', () => {
  it('never prices below the gross-margin floor', () => {
    expect(profitablePrice({ cost: 100, marginBps: 2_500, demandFactor: 1 })).toBe(133.34);
  });

  it('allows bounded dynamic pricing above the floor', () => {
    expect(profitablePrice({ cost: 100, marginBps: 2_500, demandFactor: 2 })).toBe(200);
  });

  it('rejects non-finite, zero, negative, or excessive dynamic factors', () => {
    for (const demandFactor of [0, -1, 11, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => profitablePrice({ cost: 100, marginBps: 2_500, demandFactor })).toThrow(
        RangeError
      );
    }
  });
});

describe('ProfitGuard', () => {
  it('validates and rounds records before accumulating', () => {
    const guard = new ProfitGuard();
    guard.record(120.005, 80);
    expect(guard.snapshot()).toEqual({
      revenue: 120.01,
      cost: 80,
      profit: 40.01,
      margin: 40.01 / 120.01,
    });
  });

  it('rejects negative and non-finite amounts', () => {
    const guard = new ProfitGuard();
    expect(() => guard.record(-1, 0)).toThrow(RangeError);
    expect(() => guard.record(0, Number.NaN)).toThrow(RangeError);
  });

  it('can reset its volatile telemetry counters', () => {
    const guard = new ProfitGuard();
    guard.record(120, 80);
    guard.reset();
    expect(guard.snapshot()).toEqual({ revenue: 0, cost: 0, profit: 0, margin: 0 });
  });
});
