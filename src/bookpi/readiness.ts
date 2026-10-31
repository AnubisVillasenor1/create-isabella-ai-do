import type { BookPiVerification } from './ledger';

export interface LegacyBookPiReadiness {
  status: 'healthy' | 'degraded';
  backend: string;
  valid: boolean;
  durable: boolean;
  reason: string;
}

/**
 * Readiness for the synchronous legacy ledger. A valid in-memory chain is not
 * production-ready because it disappears on process restart. A verified durable
 * local chain is healthy only for this component; it does not imply shared HA.
 */
export function inspectLegacyBookPiLedger(
  verify: () => Pick<BookPiVerification, 'storage' | 'valid' | 'durable'>
): LegacyBookPiReadiness {
  try {
    const result = verify();
    if (!result.valid) {
      return {
        status: 'degraded',
        backend: result.storage,
        valid: false,
        durable: result.durable,
        reason: 'Legacy BookPI chain verification failed; inspect the restricted operator report.',
      };
    }
    if (result.durable) {
      return {
        status: 'healthy',
        backend: result.storage,
        valid: true,
        durable: true,
        reason:
          'Legacy BookPI durable local chain verified; this is not shared PostgreSQL durability.',
      };
    }
    return {
      status: 'degraded',
      backend: result.storage,
      valid: true,
      durable: false,
      reason:
        'Legacy BookPI in-memory chain is valid but volatile; events will not survive process restart.',
    };
  } catch {
    return {
      status: 'degraded',
      backend: 'UNKNOWN',
      valid: false,
      durable: false,
      reason: 'Legacy BookPI ledger is unavailable or requires maintenance recovery.',
    };
  }
}
