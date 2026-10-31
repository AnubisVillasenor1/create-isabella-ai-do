import { describe, expect, it } from "vitest";
import { explainPolicyDecision } from "../../src/cognition/explainability";
describe("decision explanations",()=>{
  it("requires a human-readable reason and evidence refs",()=>{const x=explainPolicyDecision("DENY",["missing approval"],["ev-1"],"policy-v1"); expect(x.kind).toBe("policy"); expect(x.decision).toBe("DENY"); expect(x.evidenceRefs).toEqual(["ev-1"]);});
});