package ai.gameover.model;

/** Bounded risk assessment for a governed action. Heuristic, not measured. */
public record RiskAssessment(
    double score,
    String level,
    String criticality,
    int capabilityCount,
    String summary) {
}
