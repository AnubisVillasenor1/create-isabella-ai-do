package ai.gameover.audit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;

/**
 * Append-only, hash-chained audit ledger (in-memory mirror of BookPI). Records
 * governance decisions on the Jenkins side. Not a WORM device and not hardware
 * immutability; the authoritative ledger lives in Isabella's BookPI.
 */
public class BookPILedger {

  private static final String GENESIS = "0".repeat(64);
  private final List<AuditRecord> events = new ArrayList<>();

  public synchronized AuditRecord append(String type, String methodId, String principal, String riskTier, String status) {
    long sequence = events.size() + 1L;
    String previousHash = events.isEmpty() ? GENESIS : events.get(events.size() - 1).hash();
    String payload = String.join("|", type, methodId, principal, riskTier, status, previousHash, Long.toString(sequence));
    AuditRecord record = new AuditRecord(type, methodId, principal, riskTier, status, sha256(payload), previousHash, sequence);
    events.add(record);
    return record;
  }

  public List<AuditRecord> list() {
    return List.copyOf(events);
  }

  public boolean verify() {
    String previousHash = GENESIS;
    long expectedSequence = 1L;
    for (AuditRecord record : events) {
      String payload = String.join("|", record.type(), record.methodId(), record.principal(), record.riskTier(),
          record.status(), previousHash, Long.toString(expectedSequence));
      if (!record.previousHash().equals(previousHash) || !record.hash().equals(sha256(payload))) {
        return false;
      }
      previousHash = record.hash();
      expectedSequence++;
    }
    return true;
  }

  private static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder(bytes.length * 2);
      for (byte b : bytes) {
        builder.append(String.format("%02x", b));
      }
      return builder.toString();
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 unavailable", error);
    }
  }
}
