import type { RoyaltyParty, RoyaltyPlan, RoyaltyShare } from './types';

// SCER Royalty Network (state: draft | engine-generated).
// Distribución determinista y exacta por basis points (suma 10000 = 100%). Usa
// "método del resto mayor" para que la suma de las partes iguale EXACTAMENTE el
// total (sin pérdida por redondeo). Planificar NO transfiere fondos.

/** Total de basis points que debe sumar un reparto válido. */
export const ROYALTY_TOTAL_BASIS_POINTS = 10_000;

const ALLOWED_ROLES = new Set([
  'creator',
  'affiliate',
  'dataset',
  'platform',
  'reserve',
  'federation',
  'distribution',
]);

function validateParties(parties: readonly RoyaltyParty[]): void {
  if (!Array.isArray(parties) || parties.length === 0) {
    throw new Error('Royalty plan requires at least one party.');
  }
  const seen = new Set<string>();
  let sum = 0;
  for (const party of parties) {
    if (typeof party.partyId !== 'string' || party.partyId.trim() === '') {
      throw new Error('Royalty party requires a non-empty partyId.');
    }
    if (seen.has(party.partyId)) {
      throw new Error(`Duplicate royalty partyId: ${party.partyId}.`);
    }
    seen.add(party.partyId);
    if (!ALLOWED_ROLES.has(party.role)) {
      throw new Error(`Unknown royalty role: ${String(party.role)}.`);
    }
    if (
      !Number.isInteger(party.basisPoints) ||
      party.basisPoints < 0 ||
      party.basisPoints > ROYALTY_TOTAL_BASIS_POINTS
    ) {
      throw new Error(
        `Royalty basisPoints for ${party.partyId} must be an integer within 0..10000.`
      );
    }
    sum += party.basisPoints;
  }
  if (sum !== ROYALTY_TOTAL_BASIS_POINTS) {
    throw new Error(`Royalty basisPoints must sum to ${ROYALTY_TOTAL_BASIS_POINTS}; got ${sum}.`);
  }
}

/**
 * Reparte `totalMinor` entre las partes según sus basis points. Reparto exacto:
 * la suma de `shares[].amountMinor` siempre iguala `totalMinor`. El resto de la
 * división entera se asigna (1 unidad menor) a las partes con mayor basisPoints
 * (desempate por `partyId`), de forma determinista.
 */
export function planRoyaltyDistribution(
  totalMinor: bigint,
  parties: readonly RoyaltyParty[]
): RoyaltyPlan {
  if (typeof totalMinor !== 'bigint' || totalMinor < 0n) {
    throw new Error('Royalty totalMinor must be a non-negative bigint.');
  }
  validateParties(parties);

  const total = BigInt(ROYALTY_TOTAL_BASIS_POINTS);
  const baseAmounts = parties.map((p) =>
    total === 0n ? 0n : (totalMinor * BigInt(p.basisPoints)) / total
  );
  const distributed = baseAmounts.reduce((acc, value) => acc + value, 0n);
  let remainder = Number(totalMinor - distributed);

  const order = parties
    .map((party, index) => ({ party, index }))
    .sort((a, b) =>
      a.party.basisPoints === b.party.basisPoints
        ? a.party.partyId.localeCompare(b.party.partyId)
        : b.party.basisPoints - a.party.basisPoints
    );

  const amounts = [...baseAmounts];
  for (const { index } of order) {
    if (remainder <= 0) break;
    amounts[index] = (amounts[index] ?? 0n) + 1n;
    remainder -= 1;
  }

  const shares: RoyaltyShare[] = parties.map((party, index) => ({
    partyId: party.partyId,
    role: party.role,
    basisPoints: party.basisPoints,
    amountMinor: (amounts[index] ?? 0n).toString(),
  }));

  const distributedSum = amounts.reduce((acc, value) => acc + value, 0n);

  return {
    totalMinor: totalMinor.toString(),
    distributedMinor: distributedSum.toString(),
    remainderMinor: (distributedSum - distributed).toString(),
    shares,
  };
}
