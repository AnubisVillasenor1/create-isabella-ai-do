package ai.gameover.model;

/** The result of governing a request through the UAGP-1 pipeline. */
public record UagpResult(
    String requestId,
    String protocol,
    String outcome,
    boolean allowed,
    GovernanceDecision decision,
    TrustScorecard trust,
    RiskAssessment risk,
    PassportVerification passport,
    ValidationResult validation,
    String auditHash,
    long auditSequence,
    String disclaimer) {
}
