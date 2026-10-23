import { createHash } from "node:crypto";
import type { ControlState, EvolutionControl } from "../core/types";

export interface ControlEvidence {
  evidenceId: string;
  controlId: string;
  kind: "TEST" | "BENCHMARK" | "SECURITY_REVIEW" | "HUMAN_REVIEW" | "RUNTIME_TELEMETRY" | "EXTERNAL_AUDIT";
  uri?: string;
  commitSha?: string;
  observedAt: string;
  passed: boolean;
  details: string;
  digest: string;
}

function canonicalEvidencePayload(input: Omit<ControlEvidence, "evidenceId" | "digest">): string {
  return JSON.stringify({
    controlId: input.controlId,
    kind: input.kind,
    uri: input.uri,
    commitSha: input.commitSha,
    observedAt: input.observedAt,
    passed: input.passed,
    details: input.details,
  });
}

export function createEvidence(input: Omit<ControlEvidence, "evidenceId" | "digest">): ControlEvidence {
  if (!input.controlId.trim() || !input.details.trim()) throw new Error("EVIDENCE_METADATA_REQUIRED");
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("EVIDENCE_OBSERVED_AT_INVALID");
  if (input.commitSha && !/^[a-f0-9]{40,64}$/i.test(input.commitSha)) throw new Error("EVIDENCE_COMMIT_SHA_INVALID");
  if (input.uri) {
    let uri: URL;
    try { uri = new URL(input.uri); } catch { throw new Error("EVIDENCE_URI_INVALID"); }
    if (uri.protocol !== "https:") throw new Error("EVIDENCE_URI_MUST_USE_HTTPS");
  }
  const digest = createHash("sha256").update(canonicalEvidencePayload(input), "utf8").digest("hex");
  return Object.freeze({ ...input, evidenceId: "evd_" + digest.slice(0, 24), digest });
}

/** Validates the evidence record digest; this does not prove its source is trustworthy. */
export function verifyEvidenceIntegrity(evidence: ControlEvidence): boolean {
  const { evidenceId, digest, ...payload } = evidence;
  const expected = createHash("sha256").update(canonicalEvidencePayload(payload), "utf8").digest("hex");
  return digest === expected && evidenceId === "evd_" + expected.slice(0, 24);
}

export type ControlEvidenceVerifier = (evidence: ControlEvidence) => boolean;

/**
 * A self-issued passed=true record is only a claim. Promotion requires an
 * injected verifier that validates provenance/authority for each evidence item.
 */
export function canPromoteToVerified(
  control: EvolutionControl,
  evidence: readonly ControlEvidence[],
  verifyEvidence?: ControlEvidenceVerifier,
): boolean {
  if (control.state !== "wired" || !verifyEvidence) return false;
  const valid = evidence.filter((item) => {
    if (item.controlId !== control.id || !item.passed || !verifyEvidenceIntegrity(item)) return false;
    try { return verifyEvidence(item) === true; } catch { return false; }
  });
  const hasRuntimeOrReview = valid.some((e) => e.kind === "RUNTIME_TELEMETRY" || e.kind === "HUMAN_REVIEW" || e.kind === "EXTERNAL_AUDIT");
  const hasIndependentTest = valid.some((e) => e.kind === "TEST" || e.kind === "SECURITY_REVIEW" || e.kind === "BENCHMARK");
  return hasRuntimeOrReview && hasIndependentTest;
}

export function nextEvidenceState(control: EvolutionControl, evidence: readonly ControlEvidence[], verifyEvidence?: ControlEvidenceVerifier): ControlState {
  if (control.state === "blocked") return "blocked";
  return canPromoteToVerified(control, evidence, verifyEvidence) ? "verified" : control.state;
}
