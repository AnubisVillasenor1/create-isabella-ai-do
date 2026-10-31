package ai.gameover.engine;

import ai.gameover.model.RiskAssessment;
import java.util.Set;

/** Bounded risk scoring from action criticality and declared capability count. */
public final class RiskEngine {

  private RiskEngine() {
  }

  public static RiskAssessment assessRisk(String criticality, int capabilityCount) {
    String crit = (criticality == null || criticality.isBlank()) ? "MEDIUM" : criticality;
    if (!Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL").contains(crit)) {
      crit = "CRITICAL";
    }
    double base = switch (crit) {
      case "LOW" -> 0.10;
      case "MEDIUM" -> 0.35;
      case "HIGH" -> 0.65;
      case "CRITICAL" -> 0.90;
      default -> 0.90;
    };
    int capabilities = Math.min(10_000, Math.max(0, capabilityCount));
    double penalty = Math.min(0.35, capabilities * 0.08);
    double score = round2(Math.min(1.0, Math.max(0.0, base + penalty)));
    String level = level(score);
    return new RiskAssessment(score, level, crit, capabilities,
        "risk=" + score + " (" + level + ") from criticality " + crit + " + " + capabilities + " capabilities");
  }

  private static String level(double score) {
    if (score < 0.25) return "LOW";
    if (score < 0.55) return "MEDIUM";
    if (score < 0.80) return "HIGH";
    return "CRITICAL";
  }

  private static double round2(double value) {
    return Math.round(value * 100.0) / 100.0;
  }
}
