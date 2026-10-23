export type LitleWorkType = "BK" | "RQ" | "DS" | "PL" | "AR" | "MD" | "SW" | "EX" | "DP";
export type LitleCryptoProfile = "L-512.v1" | "L-1024.v1";
export const LITLE_WORK_TYPES: Readonly<Record<LitleWorkType,string>> = { BK:"Book", RQ:"Research", DS:"Dataset", PL:"Pipeline", AR:"Article", MD:"Manuscript", SW:"Software", EX:"Experiment", DP:"Data Product" };
export interface LitleId { namespace:string; year:number; workType:LitleWorkType; cryptoProfile:LitleCryptoProfile; suffix:string; }
export type EvidenceNodeType = "SOURCE" | "PROMPT" | "MODEL" | "REVISION" | "QUOTE";
export interface EvidenceNode { id:string; type:EvidenceNodeType; contentHash:string; parentIds:readonly string[]; metadata?:Readonly<Record<string,string>>; }
export interface EvidenceChain { nodes:readonly EvidenceNode[]; rootHash:string; algorithm:"SHA3-512"; }
export type EpistemicDimension = "methodological_rigor" | "reproducibility" | "citation_integrity" | "peer_review_status" | "data_transparency" | "ai_provenance" | "longevity_potential" | "epistemological_novelty";
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;
export interface EpistemicProfile { litleId:string; dimensions:Record<EpistemicDimension,QualityScore>; compositeScore:number; assessmentBasis:"SELF_REPORTED"|"INDEPENDENTLY_VERIFIED"; aiAssisted:boolean; hasEvidenceChain:boolean; hasCryptoSignature:boolean; }
export interface LitleAttestation { litleId:LitleId; canonicalId:string; evidenceRoot:string; epistemicScore:number; qualityTier:"platinum"|"gold"|"silver"|"bronze"|"unrated"; attestedAt:string; verifier:"genesisai-litle-fabric"; cryptographicBinding:string; }