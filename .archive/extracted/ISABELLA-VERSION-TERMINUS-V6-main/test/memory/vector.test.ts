import {describe,expect,it} from "vitest";
import {InMemoryVectorStore} from "../../src/memory/vector";
describe("vector memory",()=>{it("returns nearest compatible vectors",()=>{const s=new InMemoryVectorStore();s.upsert({id:"a",vector:[1,0],text:"a",metadata:{}});s.upsert({id:"b",vector:[0,1],text:"b",metadata:{}});expect(s.search([.9,.1],1)[0]?.id).toBe("a");});});