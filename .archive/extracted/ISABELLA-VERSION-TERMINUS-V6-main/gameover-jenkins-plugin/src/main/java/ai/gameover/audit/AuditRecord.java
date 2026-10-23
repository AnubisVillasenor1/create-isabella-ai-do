package ai.gameover.audit;

/** One append-only audit entry in the local BookPI mirror. */
public record AuditRecord(
    String type,
    String methodId,
    String principal,
    String riskTier,
    String status,
    String hash,
    String previousHash,
    long sequence) {
}
