import { describe, expect, it } from "vitest";
import { createEmotionalTrace } from "../../src/cognition/emotional-trace";
describe("contextual affect trace",()=>{
  it("requires consent because affect signals are sensitive context",()=>{const now=Date.now(); const t=createEmotionalTrace("tr1",[{signal:"uncertain",confidence:.7,source:"conversation_heuristic",observedAt:new Date(now).toISOString(),expiresAt:new Date(now+1000).toISOString()}],"response_modulation"); expect(t.consentRequired).toBe(true);});
});