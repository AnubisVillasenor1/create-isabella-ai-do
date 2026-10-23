package ai.gameover;

import static org.junit.jupiter.api.Assertions.assertThrows;

import ai.gameover.model.AgentIdentity;
import ai.gameover.passport.PassportAuthority;
import java.util.List;
import org.junit.jupiter.api.Test;

class PassportAuthorityTest {

  private static final AgentIdentity AGENT =
      new AgentIdentity("agent-1", "Builder", "TAMV", "edwin", List.of("build"), "2026-01-01T00:00:00Z");

  @Test
  void rejectsOutOfRangeTrustScore() {
    PassportAuthority authority = new PassportAuthority();
    assertThrows(IllegalArgumentException.class, () -> authority.issue(AGENT, "tamv", Double.NaN));
    assertThrows(IllegalArgumentException.class, () -> authority.issue(AGENT, "tamv", 101.0));
  }

  @Test
  void rejectsInvalidPassportValidity() {
    PassportAuthority authority = new PassportAuthority();
    assertThrows(IllegalArgumentException.class, () -> authority.issue(AGENT, "tamv", 90.0, 0));
    assertThrows(IllegalArgumentException.class, () -> authority.issue(AGENT, "tamv", 90.0, 3651));
  }

  @Test
  void rejectsIncompleteAgentIdentity() {
    PassportAuthority authority = new PassportAuthority();
    AgentIdentity invalid = new AgentIdentity("agent-2", "", "TAMV", "edwin", List.of("build"), "now");
    assertThrows(IllegalArgumentException.class, () -> authority.issue(invalid, "tamv", 90.0));
  }
}
