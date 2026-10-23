/**
 * EVIDENCE_MANIFEST_SCHEMA — formato mínimo para hacer reproducible cada validación o release.
 *
 * Un manifest incompleto NO puede respaldar un estado `stable` sin una excepción
 * documentada y aprobada (EVIDENCE_MANIFEST_SCHEMA.md).
 */
import { createHash } from "node:crypto";

export type ValidationStatus = "passed" | "failed" | "partial" | "not_run";
export type ScanStatus = "passed" | "failed" | "skipped";

export interface ManifestValidation {
  status: ValidationStatus;
  tests: readonly string[];
  lsp: readonly string[];
}

export interface ManifestSecurity {
  secretScan: ScanStatus;
  dependencyScan: ScanStatus;
}

export interface EvidenceManifest {
  manifestId: string;
  repository: string;
  commit: string;
  createdAt: string;
  claimIds: readonly string[];
  sourceIds: readonly string[];
  validation: ManifestValidation;
  security: ManifestSecurity;
  policyDecision: string;
  bookpiAuditIds: readonly string[];
  rollbackPlan: string;
  limitations: readonly string[];
}

export interface EvidenceManifestSeed {
  repository: string;
  commit: string;
  claimIds?: readonly string[];
  sourceIds?: readonly string[];
  validation?: Partial<ManifestValidation>;
  security?: Partial<ManifestSecurity>;
  policyDecision?: string;
  bookpiAuditIds?: readonly string[];
  rollbackPlan?: string;
  limitations?: readonly string[];
  createdAt?: string;
}

const FULL_SHA = /^[0-9a-f]{40}$/i;

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value) ?? "", "utf8").digest("hex");
}

/** Construye un manifest con ID determinista basado en SHA-256 (EVM- + 64 hex). */
export function createEvidenceManifest(seed: EvidenceManifestSeed): EvidenceManifest {
  if (!seed.repository.trim()) throw new Error("MANIFEST: repository required");
  if (!FULL_SHA.test(seed.commit)) throw new Error("MANIFEST: commit must be a full 40-char sha");
  const core = {
    repository: seed.repository,
    commit: seed.commit,
    validation: {
      status: seed.validation?.status ?? "not_run",
      tests: [...(seed.validation?.tests ?? [])],
      lsp: [...(seed.validation?.lsp ?? [])],
    },
    security: {
      secretScan: seed.security?.secretScan ?? "skipped",
      dependencyScan: seed.security?.dependencyScan ?? "skipped",
    },
    policyDecision: seed.policyDecision ?? "DEC-UNSET",
  };
  return Object.freeze({
    manifestId: "EVM-" + hash({ ...core, claimIds: seed.claimIds ?? [], sourceIds: seed.sourceIds ?? [], bookpiAuditIds: seed.bookpiAuditIds ?? [], rollbackPlan: seed.rollbackPlan ?? "revert_commit", limitations: seed.limitations ?? [] }).slice(0, 64).toUpperCase(),
    repository: core.repository,
    commit: core.commit,
    createdAt: seed.createdAt ?? new Date().toISOString(),
    claimIds: Object.freeze([...(seed.claimIds ?? [])]),
    sourceIds: Object.freeze([...(seed.sourceIds ?? [])]),
    validation: Object.freeze({ ...core.validation, tests: Object.freeze(core.validation.tests), lsp: Object.freeze(core.validation.lsp) }),
    security: Object.freeze({ ...core.security }),
    policyDecision: core.policyDecision,
    bookpiAuditIds: Object.freeze([...(seed.bookpiAuditIds ?? [])]),
    rollbackPlan: seed.rollbackPlan ?? "revert_commit",
    limitations: Object.freeze([...(seed.limitations ?? [])]),
  });
}

export interface ManifestCompleteness {
  complete: boolean;
  missing: readonly string[];
}

/** Verifica que el manifest contenga todo lo requerido para respaldar `stable`. */
export function assessManifestCompleteness(manifest: EvidenceManifest): ManifestCompleteness {
  const missing: string[] = [];
  if (!manifest.repository.trim()) missing.push("repository");
  if (!FULL_SHA.test(manifest.commit)) missing.push("commit");
  if (!manifest.manifestId.trim()) missing.push("manifest_id");
  if (!Number.isFinite(Date.parse(manifest.createdAt))) missing.push("created_at");
  if (manifest.claimIds.length === 0) missing.push("claim_ids");
  if (manifest.sourceIds.length === 0) missing.push("source_ids");
  if (manifest.validation.status !== "passed") missing.push("validation.status");
  if (manifest.validation.tests.length === 0) missing.push("validation.tests");
  if (manifest.security.secretScan !== "passed") missing.push("security.secret_scan");
  if (manifest.security.dependencyScan !== "passed") missing.push("security.dependency_scan");
  if (!manifest.policyDecision || manifest.policyDecision === "DEC-UNSET") missing.push("policy_decision");
  if (manifest.bookpiAuditIds.length === 0) missing.push("bookpi_audit_ids");
  if (!manifest.rollbackPlan.trim()) missing.push("rollback_plan");
  return { complete: missing.length === 0, missing: Object.freeze(missing) };
}

/**
 * Decide si un estado `stable` puede declararse: requiere manifest completo o una
 * excepción documentada y aprobada explícitamente.
 */
export interface StabilityException {
  exceptionId: string;
  approver: string;
  rationale: string;
  approvedAt: string;
  evidenceId: string;
}

export type StabilityExceptionVerifier = (exception: StabilityException) => boolean;

/**
 * Una excepción solo cuenta si está documentada y una autoridad externa inyectada
 * verifica su aprobación. Un booleano aportado por el caller no es autorización.
 */
export function canClaimStable(
  manifest: EvidenceManifest,
  exception?: StabilityException,
  verifyException?: StabilityExceptionVerifier,
): boolean {
  if (assessManifestCompleteness(manifest).complete) return true;
  if (!exception || !verifyException) return false;
  if (![exception.exceptionId, exception.approver, exception.rationale, exception.evidenceId].every((value) => value.trim())) return false;
  if (!Number.isFinite(Date.parse(exception.approvedAt))) return false;
  try {
    return verifyException(exception) === true;
  } catch {
    return false;
  }
}
