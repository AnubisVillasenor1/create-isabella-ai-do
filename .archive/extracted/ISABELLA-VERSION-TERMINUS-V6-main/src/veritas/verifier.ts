import { createHash } from "node:crypto";
export interface VerificationCandidate{branchId:string;output:string;score?:number;}
export interface VerificationResult{accepted:boolean;selected?:VerificationCandidate;reasons:readonly string[];digest:string;}
export class DeterministicVerifier{
 async verify(prompt:string,candidates:readonly VerificationCandidate[]):Promise<VerificationResult>{const d=createHash("sha256").update(JSON.stringify({prompt,candidates})??"").digest("hex");const v=candidates.filter(c=>c.output.trim());if(!v.length)return{accepted:false,reasons:["no viable candidates"],digest:d};const selected=[...v].sort((a,b)=>(b.score??0)-(a.score??0))[0];return{accepted:true,selected,reasons:["deterministic candidate selection"],digest:d};}
}