import { createHash } from "node:crypto";
export interface ProvenanceSource {
  sourceId: string;
  uri?: string;
  title?: string;
  publisher?: string;
  retrievedAt: string;
  contentHash: string;
  trustTier: "PRIMARY" | "SECONDARY" | "TERTIARY" | "USER_PROVIDED" | "UNVERIFIED";
}
export interface ProvenanceClaim {
  claimId: string;
  text: string;
  sourceIds: readonly string[];
  observedAt: string;
  confidence: "DIRECT" | "CORROBORATED" | "INFERRED" | "UNVERIFIED";
}
export function hashContent(content: string): string { return createHash("sha256").update(content,"utf8").digest("hex"); }
export function createSource(input: Omit<ProvenanceSource,"contentHash"> & {content:string}): ProvenanceSource {
  if(!input.sourceId || !input.content.trim()) throw new Error("PROVENANCE: sourceId and content are required");
  return Object.freeze({...input,contentHash:hashContent(input.content)});
}
export function validateClaim(claim: ProvenanceClaim, sources: readonly ProvenanceSource[]): boolean {
  if(!claim.claimId || !claim.text.trim() || claim.sourceIds.length===0) return false;
  const ids=new Set(sources.map(s=>s.sourceId));
  return claim.sourceIds.every(id=>ids.has(id));
}
