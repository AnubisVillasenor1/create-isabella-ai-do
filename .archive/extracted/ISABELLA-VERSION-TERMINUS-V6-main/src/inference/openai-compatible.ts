import type {EmbeddingAdapter,GenerationRequest,GenerationResult,InferenceAdapter,ModelDescriptor} from "./types";
export interface OpenAICompatibleConfig{baseUrl:string;apiKey:string;model:string;timeoutMs?:number;}
export class OpenAICompatibleAdapter implements InferenceAdapter{
 readonly descriptor:ModelDescriptor;
 constructor(private readonly config:OpenAICompatibleConfig,descriptor?:Partial<ModelDescriptor>){
  this.descriptor={id:config.model,version:"external",provider:"openai-compatible",capabilities:["chat"],contextWindow:descriptor?.contextWindow??128000,maxOutputTokens:descriptor?.maxOutputTokens??8192,latencyClass:descriptor?.latencyClass??"BALANCED"};
 }
 async generate(request:GenerationRequest):Promise<GenerationResult>{
  const started=Date.now();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.config.timeoutMs??30000);
  try{
   const response=await fetch(this.config.baseUrl.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+this.config.apiKey},body:JSON.stringify({model:this.config.model,messages:[{role:"user",content:request.prompt}],max_tokens:request.maxTokens,temperature:request.temperature}),signal:controller.signal});
   if(!response.ok)throw new Error("INFERENCE_HTTP: "+response.status);
   const data=await response.json() as {choices?:{message?:{content?:string};finish_reason?:string}[];usage?:{prompt_tokens?:number;completion_tokens?:number}};
   const choice=data.choices?.[0];if(!choice?.message?.content)throw new Error("INFERENCE_HTTP: empty model response");
   return{modelId:this.config.model,text:choice.message.content,inputTokens:data.usage?.prompt_tokens??0,outputTokens:data.usage?.completion_tokens??0,latencyMs:Date.now()-started,finishReason:choice.finish_reason==="length"?"length":"stop"};
  }finally{clearTimeout(timer);}
 }
}
export class OpenAICompatibleEmbeddingAdapter implements EmbeddingAdapter{
 constructor(public readonly modelId:string,private readonly baseUrl:string,private readonly apiKey:string,private readonly timeoutMs=30000){}
 async embed(input:string):Promise<readonly number[]>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
  try{
   const r=await fetch(this.baseUrl.replace(/\/$/,"")+"/embeddings",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+this.apiKey},body:JSON.stringify({model:this.modelId,input}),signal:controller.signal});
   if(!r.ok)throw new Error("EMBEDDING_HTTP: "+r.status);
   const data=await r.json() as {data?:{embedding?:number[]}[]};const v=data.data?.[0]?.embedding;
   if(!v)throw new Error("EMBEDDING_HTTP: empty vector");return v;
  }finally{clearTimeout(timer);}
 }
}