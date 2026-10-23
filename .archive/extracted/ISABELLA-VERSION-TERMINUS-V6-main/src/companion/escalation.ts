export type EscalationReason = "abuse" | "real_world_harm" | "severe_conflict" | "vulnerability" | "policy_appeal" | "security";

export interface HumanEscalationRequest {
  requestId: string;
  traceId: string;
  reason: EscalationReason;
  summary: string;
  severity: "MEDIUM" | "HIGH" | "CRITICAL";
  evidenceRefs: readonly string[];
  createdAt: string;
  expiresAt: string;
}

export interface HumanEscalationQueue {
  enqueue(request: HumanEscalationRequest): void;
  pending(): readonly HumanEscalationRequest[];
  resolve(requestId: string, resolution: "ACCEPTED" | "MODIFIED" | "REJECTED"): void;
}

export class InMemoryHumanEscalationQueue implements HumanEscalationQueue {
  private readonly items = new Map<string, HumanEscalationRequest>();
  enqueue(request: HumanEscalationRequest): void {
    if (this.items.has(request.requestId)) throw new Error(`ESCALATION: duplicate request ${request.requestId}`);
    if (Date.parse(request.expiresAt) <= Date.parse(request.createdAt)) throw new Error("ESCALATION: expiresAt must be after createdAt");
    this.items.set(request.requestId,Object.freeze({...request,evidenceRefs:[...request.evidenceRefs]}));
  }
  pending(): readonly HumanEscalationRequest[] {
    const now=Date.now();
    return [...this.items.values()].filter((r)=>Date.parse(r.expiresAt)>now);
  }
  resolve(requestId: string, _resolution: "ACCEPTED" | "MODIFIED" | "REJECTED"): void {
    if (!this.items.has(requestId)) throw new Error(`ESCALATION: unknown request ${requestId}`);
    this.items.delete(requestId);
  }
}

export function createEscalation(input: Omit<HumanEscalationRequest,"createdAt"|"expiresAt">, ttlMs=300_000): HumanEscalationRequest {
  const createdAt=new Date().toISOString();
  return Object.freeze({...input,createdAt,expiresAt:new Date(Date.now()+ttlMs).toISOString()});
}
