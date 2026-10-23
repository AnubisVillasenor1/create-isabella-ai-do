import { createHash } from "node:crypto";
import type { LitleCryptoProfile,LitleId,LitleWorkType } from "./types";
import { LITLE_WORK_TYPES } from "./types";
const NS_RE=/^[a-z0-9]+(?:\/[a-z0-9]+)*$/; const SUFFIX_RE=/^[0-9A-F]{8,64}$/;
function assertValid(id:LitleId):void {
 if(!Number.isInteger(id.year)||id.year<1900||id.year>9999) throw new Error("LITLE-ID: invalid year");
 if(!(id.workType in LITLE_WORK_TYPES)) throw new Error("LITLE-ID: unknown workType");
 if(id.cryptoProfile!=="L-512.v1"&&id.cryptoProfile!=="L-1024.v1") throw new Error("LITLE-ID: unsupported crypto profile");
 if(!NS_RE.test(id.namespace)) throw new Error("LITLE-ID: invalid namespace"); if(!SUFFIX_RE.test(id.suffix)) throw new Error("LITLE-ID: invalid suffix");
}
export function toCanonical(id:LitleId):string { assertValid(id); return "litle:"+id.year+":"+id.workType+":"+id.cryptoProfile+":"+id.namespace+":"+id.suffix; }
export function toUri(id:LitleId):string { assertValid(id); return "litle://"+id.year+"/"+id.namespace+"/"+id.suffix; }
export function toHuman(id:LitleId):string { assertValid(id); const s=id.suffix.slice(0,8).padEnd(8,"0"); return "LTL-"+id.year+"-"+id.workType+"-"+s.slice(0,4)+"-"+s.slice(4); }
export function parseCanonical(value:string):LitleId { const p=value.split(":"); if(p.length!==6||p[0]!=="litle") throw new Error("LITLE-ID: not canonical"); const id:LitleId={year:Number(p[1]),workType:p[2] as LitleWorkType,cryptoProfile:p[3] as LitleCryptoProfile,namespace:p[4]??"",suffix:p[5]??""}; assertValid(id); return id; }
export function parseAny(value:string):LitleId { const t=value.trim(); if(t.startsWith("litle:")&&!t.startsWith("litle://")) return parseCanonical(t); const h=/^LTL-(\d{4})-([A-Z]{2})-([0-9A-F]{4})-([0-9A-F]{4})$/.exec(t); if(h) return {year:Number(h[1]),workType:h[2] as LitleWorkType,cryptoProfile:"L-512.v1",namespace:"unknown",suffix:(h[3]??"")+(h[4]??"")}; if(t.startsWith("litle://")) { const u=new URL(t); const s=u.pathname.split("/").filter(Boolean); if(s.length<2) throw new Error("LITLE-ID: invalid URI"); return {year:Number(u.hostname),namespace:s.slice(0,-1).join("/"),suffix:(s.at(-1)??"").toUpperCase(),workType:"RQ",cryptoProfile:"L-512.v1"}; } throw new Error("LITLE-ID: unrecognized format"); }
export function deriveLitleId(input:{containerBytes:Uint8Array;year:number;namespace:string;workType:LitleWorkType;cryptoProfile?:LitleCryptoProfile}):LitleId { const suffix=createHash("sha256").update(input.containerBytes).digest("hex").slice(0,16).toUpperCase(); const id:LitleId={year:input.year,namespace:input.namespace.toLowerCase(),workType:input.workType,cryptoProfile:input.cryptoProfile??"L-512.v1",suffix}; assertValid(id); return id; }
export function workTypeLabel(type:LitleWorkType):string{return LITLE_WORK_TYPES[type];}