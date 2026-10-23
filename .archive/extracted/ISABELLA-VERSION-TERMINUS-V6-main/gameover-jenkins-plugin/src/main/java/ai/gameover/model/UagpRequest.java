package ai.gameover.model;

import java.util.List;
import java.util.Map;

/**
 * A declared governance request under UAGP-1. Built by the Jenkins step from its
 * configuration; the engines never execute the described actions.
 */
public record UagpRequest(
    String requestId,
    String protocol,
    AgentIdentity agent,
    String passportId,
    String objectiveTitle,
    String objectiveDescription,
    java.util.List<String> actions,
    java.util.List<String> dataClasses,
    java.util.List<EvidenceReference> evidence,
    String criticality,
    java.util.Map<String, Double> trustMetrics,
    Boolean humanApprovalRequired,
    String humanApprover) {
}
