package ai.gameover;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ai.gameover.approval.HumanApprovalGate;
import org.junit.jupiter.api.Test;

class HumanApprovalGateTest {

  @Test
  void approvalNotRequiredPasses() {
    assertTrue(HumanApprovalGate.evaluate(false, null, null).satisfied());
  }

  @Test
  void requiresNamedApprover() {
    HumanApprovalGate.Approval result = HumanApprovalGate.evaluate(true, " ", "edwin");
    assertFalse(result.satisfied());
    assertEquals("HUMAN_APPROVER_REQUIRED", result.reason());
  }

  @Test
  void rejectsSelfAssertedApproverWithoutAuthenticatedPrincipal() {
    HumanApprovalGate.Approval result = HumanApprovalGate.evaluate(true, "edwin", null);
    assertFalse(result.satisfied());
    assertEquals("HUMAN_AUTHENTICATED_PRINCIPAL_REQUIRED", result.reason());
  }

  @Test
  void rejectsMismatchedPrincipal() {
    HumanApprovalGate.Approval result = HumanApprovalGate.evaluate(true, "someone", "edwin");
    assertFalse(result.satisfied());
    assertEquals("HUMAN_APPROVER_MISMATCH", result.reason());
  }

  @Test
  void acceptsMatchingAuthenticatedPrincipal() {
    HumanApprovalGate.Approval result = HumanApprovalGate.evaluate(true, "edwin", "edwin");
    assertTrue(result.satisfied());
  }
}
