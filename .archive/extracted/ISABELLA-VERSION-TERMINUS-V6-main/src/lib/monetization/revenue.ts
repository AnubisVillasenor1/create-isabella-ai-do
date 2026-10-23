import { PLATFORM_FEE_BASIS_POINTS, type RevenueSplit } from "./types";

/**
 * COST-FIRST SOVEREIGN MONETIZATION MODEL (antes "Zero-Loss")
 * -----------------------------------------------------------------
 * Modelo prioriza costos: deduce infraestructura primero, luego reparte margen neto.
 * NO garantiza cero pérdida si infra > gross (ver rama netMargin <0) — nombre corregido para evitar claim engañoso (audit G).
 * 1. Costos de infraestructura se deducen primero (cost-first, no zero-loss guarantee).
 * 2. Split solo sobre margen neto.
 * 3. Plataforma toma fee (e.g. 15%) del margen.
 * 4. Reserva fraude/reembolso 10% del profit usuario por 90 días.
 * 5. Payouts solo desde escrow liquidado.
 */

export interface ZeroLossRevenueInput {
  grossPaidCents: number; // Total amount paid by the consumer upfront (Pre-funded)
  infrastructureCostCents: number; // Absolute cost incurred by the platform (AWS/GCP/Quantum backend)
  refundReserveRatio: number; // Ratio of user's profit held for chargeback windows (e.g. 0.10)
  communityShareRatio: number; // Ratio for territorial node community (e.g. 0.05)
}

export function splitZeroLossRevenue(input: ZeroLossRevenueInput): RevenueSplit {
  const { grossPaidCents, infrastructureCostCents, refundReserveRatio, communityShareRatio } =
    input;

  if (grossPaidCents < 0) throw new Error("grossPaidCents cannot be negative");
  if (infrastructureCostCents < 0) throw new Error("infrastructureCostCents cannot be negative");

  // 1. DEDUCT PLATFORM COSTS FIRST (Zero-Loss Guarantee)
  const netMarginCents = grossPaidCents - infrastructureCostCents;

  if (netMarginCents < 0) {
    // If infrastructure costs exceeded gross (which should never happen due to upfront pricing),
    // the platform takes a total loss, and there is $0 to distribute.
    return {
      grossAmountCents: grossPaidCents,
      infrastructureCostCents,
      platformFeeCents: 0,
      refundReserveCents: 0,
      communityShareCents: 0,
      netUserAmountCents: 0,
    };
  }

  // 2. ALLOCATE PLATFORM FEE FROM NET MARGIN
  const platformFeeCents = Math.round((netMarginCents * PLATFORM_FEE_BASIS_POINTS) / 10_000);

  // 3. ALLOCATE COMMUNITY SHARE
  const communityShareCents = Math.round(netMarginCents * communityShareRatio);

  // 4. CALCULATE USER PROFIT (Remaining)
  const userGrossProfitCents = netMarginCents - platformFeeCents - communityShareCents;

  // 5. WITHHOLD ESCROW (FRAUD/CHARGEBACK PROTECTION)
  // The reserve is taken ONLY from the user's profit. The platform secures its costs & fees immediately.
  const refundReserveCents = Math.round(userGrossProfitCents * refundReserveRatio);
  const netUserAmountCents = userGrossProfitCents - refundReserveCents;

  return {
    grossAmountCents: grossPaidCents,
    infrastructureCostCents,
    platformFeeCents,
    refundReserveCents,
    communityShareCents,
    netUserAmountCents,
  };
}

/** Verifies the invariant: Total Gross = Infrastructure + PlatformFee + Community + UserReserve + UserNet */
export function verifyZeroLossSplit(split: RevenueSplit): boolean {
  return (
    split.grossAmountCents ===
    split.infrastructureCostCents +
      split.platformFeeCents +
      split.communityShareCents +
      split.refundReserveCents +
      split.netUserAmountCents
  );
}
