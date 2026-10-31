// state: draft | engine-generated — Conciliación diaria riel ↔ ledger (Documento §7 #8).
//
// El documento establece que "BookPI es la verdad; Stripe es el riel". Ese
// principio exige una CONCILIACIÓN: comparar los movimientos que el riel de
// pagos reporta con los asiento que el ledger económico selló, y detectar
// divergencias. Este módulo es una función PURA y agnóstica del proveedor: no
// importa Stripe, no llama la red, no mueve dinero. Recibe dos listas ya
// materializadas y produce un informe de divergencias fail-open-hacia-revisión
// (una divergencia SIEMPRE se reporta, jamás se "resuelve" sola).
//
// CAPABILITY ≠ AUTHORITY ≠ EXECUTION: conciliar detecta; la acción correctiva
// (emitir un payout faltante, revertir un cobro huérfano) es humana y aprobada.

/** Un payout tal como lo registró el ledger económico (la verdad). */
export interface LedgerPayoutRef {
  readonly idempotencyKey: string;
  readonly amountMinor: bigint;
  readonly currency: string;
}

/** Un movimiento tal como lo reportó el riel externo (Stripe transfers/payouts). */
export interface ProviderPayoutRef {
  readonly idempotencyKey: string;
  readonly amountMinor: bigint;
  readonly currency: string;
}

export type ReconciliationStatus = 'reconciled' | 'divergent';

export interface ReconciliationDivergence {
  readonly kind:
    'missing_in_provider' | 'missing_in_ledger' | 'amount_mismatch' | 'currency_mismatch';
  readonly idempotencyKey: string;
  readonly ledgerAmountMinor: string | null;
  readonly providerAmountMinor: string | null;
}

export interface ReconciliationReport {
  readonly status: ReconciliationStatus;
  readonly reconciledKeys: readonly string[];
  readonly divergences: readonly ReconciliationDivergence[];
  readonly ledgerTotalMinor: string;
  readonly providerTotalMinor: string;
  readonly deltaMinor: string;
  readonly reconciledAt: string;
}

function indexByKey(
  rows: readonly { idempotencyKey: string; amountMinor: bigint; currency: string }[]
): Map<string, { amountMinor: bigint; currency: string }> {
  const map = new Map<string, { amountMinor: bigint; currency: string }>();
  for (const row of rows) {
    if (typeof row.idempotencyKey !== 'string' || row.idempotencyKey.trim() === '') {
      throw new Error('RECONCILIATION_KEY_REQUIRED');
    }
    if (typeof row.amountMinor !== 'bigint' || row.amountMinor < 0n) {
      throw new Error(`RECONCILIATION_AMOUNT_INVALID:${row.idempotencyKey}`);
    }
    if (map.has(row.idempotencyKey)) {
      throw new Error(`RECONCILIATION_DUPLICATE_KEY:${row.idempotencyKey}`);
    }
    map.set(row.idempotencyKey, { amountMinor: row.amountMinor, currency: row.currency });
  }
  return map;
}

function totalOf(map: Map<string, { amountMinor: bigint }>): bigint {
  let total = 0n;
  for (const value of map.values()) total += value.amountMinor;
  return total;
}

/**
 * Concilia el ledger económico contra el riel de pagos. Determinista y ordenado
 * por `idempotencyKey`. `deltaMinor = ledger − provider`: un delta positivo
 * indica fondos que el ledger cree debidos pero el riel no ejecutó (o cobros del
 * riel sin correlato en el ledger si es negativo por clave huérfana).
 */
export function reconcilePayouts(
  ledger: readonly LedgerPayoutRef[],
  provider: readonly ProviderPayoutRef[],
  clock: () => string = () => new Date().toISOString()
): ReconciliationReport {
  const ledgerMap = indexByKey(ledger);
  const providerMap = indexByKey(provider);

  const keys = [...new Set([...ledgerMap.keys(), ...providerMap.keys()])].sort();
  const reconciledKeys: string[] = [];
  const divergences: ReconciliationDivergence[] = [];

  for (const key of keys) {
    const l = ledgerMap.get(key);
    const p = providerMap.get(key);
    if (l && !p) {
      divergences.push({
        kind: 'missing_in_provider',
        idempotencyKey: key,
        ledgerAmountMinor: l.amountMinor.toString(),
        providerAmountMinor: null,
      });
      continue;
    }
    if (!l && p) {
      divergences.push({
        kind: 'missing_in_ledger',
        idempotencyKey: key,
        ledgerAmountMinor: null,
        providerAmountMinor: p.amountMinor.toString(),
      });
      continue;
    }
    if (l && p) {
      if (l.amountMinor !== p.amountMinor) {
        divergences.push({
          kind: 'amount_mismatch',
          idempotencyKey: key,
          ledgerAmountMinor: l.amountMinor.toString(),
          providerAmountMinor: p.amountMinor.toString(),
        });
        continue;
      }
      if (l.currency !== p.currency) {
        divergences.push({
          kind: 'currency_mismatch',
          idempotencyKey: key,
          ledgerAmountMinor: l.amountMinor.toString(),
          providerAmountMinor: p.amountMinor.toString(),
        });
        continue;
      }
      reconciledKeys.push(key);
    }
  }

  const ledgerTotal = totalOf(ledgerMap);
  const providerTotal = totalOf(providerMap);

  return {
    status: divergences.length === 0 ? 'reconciled' : 'divergent',
    reconciledKeys,
    divergences,
    ledgerTotalMinor: ledgerTotal.toString(),
    providerTotalMinor: providerTotal.toString(),
    deltaMinor: (ledgerTotal - providerTotal).toString(),
    reconciledAt: clock(),
  };
}
