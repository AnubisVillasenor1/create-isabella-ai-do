import { createHash } from "node:crypto";
export interface VectorRecord{id:string;vector:readonly number[];text:string;metadata:Readonly<Record<string,string|number|boolean>>;}
export interface VectorStore{upsert(record:VectorRecord):void;search(vector:readonly number[],limit:number):VectorRecord[];}
export class InMemoryVectorStore implements VectorStore{
 private readonly records=new Map<string,VectorRecord>();
 upsert(record:VectorRecord):void{if(!record.id)throw new Error("VECTOR: id required");this.records.set(record.id,Object.freeze({...record,vector:[...record.vector]}));}
 search(vector:readonly number[],limit:number):VectorRecord[]{return [...this.records.values()].filter(r=>r.vector.length===vector.length).map(r=>({r,s:cos(vector,r.vector)})).sort((a,b)=>b.s-a.s).slice(0,Math.max(0,limit)).map(x=>x.r);}
 digest():string{return createHash("sha256").update(JSON.stringify([...this.records.values()])).digest("hex");}
}
function cos(a:readonly number[],b:readonly number[]):number{let d=0,aa=0,bb=0;for(let i=0;i<a.length;i++){const x=a[i]??0,y=b[i]??0;d+=x*y;aa+=x*x;bb+=y*y;}return aa===0||bb===0?0:d/(Math.sqrt(aa)*Math.sqrt(bb));}