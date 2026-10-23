/**
 * BookPI Royalty Settlement — liquidación exacta en BigInt de micro-derechos de
 * autor hacia las 7 federaciones del ecosistema TAMV.
 *
 * Se usa aritmética entera de unidades indivisibles (Wei/Satoshis) para evitar
 * pérdidas por redondeo: el remanente exacto se asigna a la última federación.
 */

export const BASIS_POINTS_DIVISOR = 10_000n;
export const TOTAL_BASIS_POINTS = 10_000;

export interface FederationShare {
  federationId: number;
  basisPoints: number;
  walletAddress: string;
}

export interface RoyaltySplit {
  federationId: number;
  basisPoints: number;
  payoutAmountWei: string;
  walletAddress: string;
}

export interface RoyaltySettlement {
  totalRevenueWei: string;
  splits: readonly RoyaltySplit[];
  distributedWei: string;
  remainderWei: string;
}

/**
 * Calcula el reparto exacto de regalías. `totalRevenueWei` y los resultados se
 * expresan como cadenas decimales para no perder precisión fuera del rango Number.
 */
export function calculateBookPiRoyalties(
  totalRevenueWei: bigint,
  federationShares: readonly FederationShare[],
): RoyaltySplit[] {
  if (totalRevenueWei < 0n) throw new Error("BOOKPI: totalRevenueWei cannot be negative");
  if (federationShares.length === 0) throw new Error("BOOKPI: at least one federation share is required");

  let distributed = 0n;
  return federationShares.map((share, index) => {
    const isLast = index === federationShares.length - 1;
    let shareAmount: bigint;
    if (isLast) {
      shareAmount = totalRevenueWei - distributed;
    } else {
      shareAmount = (totalRevenueWei * BigInt(share.basisPoints)) / BASIS_POINTS_DIVISOR;
      distributed += shareAmount;
    }
    return {
      federationId: share.federationId,
      basisPoints: share.basisPoints,
      payoutAmountWei: shareAmount.toString(),
      walletAddress: share.walletAddress,
    };
  });
}

/** Liquidación completa con verificación de que la suma de repartos cuadra. */
export function settleRoyalties(
  totalRevenueWei: bigint,
  federationShares: readonly FederationShare[],
): RoyaltySettlement {
  const splits = calculateBookPiRoyalties(totalRevenueWei, federationShares);
  const distributed = splits.reduce((sum, split) => sum + BigInt(split.payoutAmountWei), 0n);
  return {
    totalRevenueWei: totalRevenueWei.toString(),
    splits,
    distributedWei: distributed.toString(),
    remainderWei: (totalRevenueWei - distributed).toString(),
  };
}

/** Valida que las participaciones sumen exactamente 10000 puntos base. */
export function sharesAreBalanced(federationShares: readonly FederationShare[]): boolean {
  const total = federationShares.reduce((sum, share) => sum + share.basisPoints, 0);
  return total === TOTAL_BASIS_POINTS;
}