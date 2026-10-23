import type { EpistemicDimension, EpistemicProfile, QualityScore } from "./types";

export const DIMENSION_WEIGHTS: Readonly<Record<EpistemicDimension, number>> = Object.freeze({
  methodological_rigor: 0.20,
  reproducibility: 0.18,
  citation_integrity: 0.15,
  peer_review_status: 0.12,
  data_transparency: 0.12,
  ai_provenance: 0.10,
  longevity_potential: 0.08,
  epistemological_novelty: 0.05,
});
export const QUALITY_THRESHOLDS = Object.freeze({ platinum: 4, gold: 3.5, silver: 2.5, bronze: 1.5 });
export type QualityTier = "platinum" | "gold" | "silver" | "bronze" | "unrated";

function normalizeDimensions(input?: Partial<Record<EpistemicDimension, QualityScore>>): Record<EpistemicDimension, QualityScore> {
  const allowed = Object.keys(DIMENSION_WEIGHTS) as EpistemicDimension[];
  if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input))) {
    throw new Error("LITLE epistemic: dimensions must be an object");
  }
  for (const key of Object.keys(input ?? {})) {
    if (!allowed.includes(key as EpistemicDimension)) throw new Error("LITLE epistemic: unknown dimension " + key);
  }
  const result = {} as Record<EpistemicDimension, QualityScore>;
  for (const dimension of allowed) {
    const value = input?.[dimension] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > 5) {
      throw new Error("LITLE epistemic: dimension scores must be integers in [0,5]");
    }
    result[dimension] = value as QualityScore;
  }
  return result;
}

export function calculateComposite(dimensions: Record<EpistemicDimension, QualityScore>): number {
  const normalized = normalizeDimensions(dimensions);
  return Math.round((Object.keys(DIMENSION_WEIGHTS) as EpistemicDimension[])
    .reduce((sum, dimension) => sum + normalized[dimension] * DIMENSION_WEIGHTS[dimension], 0) * 100) / 100;
}

export function getQualityTier(score: number): QualityTier {
  if (!Number.isFinite(score) || score < 0 || score > 5) throw new Error("LITLE epistemic: score must be in [0,5]");
  if (score >= QUALITY_THRESHOLDS.platinum) return "platinum";
  if (score >= QUALITY_THRESHOLDS.gold) return "gold";
  if (score >= QUALITY_THRESHOLDS.silver) return "silver";
  if (score >= QUALITY_THRESHOLDS.bronze) return "bronze";
  return "unrated";
}

export function createEpistemicProfile(input: {
  litleId: string;
  dimensions?: Partial<Record<EpistemicDimension, QualityScore>>;
  aiAssisted?: boolean;
  hasEvidenceChain?: boolean;
  hasCryptoSignature?: boolean;
}): EpistemicProfile {
  if (!input || typeof input.litleId !== "string" || !input.litleId.trim()) {
    throw new Error("LITLE epistemic: litleId required");
  }
  const dimensions = normalizeDimensions(input.dimensions);
  return Object.freeze({
    litleId: input.litleId,
    dimensions: Object.freeze(dimensions),
    compositeScore: calculateComposite(dimensions),
    assessmentBasis: "SELF_REPORTED" as const,
    aiAssisted: input.aiAssisted ?? false,
    hasEvidenceChain: input.hasEvidenceChain ?? false,
    hasCryptoSignature: input.hasCryptoSignature ?? false,
  });
}
