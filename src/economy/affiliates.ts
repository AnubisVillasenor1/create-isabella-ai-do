import { assessFraud, type FraudInput } from '../commerce/anti-fraud';
import type { FraudVerdict } from '../commerce/types';
import type { EconomicLedger } from './ledger';
import { ROYALTY_TOTAL_BASIS_POINTS } from './royalty';

// SCER Affiliate Network (state: draft | engine-generated).
// Registro de afiliados y atribución de conversiones. Cada atribución pasa por el
// motor antifraude; si el veredicto bloquea, la comisión queda en 0 y no se
// acredita. La comisión se calcula por basis points y se sella como evidencia.

export interface Affiliate {
  readonly affiliateId: string;
  readonly commissionBasisPoints: number;
}

export interface AttributionInput extends FraudInput {
  readonly affiliateId: string;
  readonly orderMinor: bigint;
  readonly reference?: string;
}

export interface CommissionResult {
  readonly affiliateId: string;
  readonly orderMinor: string;
  readonly commissionMinor: string;
  readonly status: 'pending' | 'blocked';
  readonly verdict: FraudVerdict;
}

export class AffiliateLedger {
  private readonly affiliates = new Map<string, Affiliate>();
  private readonly pendingByAffiliate = new Map<string, bigint>();

  constructor(private readonly ledger: EconomicLedger) {}

  register(affiliateId: string, commissionBasisPoints: number): Affiliate {
    if (typeof affiliateId !== 'string' || affiliateId.trim() === '') {
      throw new Error('AFFILIATE_REGISTRATION_INVALID');
    }
    if (
      !Number.isInteger(commissionBasisPoints) ||
      commissionBasisPoints < 0 ||
      commissionBasisPoints > ROYALTY_TOTAL_BASIS_POINTS
    ) {
      throw new Error('AFFILIATE_COMMISSION_BASIS_POINTS_INVALID');
    }
    const affiliate: Affiliate = { affiliateId, commissionBasisPoints };
    this.affiliates.set(affiliateId, affiliate);
    return affiliate;
  }

  pending(affiliateId: string): bigint {
    return this.pendingByAffiliate.get(affiliateId) ?? 0n;
  }

  attribute(input: AttributionInput): CommissionResult {
    const affiliate = this.affiliates.get(input.affiliateId);
    if (!affiliate) throw new Error('AFFILIATE_NOT_REGISTERED');
    if (typeof input.orderMinor !== 'bigint' || input.orderMinor <= 0n) {
      throw new Error('AFFILIATE_ORDER_INVALID');
    }

    const fraud: FraudInput = {
      selfPurchase: input.selfPurchase,
      duplicateConversion: input.duplicateConversion,
      automatedClicks: input.automatedClicks,
      duplicatedLead: input.duplicatedLead,
      relatedAccounts: input.relatedAccounts,
      anomalousTraffic: input.anomalousTraffic,
      regionChange: input.regionChange,
      highRetryRate: input.highRetryRate,
      highCancellationRate: input.highCancellationRate,
      pendingCommissionsMisreportedAsPaid: input.pendingCommissionsMisreportedAsPaid,
      missingConsent: input.missingConsent,
      rateLimitExceeded: input.rateLimitExceeded,
      unverifiedContact: input.unverifiedContact,
      credentialReuse: input.credentialReuse,
    };
    const verdict = assessFraud(fraud);

    const blocked = verdict.decision === 'block';
    const commission = blocked
      ? 0n
      : (input.orderMinor * BigInt(affiliate.commissionBasisPoints)) /
        BigInt(ROYALTY_TOTAL_BASIS_POINTS);

    if (!blocked && commission > 0n) {
      this.pendingByAffiliate.set(input.affiliateId, this.pending(input.affiliateId) + commission);
    }

    this.ledger.append({
      kind: 'affiliate.commission',
      payload: {
        affiliateId: input.affiliateId,
        orderMinor: input.orderMinor.toString(),
        commissionMinor: commission.toString(),
        status: blocked ? 'blocked' : 'pending',
        decision: verdict.decision,
        reference: input.reference,
      },
    });

    return {
      affiliateId: input.affiliateId,
      orderMinor: input.orderMinor.toString(),
      commissionMinor: commission.toString(),
      status: blocked ? 'blocked' : 'pending',
      verdict,
    };
  }

  snapshot(): Readonly<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const id of [...this.affiliates.keys()].sort()) {
      out[id] = this.pending(id).toString();
    }
    return out;
  }
}
