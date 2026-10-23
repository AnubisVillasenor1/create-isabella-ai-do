export type ConsentPurpose = "contextual_affect" | "sensor_data" | "memory_persistence" | "territory_personalization" | "human_escalation";
export interface ConsentGrant {
  consentId: string;
  principalId: string;
  purpose: ConsentPurpose;
  grantedAt: string;
  expiresAt: string;
  revocable: true;
  scope: readonly string[];
}
export interface ConsentRegistry { grant(g: ConsentGrant): void; revoke(consentId: string): void; has(principalId: string,purpose: ConsentPurpose,scope?: string): boolean; }
export class InMemoryConsentRegistry implements ConsentRegistry {
  private readonly grants=new Map<string,ConsentGrant>();
  grant(g: ConsentGrant): void {
    if (!g.consentId || !g.principalId || Date.parse(g.expiresAt)<=Date.parse(g.grantedAt)) throw new Error("CONSENT: invalid grant");
    this.grants.set(g.consentId,Object.freeze({...g,scope:[...g.scope],revocable:true}));
  }
  revoke(id: string): void { this.grants.delete(id); }
  has(principalId: string,purpose: ConsentPurpose,scope?: string): boolean {
    const now=Date.now();
    return [...this.grants.values()].some(g=>g.principalId===principalId && g.purpose===purpose && Date.parse(g.expiresAt)>now && (!scope || g.scope.includes(scope)));
  }
}
