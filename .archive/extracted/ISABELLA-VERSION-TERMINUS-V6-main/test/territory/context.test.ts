import { describe, expect, it } from "vitest";
import { queryTerritory } from "../../src/territory/context";
describe("territory context",()=>{
  it("keeps answers bound to the requested territory",()=>{const answer=queryTerritory({intent:"history",query:"mining",context:{territoryId:"rdm",jurisdiction:"MX-HID",locale:"es-MX",language:"es",pointsOfInterest:[],routes:[],policies:[],sources:["s1"],observedAt:new Date().toISOString()}},()=>({answer:"ok",sourceIds:["s1"],territoryId:"rdm",confidence:"source_bound"})); expect(answer.territoryId).toBe("rdm");});
});