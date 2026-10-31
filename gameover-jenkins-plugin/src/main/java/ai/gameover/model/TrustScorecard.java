package ai.gameover.model;

import java.util.Map;

/** Weighted trust scorecard derived from declared 0..100 metrics. */
public record TrustScorecard(
    double score,
    java.util.Map<String, Double> metrics,
    String level,
    String summary) {
}
