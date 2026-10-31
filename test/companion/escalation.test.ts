import { describe, expect, it } from "vitest";
import { InMemoryHumanEscalationQueue, createEscalation } from "../../src/companion/escalation";
describe("human escalation",()=>{
  it("creates expiring auditable requests",()=>{const q=new InMemoryHumanEscalationQueue(); q.enqueue(createEscalation({requestId:"r1",traceId:"t1",reason:"policy_appeal",summary:"review",severity:"MEDIUM",evidenceRefs:["ev1"]})); expect(q.pending()).toHaveLength(1); q.resolve("r1","ACCEPTED"); expect(q.pending()).toHaveLength(0);});
});