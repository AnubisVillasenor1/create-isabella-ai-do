package ai.gameover.model;

import java.util.List;

/** Structural validation result for a UAGP-1 request. */
public record ValidationResult(
    boolean valid,
    List<String> errors) {
}
