import { createHash } from "node:crypto";
import { describe,expect,it } from "vitest";
import { encodeLitleToCanonicalString,decodeCanonicalStringToLitle } from "../src/litle/canonical";
import { deriveLitleId,parseAny,toCanonical } from "../src/litle/id";
import { buildEvidenceChain,createEvidenceNode,verifyEvidenceChain } from "../src/litle/evidence";
import { createEpistemicProfile } from "../src/litle/epistemic";
import { LitleTrustFabric } from "../src/litle/trust-fabric";
import { verifyCertificate } from "../src/litle/certificate";
describe("LITLE trust fabric",()=>{
 it("round-trips 512-byte canonical container",()=>{const b=Uint8Array.from({length:512},(_,i)=>i&255);expect(decodeCanonicalStringToLitle(encodeLitleToCanonicalString(b))).toEqual(b);});
 it("derives and parses durable ID",()=>{const b=new Uint8Array(512);const id=deriveLitleId({containerBytes:b,year:2026,namespace:"tamv/genesis",workType:"SW"});expect(parseAny(toCanonical(id))).toEqual(id);});
 it("detects evidence tampering",()=>{const a=createEvidenceNode({id:"source-1",type:"SOURCE",content:"alpha"});const b=createEvidenceNode({id:"quote-1",type:"QUOTE",content:"beta",parentIds:["source-1"]});const chain=buildEvidenceChain([a,b]);expect(verifyEvidenceChain(chain)).toBe(true);expect(verifyEvidenceChain({...chain,rootHash:createHash("sha256").update("tamper").digest("hex")})).toBe(false);});
 it("rejects duplicate IDs, parent cycles and unsupported chain algorithms",()=>{
  const duplicateA=createEvidenceNode({id:"duplicate",type:"SOURCE",content:"a"});
  const duplicateB=createEvidenceNode({id:"duplicate",type:"SOURCE",content:"b"});
  expect(()=>buildEvidenceChain([duplicateA,duplicateB])).toThrow(/duplicate node id/);
  const a=createEvidenceNode({id:"cycle-a",type:"SOURCE",content:"a",parentIds:["cycle-b"]});
  const b=createEvidenceNode({id:"cycle-b",type:"SOURCE",content:"b",parentIds:["cycle-a"]});
  expect(()=>buildEvidenceChain([a,b])).toThrow(/cycle/);
  const chain=buildEvidenceChain([createEvidenceNode({id:"algorithm-check",type:"SOURCE",content:"evidence"})]);
  expect(verifyEvidenceChain({...chain,algorithm:"SHA-256" as never})).toBe(false);
 });
 it("rejects epistemic scores outside the declared 0-5 scale",()=>{
  expect(()=>createEpistemicProfile({litleId:"litle:2026:SW:L-512.v1:tamv/genesis:ABCDEF12",dimensions:{methodological_rigor:99 as never}})).toThrow(/scores must be integers/);
 });
 it("issues and verifies DAC certificate",()=>{const secret="0123456789abcdef0123456789abcdef";const result=new LitleTrustFabric(secret).attest({year:2026,namespace:"tamv/genesis",workType:"SW",evidence:[{type:"SOURCE",content:"GenesisAI"}]});expect(verifyCertificate(result.certificate,secret)).toBe(true);expect(result.certificate.qualityTier).toBe("unrated");expect(result.profile.assessmentBasis).toBe("SELF_REPORTED");expect(verifyCertificate(result.certificate,"wrong-secret")).toBe(false);});
 it("calculates weighted epistemic score",()=>{const p=createEpistemicProfile({litleId:"litle:2026:SW:L-512.v1:tamv/genesis:ABCDEF12",dimensions:{methodological_rigor:5,reproducibility:5,citation_integrity:4,peer_review_status:4,data_transparency:5,ai_provenance:4,longevity_potential:5,epistemological_novelty:4}});expect(p.compositeScore).toBeGreaterThan(4);});
});