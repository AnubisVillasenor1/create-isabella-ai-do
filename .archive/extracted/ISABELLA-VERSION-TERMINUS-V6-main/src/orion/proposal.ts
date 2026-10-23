/** ORION SANDBOX — propuestas de cambio (offline, plano paralelo, sin efectos). */

import type { GovernanceTier, RiskTier } from "../authority/method-id";

export interface ChangeProposal {
  id: string;
  methodId: string;
  domain: string;
  plane: string;
  target: string;
  changeBlocks: readonly string[];
  riskTier: RiskTier;
  governanceTier: GovernanceTier;
  rationale: string;
  proposedAt: string;
}

export interface ProposalParts {
  methodId: string;
  domain: string;
  plane: string;
  target: string;
  changeBlocks: readonly string[];
  riskTier: RiskTier;
  governanceTier: GovernanceTier;
  rationale?: string;
}

/** Una propuesta es el único insumo legítimo para el sandbox (esta etapa). */
export function buildProposal(parts: ProposalParts): ChangeProposal {
  if (!parts.methodId || !parts.domain || !parts.changeBlocks.length) {
    throw new Error("ORION: la propuesta exige methodId, dominio y al menos un bloque de cambio");
  }
  return {
    id: crypto.randomUUID(),
    methodId: parts.methodId,
    domain: parts.domain,
    plane: parts.plane,
    target: parts.target,
    changeBlocks: parts.changeBlocks,
    riskTier: parts.riskTier,
    governanceTier: parts.governanceTier,
    rationale: parts.rationale ?? "",
    proposedAt: new Date().toISOString(),
  };
}