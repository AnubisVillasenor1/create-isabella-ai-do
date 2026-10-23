package ai.gameover;

import ai.gameover.model.EvidenceReference;
import ai.gameover.model.UagpRequest;
import ai.gameover.model.ValidationResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.regex.Pattern;

/** Structural validation of a UAGP-1 request. No trust/ethics/risk judgement. */
public final class UagpValidator {

  private static final Pattern SHA256_HEX = Pattern.compile("^[0-9a-f]{64}$");
  private static final Set<String> KNOWN_KINDS =
      Set.of("BOOKPI_EVENT", "EXTERNAL_ATTESTATION", "HUMAN_APPROVAL", "TEST_RUN", "SPEC_REFERENCE");

  private UagpValidator() {
  }

  public static ValidationResult validate(UagpRequest request) {
    List<String> errors = new ArrayList<>();
    if (request == null) {
      return new ValidationResult(false, List.of("REQUEST_NOT_AN_OBJECT"));
    }
    if (!"UAGP-1".equals(request.protocol())) {
      errors.add("PROTOCOL_UNSUPPORTED");
    }
    if (blank(request.requestId())) {
      errors.add("REQUEST_ID_REQUIRED");
    }
    if (blank(request.passportId())) {
      errors.add("PASSPORT_ID_REQUIRED");
    }
    if (blank(request.objectiveTitle())) {
      errors.add("OBJECTIVE_TITLE_REQUIRED");
    }
    if (request.agent() == null) {
      errors.add("AGENT_REQUIRED");
    } else {
      if (blank(request.agent().id())) errors.add("AGENT_ID_REQUIRED");
      if (blank(request.agent().name())) errors.add("AGENT_NAME_REQUIRED");
      if (blank(request.agent().owner())) errors.add("AGENT_OWNER_REQUIRED");
      if (request.agent().capabilities() == null || request.agent().capabilities().isEmpty()
          || request.agent().capabilities().stream().anyMatch(UagpValidator::blank)) {
        errors.add("AGENT_CAPABILITIES_INVALID");
      }
    }
    if (request.actions() == null || request.actions().isEmpty()
        || request.actions().stream().anyMatch(UagpValidator::blank)) {
      errors.add("ACTIONS_REQUIRED");
    }
    if (request.criticality() != null
        && !Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL").contains(request.criticality())) {
      errors.add("CRITICALITY_INVALID");
    }
    if (request.humanApprovalRequired() != null && request.humanApprover() != null
        && request.humanApprover().length() > 256) {
      errors.add("HUMAN_APPROVER_INVALID");
    }
    if (request.trustMetrics() != null) {
      Set<String> allowedMetrics = Set.of("integrity", "competence", "alignment", "transparency", "humanOversight", "incidentRecord");
      for (Map.Entry<String, Double> metric : request.trustMetrics().entrySet()) {
        if (!allowedMetrics.contains(metric.getKey())) {
          errors.add("TRUST_METRIC_UNKNOWN");
          break;
        }
        Double value = metric.getValue();
        if (value == null || !Double.isFinite(value) || value < 0.0 || value > 100.0) {
          errors.add("TRUST_METRIC_INVALID:" + metric.getKey());
        }
      }
    }
    if (request.evidence() != null) {
      int index = 0;
      for (EvidenceReference evidence : request.evidence()) {
        if (evidence == null) {
          errors.add("EVIDENCE_" + index + "_INVALID");
        } else {
          if (blank(evidence.id())) errors.add("EVIDENCE_" + index + "_ID_REQUIRED");
          if (blank(evidence.kind()) || !KNOWN_KINDS.contains(evidence.kind())) errors.add("EVIDENCE_" + index + "_KIND_UNKNOWN");
          if (blank(evidence.uri())) errors.add("EVIDENCE_" + index + "_URI_REQUIRED");
          if (blank(evidence.sha256()) || !SHA256_HEX.matcher(evidence.sha256()).matches()) errors.add("EVIDENCE_" + index + "_SHA256_INVALID");
        }
        index++;
      }
    }
    return new ValidationResult(errors.isEmpty(), List.copyOf(errors));
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }
}
