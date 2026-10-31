package ai.gameover;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ai.gameover.model.AgentIdentity;
import ai.gameover.model.UagpRequest;
import ai.gameover.model.ValidationResult;
import java.util.List;
import org.junit.jupiter.api.Test;

class UagpValidatorTest {

  private static UagpRequest request(String protocol) {
    return new UagpRequest("req-1", protocol,
        new AgentIdentity("agent-1", "Builder", "TAMV", "edwin", List.of("build"), "2026-01-01T00:00:00Z"),
        "pp-1", "build image", "", List.of("build"), List.of(), List.of(), "LOW", java.util.Map.of(), null, null);
  }

  @Test
  void acceptsWellFormedRequest() {
    ValidationResult result = UagpValidator.validate(request("UAGP-1"));
    assertTrue(result.valid());
    assertTrue(result.errors().isEmpty());
  }

  @Test
  void rejectsNullRequest() {
    assertFalse(UagpValidator.validate(null).valid());
  }

  @Test
  void rejectsUnsupportedProtocol() {
    assertTrue(UagpValidator.validate(request("UAGP-0")).errors().contains("PROTOCOL_UNSUPPORTED"));
  }

  @Test
  void rejectsInvalidCriticalityAndOutOfRangeTrustMetrics() {
    UagpRequest invalid = new UagpRequest("req-1", "UAGP-1",
        new AgentIdentity("agent-1", "Builder", "TAMV", "edwin", List.of("build"), "2026-01-01T00:00:00Z"),
        "pp-1", "build image", "", List.of("build"), List.of(), List.of(), "EXTREME",
        java.util.Map.of("integrity", 101.0), null, null);
    ValidationResult result = UagpValidator.validate(invalid);
    assertFalse(result.valid());
    assertTrue(result.errors().contains("CRITICALITY_INVALID"));
    assertTrue(result.errors().contains("TRUST_METRIC_INVALID:integrity"));
  }

  @Test
  void requiresActions() {
    UagpRequest noActions = new UagpRequest("req-1", "UAGP-1",
        new AgentIdentity("a", "n", "o", "owner", List.of(), "t"), "pp", "obj", "",
        List.of(), List.of(), List.of(), "LOW", java.util.Map.of(), null, null);
    assertTrue(UagpValidator.validate(noActions).errors().contains("ACTIONS_REQUIRED"));
  }
}
