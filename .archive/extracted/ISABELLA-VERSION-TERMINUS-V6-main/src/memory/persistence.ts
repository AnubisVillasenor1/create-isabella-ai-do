import type {KnowledgeClaim,KnowledgeSource} from "./ikes";
export interface MemoryPersistence{
 saveSource(source:KnowledgeSource):Promise<void>;
 saveClaim(claim:KnowledgeClaim):Promise<void>;
 loadSources():Promise<readonly KnowledgeSource[]>;
 loadClaims():Promise<readonly KnowledgeClaim[]>;
}
export class InMemoryMemoryPersistence implements MemoryPersistence{
 private readonly sources=new Map<string,KnowledgeSource>();
 private readonly claims=new Map<string,KnowledgeClaim>();
 async saveSource(s:KnowledgeSource){this.sources.set(s.sourceId,Object.freeze({...s}));}
 async saveClaim(c:KnowledgeClaim){this.claims.set(c.claimId,Object.freeze({...c}));}
 async loadSources(){return [...this.sources.values()];}
 async loadClaims(){return [...this.claims.values()];}
}