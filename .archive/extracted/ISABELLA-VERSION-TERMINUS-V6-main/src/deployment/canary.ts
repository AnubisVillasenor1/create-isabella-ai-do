export interface CanaryObservation { requestId:string; variant:"stable"|"canary"; success:boolean; latencyMs:number; safetyBlocks:number; }
export interface CanaryDecision { promoted:boolean; reason:"insufficient_samples"|"healthy"|"unhealthy"; }
export function evaluateCanary(observations:readonly CanaryObservation[],minSamples=20,maxErrorRate=.02,maxP95Ms=3000):CanaryDecision {
  const canary=observations.filter(o=>o.variant==="canary");
  if(canary.length<minSamples) return {promoted:false,reason:"insufficient_samples"};
  const errors=canary.filter(o=>!o.success).length/canary.length;
  const sorted=canary.map(o=>o.latencyMs).sort((a,b)=>a-b);
  const p95=sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)]??Infinity;
  if(errors>maxErrorRate || p95>maxP95Ms || canary.some(o=>o.safetyBlocks>0)) return {promoted:false,reason:"unhealthy"};
  return {promoted:true,reason:"healthy"};
}
