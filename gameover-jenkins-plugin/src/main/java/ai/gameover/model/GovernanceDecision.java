package ai.gameover.model;

import java.util.List;

/** The adjudicated governance decision for a request. */
public record GovernanceDecision(
    String requestId,
    String timestamp,
    String outcome,
    List<String> rationale,
    double trustScore,
    String riskLevel,
    boolean ethicsPassed,
    boolean humanApprovalRequired,
    String humanApprover,
    String explainability) {
}
