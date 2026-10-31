import { describe, expect, it } from "vitest";
import { evaluateHumanApproval } from "../../src/gameover/human-approval-gate";

describe("GAME OVER HumanApprovalGate", () => {
  it("passes when approval is not required", () => {
    const result = evaluateHumanApproval({ required: false });
    expect(result.satisfied).toBe(true);
    expect(result.reason).toBe("HUMAN_APPROVAL_NOT_REQUIRED");
  });

  it("fails closed when approval is required without an approver", () => {
    const result = evaluateHumanApproval({ required: true, requestedApprover: "   " });
    expect(result.satisfied).toBe(false);
    expect(result.reason).toBe("HUMAN_APPROVER_REQUIRED");
  });

  it("rejects a self-asserted approver without an authenticated principal", () => {
    const result = evaluateHumanApproval({ required: true, requestedApprover: "edwin" });
    expect(result.satisfied).toBe(false);
    expect(result.reason).toBe("HUMAN_AUTHENTICATED_PRINCIPAL_REQUIRED");
  });

  it("rejects an approver that does not match the authenticated principal", () => {
    const result = evaluateHumanApproval({ required: true, requestedApprover: "someone", authenticatedPrincipal: "edwin" });
    expect(result.satisfied).toBe(false);
    expect(result.reason).toBe("HUMAN_APPROVER_MISMATCH");
  });

  it("satisfies when the approver matches the authenticated principal", () => {
    const result = evaluateHumanApproval({ required: true, requestedApprover: "edwin", authenticatedPrincipal: "edwin" });
    expect(result.satisfied).toBe(true);
    expect(result.approver).toBe("edwin");
  });
});
