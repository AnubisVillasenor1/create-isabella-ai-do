package ai.gameover.model;

/** An issued AI Passport. Application-level registry entry, not a CA certificate. */
public record AIPassport(
    String id,
    AgentIdentity agent,
    String issuedAt,
    String expiresAt,
    String issuer,
    String certification,
    double trustScore) {
}
