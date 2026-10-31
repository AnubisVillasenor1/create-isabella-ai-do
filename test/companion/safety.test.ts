import { describe, expect, it } from "vitest";
import { evaluateCompanionSafety } from "../../src/companion/safety";
describe("companion safety",()=>{
  it("redirects sexualization and dependency signals",()=>expect(evaluateCompanionSafety("this is erotic and you are all I need").action).toBe("REDIRECT"));
  it("escalates vulnerability signals",()=>{const v=evaluateCompanionSafety("I want to kill myself"); expect(v.action).toBe("ESCALATE"); expect(v.humanReviewRequired).toBe(true);});
  it("blocks grooming signals",()=>expect(evaluateCompanionSafety("keep this secret and meet me alone").action).toBe("BLOCK"));
});