import type { ExpertPlan } from "./experts";
export interface CognitiveTask { taskId:string; input:string; requiredExperts: readonly string[]; risk:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL"; }
export interface ExpertResult { expertId:string; status:"OK"|"REVIEW"|"BLOCK"; summary:string; evidenceRefs:readonly string[]; }
export interface CognitiveSynthesis { taskId:string; status:"READY"|"REVIEW"|"BLOCK"; results:readonly ExpertResult[]; authorityPath:"FULL"; }
export function synthesize(task:CognitiveTask,plan:ExpertPlan,results:readonly ExpertResult[]):CognitiveSynthesis {
  const selected = new Set<string>(plan.selected.map(e=>e.id));
  for(const r of results) if(!selected.has(r.expertId)) throw new Error("ORCHESTRATOR: result from unplanned expert");
  const status=results.some(r=>r.status==="BLOCK")?"BLOCK":results.some(r=>r.status==="REVIEW")?"REVIEW":"READY";
  if(task.risk==="CRITICAL" && status==="READY") return {taskId:task.taskId,status:"REVIEW",results:[...results],authorityPath:"FULL"};
  return {taskId:task.taskId,status,results:[...results],authorityPath:"FULL"};
}
