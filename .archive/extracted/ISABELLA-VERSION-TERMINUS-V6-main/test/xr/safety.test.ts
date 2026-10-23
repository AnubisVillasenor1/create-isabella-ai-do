import { describe, expect, it } from "vitest";
import { evaluateXrSafety } from "../../src/xr/safety";
describe("XR safety",()=>{
  it("escalates critical grooming events",()=>{const d=evaluateXrSafety({sessionId:"s1",signal:"grooming",severity:"CRITICAL",at:new Date().toISOString(),source:"system"}); expect(d.action).toBe("ESCALATE"); expect(d.humanReviewRequired).toBe(true);});
});