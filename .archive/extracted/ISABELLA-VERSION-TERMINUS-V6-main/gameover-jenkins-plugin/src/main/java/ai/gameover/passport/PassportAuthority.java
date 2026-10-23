package ai.gameover.passport;

import ai.gameover.model.AIPassport;
import ai.gameover.model.AgentIdentity;
import ai.gameover.model.PassportVerification;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * In-memory AI Passport registry. Application-level; it is NOT a cryptographic
 * identity provider and does NOT federate with an external CA.
 */
public class PassportAuthority {

  private final Map<String, AIPassport> passports = new ConcurrentHashMap<>();
  private final int defaultValidityDays;

  public PassportAuthority() {
    this(365);
  }

  public PassportAuthority(int defaultValidityDays) {
    if (defaultValidityDays < 1 || defaultValidityDays > 3650) {
      throw new IllegalArgumentException("PASSPORT_VALIDITY_DAYS_INVALID");
    }
    this.defaultValidityDays = defaultValidityDays;
  }

  public AIPassport issue(AgentIdentity agent, String issuer, double trustScore) {
    return issue(agent, issuer, trustScore, defaultValidityDays);
  }

  public AIPassport issue(AgentIdentity agent, String issuer, double trustScore, int validityDays) {
    if (agent == null || agent.id() == null || agent.id().isBlank()) {
      throw new IllegalArgumentException("PASSPORT_AGENT_ID_REQUIRED");
    }
    if (agent.name() == null || agent.name().isBlank() || agent.owner() == null || agent.owner().isBlank()) {
      throw new IllegalArgumentException("PASSPORT_AGENT_IDENTITY_INCOMPLETE");
    }
    if (issuer == null || issuer.isBlank()) {
      throw new IllegalArgumentException("PASSPORT_ISSUER_REQUIRED");
    }
    if (!Double.isFinite(trustScore) || trustScore < 0.0 || trustScore > 100.0) {
      throw new IllegalArgumentException("PASSPORT_TRUST_SCORE_INVALID");
    }
    if (validityDays < 1 || validityDays > 3650) {
      throw new IllegalArgumentException("PASSPORT_VALIDITY_DAYS_INVALID");
    }
    if (agent.capabilities() == null || agent.capabilities().stream().anyMatch(value -> value == null || value.isBlank())) {
      throw new IllegalArgumentException("PASSPORT_CAPABILITIES_INVALID");
    }
    AgentIdentity sealedAgent = new AgentIdentity(
        agent.id(), agent.name(), agent.organization(), agent.owner(),
        java.util.List.copyOf(agent.capabilities()), agent.createdAt());
    Instant now = Instant.now();
    AIPassport passport = new AIPassport(
        UUID.randomUUID().toString(),
        sealedAgent,
        now.toString(),
        now.plus(validityDays, ChronoUnit.DAYS).toString(),
        issuer,
        certificationFor(trustScore),
        trustScore);
    passports.put(passport.id(), passport);
    return passport;
  }

  public AIPassport get(String id) {
    return passports.get(id);
  }

  public PassportVerification verify(String id) {
    AIPassport passport = passports.get(id);
    if (passport == null) {
      return new PassportVerification(id, false, "UNKNOWN", "PASSPORT_NOT_FOUND", "");
    }
    if ("REVOKED".equals(passport.certification())) {
      return new PassportVerification(id, false, "REVOKED", "PASSPORT_REVOKED", passport.expiresAt());
    }
    if (Instant.parse(passport.expiresAt()).isBefore(Instant.now())) {
      return new PassportVerification(id, false, passport.certification(), "PASSPORT_EXPIRED", passport.expiresAt());
    }
    if ("UNKNOWN".equals(passport.certification())) {
      return new PassportVerification(id, false, "UNKNOWN", "PASSPORT_NOT_CERTIFIED", passport.expiresAt());
    }
    return new PassportVerification(id, true, passport.certification(), "PASSPORT_VALID", passport.expiresAt());
  }

  public AIPassport revoke(String id, String reason) {
    AIPassport existing = passports.get(id);
    if (existing == null) {
      throw new IllegalArgumentException("PASSPORT_NOT_FOUND");
    }
    if (reason == null || reason.isBlank()) {
      throw new IllegalArgumentException("PASSPORT_REVOKE_REASON_REQUIRED");
    }
    AIPassport revoked = new AIPassport(existing.id(), existing.agent(), existing.issuedAt(), existing.expiresAt(),
        existing.issuer(), "REVOKED", existing.trustScore());
    passports.put(id, revoked);
    return revoked;
  }

  public java.util.List<AIPassport> list() {
    return List.copyOf(passports.values());
  }

  private static String certificationFor(double trustScore) {
    if (trustScore >= 85.0) return "CERTIFIED";
    if (trustScore >= 60.0) return "PROVISIONAL";
    return "UNKNOWN";
  }

  private static final java.util.List<AIPassport> UNUSED = java.util.List.of();

  static {
    ChronoUnit.DAYS.hashCode();
    Instant.now();
  }
}
