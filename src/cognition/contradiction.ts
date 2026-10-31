/**
 * Contradiction Engine Ω — detección determinista de contradicciones canónicas.
 *
 * state: draft | engine-generated.
 *
 * SOPHIA consume un *conteo* de contradicciones y el HSF las puntúa, pero no
 * existía un motor que las **detecte** a partir de afirmaciones canónicas. Este
 * módulo compara claims estructurados (sujeto · relación · objeto · polaridad)
 * y emite un informe determinista:
 *
 *   - `opposite_polarity` — mismo sujeto, relación y objeto con polaridad opuesta.
 *   - `opposite_object`   — mismo sujeto y relación funcional con objeto distinto.
 *
 * Detección **estructural sobre claims canonicalizados**, no inferencia de
 * lenguaje natural. Una contradicción no se "resuelve" por sí sola: solo se
 * atenúa por prioridad de fuente (trust tier); a igualdad de tier queda
 * `UNRESOLVED` para arbitraje humano. El motor no concede autoridad ni verdad.
 */
import { sha256 } from '../skills/canonical-json';
import type { ProvenanceSource } from '../memory/provenance';

export type ClaimPolarity = 'affirm' | 'deny';
export type ContradictionReason = 'opposite_polarity' | 'opposite_object';
export type ContradictionResolution = 'UNRESOLVED' | 'RESOLVED_BY_TRUST_TIER';

type TrustTier = ProvenanceSource['trustTier'];

export interface CanonicalClaim {
  readonly claimId: string;
  readonly subject: string;
  readonly relation: string;
  readonly object: string;
  readonly polarity?: ClaimPolarity;
  readonly sourceId?: string;
  readonly trustTier?: TrustTier;
}

export interface ContradictionPair {
  readonly left: string;
  readonly right: string;
  readonly reason: ContradictionReason;
  readonly resolution: ContradictionResolution;
  readonly winner?: string;
}

export interface ContradictionReport {
  readonly contradictions: readonly ContradictionPair[];
  readonly count: number;
  readonly unresolved: number;
  readonly consistent: boolean;
  readonly digest: string;
}

export interface ContradictionOptions {
  /** Relaciones consideradas funcionales: dos objetos distintos contradicen. */
  readonly functionalRelations?: readonly string[];
}

const TIER_RANK: Record<TrustTier, number> = {
  PRIMARY: 5,
  SECONDARY: 4,
  TERTIARY: 3,
  USER_PROVIDED: 2,
  UNVERIFIED: 1,
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

function rank(claim: CanonicalClaim): number {
  return claim.trustTier ? TIER_RANK[claim.trustTier] : 0;
}

export function detectContradictions(
  claims: readonly CanonicalClaim[],
  options: ContradictionOptions = {}
): ContradictionReport {
  const functional = new Set((options.functionalRelations ?? []).map(normalize));
  const contradictions: ContradictionPair[] = [];

  for (let i = 0; i < claims.length; i += 1) {
    const left = claims[i];
    if (!left) continue;
    for (let j = i + 1; j < claims.length; j += 1) {
      const right = claims[j];
      if (!right) continue;
      if (normalize(left.subject) !== normalize(right.subject)) continue;
      if (normalize(left.relation) !== normalize(right.relation)) continue;

      const sameObject = normalize(left.object) === normalize(right.object);
      const oppositePolarity = (left.polarity ?? 'affirm') !== (right.polarity ?? 'affirm');

      let reason: ContradictionReason | null = null;
      if (oppositePolarity && sameObject) reason = 'opposite_polarity';
      else if (!sameObject && functional.has(normalize(left.relation))) reason = 'opposite_object';
      if (!reason) continue;

      const rankLeft = rank(left);
      const rankRight = rank(right);
      if (rankLeft === rankRight) {
        contradictions.push({
          left: left.claimId,
          right: right.claimId,
          reason,
          resolution: 'UNRESOLVED',
        });
      } else {
        contradictions.push({
          left: left.claimId,
          right: right.claimId,
          reason,
          resolution: 'RESOLVED_BY_TRUST_TIER',
          winner: rankLeft > rankRight ? left.claimId : right.claimId,
        });
      }
    }
  }

  const unresolved = contradictions.filter((pair) => pair.resolution === 'UNRESOLVED').length;
  const digest = sha256(
    contradictions.map((pair) => ({
      left: pair.left,
      right: pair.right,
      reason: pair.reason,
      resolution: pair.resolution,
    }))
  );

  return {
    contradictions,
    count: contradictions.length,
    unresolved,
    consistent: contradictions.length === 0,
    digest,
  };
}
