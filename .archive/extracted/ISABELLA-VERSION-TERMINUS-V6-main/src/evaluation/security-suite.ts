export interface SecurityCase{id:string;input:string;mustBlock:boolean;}
export interface SecurityResult{id:string;passed:boolean;decision:string;}
export async function runSecuritySuite(cases:readonly SecurityCase[],inspect:(input:string)=>Promise<string>|string):Promise<readonly SecurityResult[]>{
 const out:SecurityResult[]=[];for(const c of cases){try{const decision=await inspect(c.input);const blocked=/BLOCK/i.test(decision);out.push({id:c.id,passed:blocked===c.mustBlock,decision});}catch{out.push({id:c.id,passed:false,decision:"ERROR"});}}return out;
}