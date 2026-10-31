package ai.gameover.engine;

import ai.gameover.model.UagpRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Deterministic ethics rule evaluation. Reports violations; measures no intent. */
public final class EthicsEngine {

  private static final List<String> SENSITIVE =
      List.of("pii", "phi", "financial", "credential", "secret");
  private static final List<String> FORBIDDEN =
      List.of("exfiltrate", "exfiltration", "bypass_governance", "disable_audit", "tamper_audit", "destroy_evidence", "conceal");

  private EthicsEngine() {
  }

  public static List<String> evaluate(UagpRequest request) {
    List<String> violations = new ArrayList<>();
    if (request == null || request.agent() == null
        || blank(request.agent().id()) || blank(request.agent().name()) || blank(request.agent().owner())) {
      violations.add("E_IDENTITY_INCOMPLETE");
    }
    if (request == null || blank(request.objectiveTitle())) {
      violations.add("E_OBJECTIVE_REQUIRED");
    }
    if (request == null || request.actions() == null || request.actions().isEmpty()) {
      violations.add("E_ACTION_REQUIRED");
    }

    StringBuilder intent = new StringBuilder();
    if (request != null) {
      intent.append(nullToEmpty(request.objectiveTitle())).append(' ')
          .append(nullToEmpty(request.objectiveDescription())).append(' ');
      if (request.actions() != null) {
        intent.append(String.join(" ", request.actions()));
      }
    }
    String text = intent.toString().toLowerCase(Locale.ROOT);
    for (String token : FORBIDDEN) {
      if (text.contains(token)) {
        violations.add("E_FORBIDDEN_INTENT:" + token);
      }
    }

    boolean sensitive = request != null && request.dataClasses() != null
        && request.dataClasses().stream().map(value -> value.toLowerCase(Locale.ROOT)).anyMatch(SENSITIVE::contains);
    boolean hasEvidence = request != null && request.evidence() != null && !request.evidence().isEmpty();
    if (sensitive && !hasEvidence) {
      violations.add("E_EVIDENCE_REQUIRED_FOR_SENSITIVE_DATA");
    }

    return List.copyOf(violations);
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }

  private static String nullToEmpty(String value) {
    return value == null ? "" : value;
  }
}
