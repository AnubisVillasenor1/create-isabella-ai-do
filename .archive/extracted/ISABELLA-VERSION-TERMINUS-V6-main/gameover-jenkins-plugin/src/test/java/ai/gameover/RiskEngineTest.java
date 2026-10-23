package ai.gameover;

import static org.junit.jupiter.api.Assertions.assertEquals;

import ai.gameover.engine.RiskEngine;
import ai.gameover.model.RiskAssessment;
import org.junit.jupiter.api.Test;

class RiskEngineTest {

  @Test
  void baseCriticalityMapsToLevel() {
    assertEquals(0.1, RiskEngine.assessRisk("LOW", 0).score());
    assertEquals("LOW", RiskEngine.assessRisk("LOW", 0).level());
    assertEquals(0.35, RiskEngine.assessRisk("MEDIUM", 0).score());
    assertEquals("CRITICAL", RiskEngine.assessRisk("CRITICAL", 0).level());
  }

  @Test
  void treatsInvalidCriticalityAsCritical() {
    RiskAssessment risk = RiskEngine.assessRisk("UNRECOGNIZED", 0);
    assertEquals("CRITICAL", risk.criticality());
    assertEquals("CRITICAL", risk.level());
  }

  @Test
  void defaultsToMediumCriticality() {
    assertEquals("MEDIUM", RiskEngine.assessRisk(null, 0).criticality());
    assertEquals(0.35, RiskEngine.assessRisk(null, 0).score());
  }

  @Test
  void addsCapabilityPenalty() {
    assertEquals(0.43, RiskEngine.assessRisk("MEDIUM", 1).score());
    assertEquals(0.51, RiskEngine.assessRisk("MEDIUM", 2).score());
  }

  @Test
  void capsPenaltyAndClampsScore() {
    assertEquals(1.0, RiskEngine.assessRisk("HIGH", 10).score());
    assertEquals("CRITICAL", RiskEngine.assessRisk("HIGH", 10).level());
  }
}
