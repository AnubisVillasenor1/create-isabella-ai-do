package ai.gameover.model;

/** Verification result for an AI Passport. */
public record PassportVerification(
    String id,
    boolean valid,
    String certification,
    String reason,
    String expiresAt) {
}
