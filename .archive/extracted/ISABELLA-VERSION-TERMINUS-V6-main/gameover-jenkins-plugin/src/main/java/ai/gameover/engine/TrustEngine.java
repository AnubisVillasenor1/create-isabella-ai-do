package ai.gameover.engine;

import ai.gameover.model.TrustScorecard;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Weighted trust scorecard over declared 0..100 metrics. The weights are
 * declared heuristics, not measured accuracy.
 */
public final class TrustEngine {

  private static final Map<String, Double> WEIGHTS = new LinkedHashMap<>();

  static {
    WEIGHTS.put("integrity", 0.30);
    WEIGHTS.put("competence", 0.20);
    WEIGHTS.put("alignment", 0.15);
    WEIGHTS.put("transparency", 0.15);
    WEIGHTS.put("humanOversight", 0.10);
    WEIGHTS.put("incidentRecord", 0.10);
  }

  private TrustEngine() {
  }

  public static TrustScorecard scoreTrust(java.util.Map<String, Double> metrics) {
    java.util.Map<String, Double> resolved = new java.util.LinkedHashMap<>();
    double weighted = 0.0;
    for (java.util.Map.Entry<String, Double> entry : WEIGHTS.entrySet()) {
      double value = clamp(metrics == null ? null : metrics.get(entry.getKey()));
      resolved.put(entry.getKey(), value);
      weighted += value * entry.getValue();
    }
    double score = round2(weighted);
    String level = level(score);
    return new TrustScorecard(score, resolved, level, "trust=" + score + "/100 (" + level + "); declared weights, not measured accuracy");
  }

  private static double clamp(Double value) {
    if (value == null || value.isNaN() || value.isInfinite()) {
      return 0.0;
    }
    return Math.min(100.0, Math.max(0.0, value));
  }

  private static String level(double score) {
    if (score >= 90) return "EXEMPLARY";
    if (score >= 75) return "HIGH";
    if (score >= 50) return "MODERATE";
    if (score >= 25) return "LOW";
    return "UNTRUSTED";
  }

  private static double round2(double value) {
    return Math.round(value * 100.0) / 100.0;
  }
}
