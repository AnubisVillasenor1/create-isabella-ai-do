import type { EvolutionControl } from "../core/types";
import { generateControls } from "./catalog";
import { isKnownDomain } from "./domains";

export interface ChangeBlock {
  path: string;
  change: "CREATE" | "UPDATE" | "DELETE";
  reason: string;
  expectedInvariant: string;
}

export interface EvolutionProposal {
  proposalId: string;
  proposalDomain: string;
  objective: string;
  controlIds: readonly string[];
  changeBlocks: readonly ChangeBlock[];
  evidenceRefs: readonly string[];
  requiresHumanApproval: boolean;
}

export function controlsForProposalDomain(domain: string, controls = generateControls()): EvolutionControl[] {
  if (!isKnownDomain(domain)) throw new Error(`EVOLUTION: unknown proposal domain ${domain}`);
  return controls.filter((c) => c.domain === domain);
}

export function validateProposal(proposal: EvolutionProposal, controls = generateControls()): void {
  const applicable = new Set(controlsForProposalDomain(proposal.proposalDomain, controls).map((c) => c.id));
  if (proposal.controlIds.length === 0) throw new Error("EVOLUTION: proposal requires at least one control.");
  if (proposal.changeBlocks.length === 0) throw new Error("EVOLUTION: proposal requires at least one change block.");
  if (proposal.controlIds.some((id) => !applicable.has(id))) {
    throw new Error("EVOLUTION: proposal references controls outside its declared domain.");
  }
  if (proposal.evidenceRefs.length === 0) {
    throw new Error("EVOLUTION: proposal requires reproducible evidence references.");
  }
}
