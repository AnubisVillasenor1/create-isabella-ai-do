import { describe, expect, it } from 'vitest';
import { reconcilePayouts } from '../../src/economy';

const clock = () => '2026-01-20T00:00:00.000Z';

describe('SCER riel ↔ ledger reconciliation', () => {
  it('concilia cuando ledger y riel coinciden', () => {
    const report = reconcilePayouts(
      [{ idempotencyKey: 'k1', amountMinor: 5000n, currency: 'USD' }],
      [{ idempotencyKey: 'k1', amountMinor: 5000n, currency: 'USD' }],
      clock
    );
    expect(report.status).toBe('reconciled');
    expect(report.reconciledKeys).toEqual(['k1']);
    expect(report.divergences).toHaveLength(0);
    expect(report.deltaMinor).toBe('0');
  });

  it('detecta un pago debido ausente en el riel', () => {
    const report = reconcilePayouts(
      [{ idempotencyKey: 'k1', amountMinor: 5000n, currency: 'USD' }],
      [],
      clock
    );
    expect(report.status).toBe('divergent');
    expect(report.divergences[0]?.kind).toBe('missing_in_provider');
    expect(report.deltaMinor).toBe('5000');
  });

  it('detecta un cobro del riel sin correlato en el ledger', () => {
    const report = reconcilePayouts(
      [],
      [{ idempotencyKey: 'x', amountMinor: 3000n, currency: 'USD' }],
      clock
    );
    expect(report.divergences[0]?.kind).toBe('missing_in_ledger');
    expect(report.deltaMinor).toBe('-3000');
  });

  it('detecta discrepancia de monto y de moneda', () => {
    const report = reconcilePayouts(
      [
        { idempotencyKey: 'a', amountMinor: 1000n, currency: 'USD' },
        { idempotencyKey: 'b', amountMinor: 2000n, currency: 'USD' },
      ],
      [
        { idempotencyKey: 'a', amountMinor: 1500n, currency: 'USD' },
        { idempotencyKey: 'b', amountMinor: 2000n, currency: 'EUR' },
      ],
      clock
    );
    const kinds = report.divergences.map((d) => d.kind).sort();
    expect(kinds).toEqual(['amount_mismatch', 'currency_mismatch']);
  });

  it('ordena las divergencias por clave y rechaza claves duplicadas', () => {
    expect(() =>
      reconcilePayouts(
        [
          { idempotencyKey: 'k', amountMinor: 1n, currency: 'USD' },
          { idempotencyKey: 'k', amountMinor: 2n, currency: 'USD' },
        ],
        [],
        clock
      )
    ).toThrow('RECONCILIATION_DUPLICATE_KEY');
  });

  it('rechaza montos negativos o claves vacías', () => {
    expect(() =>
      reconcilePayouts([{ idempotencyKey: 'k', amountMinor: -1n, currency: 'USD' }], [], clock)
    ).toThrow('RECONCILIATION_AMOUNT_INVALID');
    expect(() =>
      reconcilePayouts([{ idempotencyKey: '', amountMinor: 1n, currency: 'USD' }], [], clock)
    ).toThrow('RECONCILIATION_KEY_REQUIRED');
  });
});
