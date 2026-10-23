package ai.gameover;

import static org.junit.jupiter.api.Assertions.assertEquals;

import ai.gameover.engine.TrustEngine;
import ai.gameover.model.TrustScorecard;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TrustEngineTest {

  @Test
  void allExemplaryMetricsScore100() {
    TrustScorecard card = TrustEngine.scoreTrust(Map.of(
        "integrity", 100.0, "competence", 100.0, "alignment", 100.0,
        "transparency", 100.0, "humanOversight", 100.0, "incidentRecord", 100.0));
    assertEquals(100.0, card.score());
    assertEquals("EXEMPLARY", card.level());
  }

  @Test
  void missingMetricsAreZero() {
    assertEquals(0.0, TrustEngine.scoreTrust(Map.of()).score());
    assertEquals("UNTRUSTED", TrustEngine.scoreTrust(Map.of()).level());
  }

  @Test
  void appliesDeclaredWeights() {
    assertEquals(30.0, TrustEngine.scoreTrust(Map.of("integrity", 100.0)).score());
  }

  @Test
  void clampsOutOfRangeMetrics() {
    TrustScorecard card = TrustEngine.scoreTrust(Map.of("integrity", 150.0, "competence", -20.0));
    assertEquals(100.0, card.metrics().get("integrity"));
    assertEquals(0.0, card.metrics().get("competence"));
    assertEquals(30.0, card.score());
  }
}
