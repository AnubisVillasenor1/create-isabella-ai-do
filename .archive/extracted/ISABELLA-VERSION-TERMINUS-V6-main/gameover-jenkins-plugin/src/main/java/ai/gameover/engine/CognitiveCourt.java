package ai.gameover.engine;

import java.util.ArrayList;
import java.util.List;

/** Adjudicates ethics, trust and risk into an outcome with rationale. */
public final class CognitiveCourt {

  private static final double CRITICAL_TRUST_FLOOR = 85.0;
  private static final double HIGH_RISK_TRUST_FLOOR = 70.0;

  private CognitiveCourt() {
  }

  /** Verdict outcome is one of ACCEPT / REJECT / ESCALATE. */
  public record Verdict(String outcome, List<String> rationale) {
  }

  public static Verdict adjudicate(boolean ethicsPassed, String riskLevel, double trustScore) {
    List<String> rationale = new ArrayList<>();
    if (!ethicsPassed) {
      rationale.add("ETHICS_VIOLATION");
      return new Verdict("REJECT", List.copyOf(rationale));
    }
    if ("CRITICAL".equals(riskLevel) && trustScore < CRITICAL_TRUST_FLOOR) {
      rationale.add("CRITICAL_RISK_LOW_TRUST");
      return new Verdict("ESCALATE", List.copyOf(rationale));
    }
    if ("HIGH".equals(riskLevel) && trustScore < HIGH_RISK_TRUST_FLOOR) {
      rationale.add("HIGH_RISK_INSUFFICIENT_TRUST");
      return new Verdict("REJECT", List.copyOf(rationale));
    }
    rationale.add("ETHICS_PASSED");
    rationale.add("RISK_" + riskLevel + "_WITHIN_TRUST_FLOOR");
    return new Verdict("ACCEPT", List.copyOf(rationale));
  }
}
