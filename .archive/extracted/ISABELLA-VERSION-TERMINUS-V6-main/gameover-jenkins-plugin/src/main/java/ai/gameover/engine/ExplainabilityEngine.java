package ai.gameover.engine;

import java.util.List;

/** Deterministic narrative for a governance outcome. No language model invoked. */
public final class ExplainabilityEngine {

  private ExplainabilityEngine() {
  }

  public static String explain(String outcome, List<String> rationale, double trustScore, String riskLevel,
      boolean ethicsPassed, boolean humanApprovalRequired, String humanApprover) {
    String reasons = (rationale == null || rationale.isEmpty()) ? "no_specific_rule" : String.join(", ", rationale);
    String approval = humanApprovalRequired
        ? (humanApprover != null && !humanApprover.isBlank()
            ? "human approval recorded by " + humanApprover
            : "human approval REQUIRED and not yet recorded")
        : "no human approval mandated by policy";
    String ethics = ethicsPassed ? "ethics rules passed" : "ethics rules violated";
    return "Outcome " + outcome + ": " + reasons + ". trust=" + trustScore + "/100, risk=" + riskLevel + ", "
        + ethics + ", " + approval + ". Advisory to human authority; UAGP-1 does not execute the action.";
  }
}
