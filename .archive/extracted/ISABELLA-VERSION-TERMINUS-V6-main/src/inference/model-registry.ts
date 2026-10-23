import type {InferenceAdapter,ModelDescriptor} from "./types";
export interface ModelPolicy{allowedProviders?:readonly string[];maxContext:number;allowedCapabilities:readonly string[];}
export class ModelRegistry{
 private readonly models=new Map<string,InferenceAdapter>();
 register(adapter:InferenceAdapter,policy:ModelPolicy):void{
  const d=adapter.descriptor;
  if(d.contextWindow>policy.maxContext)throw new Error("MODEL: context exceeds policy");
  if(policy.allowedProviders&&!policy.allowedProviders.includes(d.provider))throw new Error("MODEL: provider denied");
  if(d.capabilities.some(c=>!policy.allowedCapabilities.includes(c)))throw new Error("MODEL: capability denied");
  if(this.models.has(d.id))throw new Error("MODEL: duplicate");
  this.models.set(d.id,adapter);
 }
 get(id:string):InferenceAdapter{const m=this.models.get(id);if(!m)throw new Error("MODEL: unknown model");return m;}
 list():readonly ModelDescriptor[]{return [...this.models.values()].map(m=>m.descriptor);}
}