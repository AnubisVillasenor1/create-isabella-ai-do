/**
 * IKES_SPEC — contrato canónico de evolución del conocimiento.
 *
 * Pipeline:
 *   ingestion → sanitization → identity → claims → evidence → temporal analysis
 *   → policy gate → audit → Git commit → index → reconciliation → release
 *
 * Principio: Isabella propone; el repositorio admite. El conocimiento se conserva,
 * clasifica, vincula y versiona. DOI/ORCID son provenance, no validación automática.
 */
import { createHash } from "node:crypto";
import type { EpistemicState, TemporalState } from "./ikes";

/** Estados epistemológicos canónicos (IKES_SPEC §Estados epistemológicos). */
export const EPISTEMIC_STATUSES = [
  "E0_UNVERIFIED",
  "E1_SOURCE_FOUND",
  "E2_CORROBORATED",
  "E3_ACADEMICALLY_SUPPORTED",
  "E4_EMPIRICALLY_REPRODUCIBLE",
  "E5_VALIDATED",
  "E6_ESTABLISHED",
  "ED_DISPUTED",
  "EX_REJECTED",
  "DP_DEPRECATED",
] as const;

export type EpistemicStatus = (typeof EPISTEMIC_STATUSES)[number];

/** Estados temporales canónicos (IKES_SPEC §Estados temporales). */
export const TEMPORAL_STATUSES = [
  "historical",
  "current",
  "superseded",
  "corrected",
  "disputed",
  "deprecated",
] as const;

export type TemporalStatus = (typeof TEMPORAL_STATUSES)[number];

/** Etapas del pipeline canónico. */
export const IKES_PIPELINE = [
  "ingestion",
  "sanitization",
  "identity",
  "claims",
  "evidence",
  "temporal_analysis",
  "policy_gate",
  "audit",
  "git_commit",
  "index",
  "reconciliation",
  "release",
] as const;

export type IkesStage = (typeof IKES_PIPELINE)[number];

/**
 * Contrato mínimo de una entrada de conocimiento (IKES_SPEC §Contrato mínimo).
 * `git_commit` es nullable hasta que exista commit; `audit_ids` enlaza BookPI.
 */
export interface KnowledgeEntry {
  id: string;
  entityId: string;
  claimIds: readonly string[];
  sourceIds: readonly string[];
  evidenceIds: readonly string[];
  temporalStatus: TemporalStatus;
  epistemicStatus: EpistemicStatus;
  provenanceId: string;
  gitCommit: string | null;
  auditIds: readonly string[];
}

export interface KnowledgeEntrySeed {
  entityId: string;
  provenanceId: string;
  claimIds?: readonly string[];
  sourceIds?: readonly string[];
  evidenceIds?: readonly string[];
  temporalStatus?: TemporalStatus;
  epistemicStatus?: EpistemicStatus;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value) ?? "", "utf8").digest("hex");
}

/** Crea una entrada canónica con id determinista KNO-XXXXXXXX. */
export function createKnowledgeEntry(seed: KnowledgeEntrySeed): KnowledgeEntry {
  if (!seed.entityId.trim()) throw new Error("IKES: entityId required");
  if (!seed.provenanceId.trim()) throw new Error("IKES: provenanceId required");
  const core = {
    entityId: seed.entityId,
    provenanceId: seed.provenanceId,
    claimIds: [...(seed.claimIds ?? [])],
    sourceIds: [...(seed.sourceIds ?? [])],
    evidenceIds: [...(seed.evidenceIds ?? [])],
    temporalStatus: seed.temporalStatus ?? ("current" as TemporalStatus),
    epistemicStatus: seed.epistemicStatus ?? ("E0_UNVERIFIED" as EpistemicStatus),
  };
  return Object.freeze({
    id: `KNO-${hash(core).slice(0, 8).toUpperCase()}`,
    ...core,
    claimIds: Object.freeze([...core.claimIds]),
    sourceIds: Object.freeze([...core.sourceIds]),
    evidenceIds: Object.freeze([...core.evidenceIds]),
    gitCommit: null,
    auditIds: Object.freeze([] as string[]),
  });
}

/** Mapea los estados del motor en memoria a los estados epistemológicos canónicos. */
export function toEpistemicStatus(state: EpistemicState): EpistemicStatus {
  const map: Record<EpistemicState, EpistemicStatus> = {
    E0_UNVERIFIED: "E0_UNVERIFIED",
    E1_SOURCE_FOUND: "E1_SOURCE_FOUND",
    E2_CORROBORATED: "E2_CORROBORATED",
    E3_ACADEMICALLY_SUPPORTED: "E3_ACADEMICALLY_SUPPORTED",
    E4_REPRODUCIBLE: "E4_EMPIRICALLY_REPRODUCIBLE",
    E5_VALIDATED: "E5_VALIDATED",
    E6_ESTABLISHED: "E6_ESTABLISHED",
    ED_DISPUTED: "ED_DISPUTED",
    EX_REJECTED: "EX_REJECTED",
    DP_DEPRECATED: "DP_DEPRECATED",
  };
  return map[state];
}

/** Mapea el estado temporal del motor en memoria al canónico. */
export function toTemporalStatus(state: TemporalState): TemporalStatus {
  return state;
}

/**
 * Regla de preservación (IKES_SPEC §Regla de preservación):
 * solo se permite eliminación automática ante artefacto idéntico o duplicado
 * verificado. Ante duda: PRESERVE → CLASSIFY → LINK → VERSION.
 */
export type PreservationDecision = "ALLOW_DELETE" | "PRESERVE";

export function decidePreservation(
  verdict: "IDENTICAL_ARTIFACT" | "VERIFIED_DUPLICATE" | "LIKELY_UPDATE" | "ENRICHMENT" | "DISTINCT",
): PreservationDecision {
  // No proof-bearing duplicate-verification contract is wired here yet.
  // Therefore only byte-identical artifacts qualify for automatic deletion.
  return verdict === "IDENTICAL_ARTIFACT" ? "ALLOW_DELETE" : "PRESERVE";
}

export interface IkesStageResult {
  stage: IkesStage;
  ok: boolean;
  detail: string;
}

export interface IkesPipelineInput {
  entry: KnowledgeEntry;
  /** true solo si la sanitización admitió el material (no QUARANTINED/REJECTED). */
  sanitizationAdmitted: boolean;
  /** true si el policy gate autorizó la admisión. */
  policyGateGranted: boolean;
  /** commit Git asociado, si ya existe. */
  gitCommit?: string;
  /** ids de auditoría BookPI generados por la etapa de audit. */
  auditIds?: readonly string[];
  /** true si el índice de recuperación aceptó la entrada. */
  indexed?: boolean;
}

export interface IkesPipelineResult {
  entry: KnowledgeEntry;
  stages: readonly IkesStageResult[];
  released: boolean;
}

/**
 * Ejecuta el pipeline de evolución de conocimiento de forma gobernada.
 * Ninguna etapa posterior puede declarar `release` si una etapa previa falló:
 * la admisión es fail-closed y requiere evidencia + policy gate + reconciliación.
 */
export function runIkesPipeline(input: IkesPipelineInput): IkesPipelineResult {
  const stages: IkesStageResult[] = [];
  const push = (stage: IkesStage, ok: boolean, detail: string) => stages.push({ stage, ok, detail });

  push("ingestion", true, `entity=${input.entry.entityId}`);
  push("sanitization", input.sanitizationAdmitted, input.sanitizationAdmitted ? "admitted" : "quarantined_or_rejected");
  push("identity", input.entry.id.startsWith("KNO-"), `id=${input.entry.id}`);
  // Una entrada sin claims extraídos no es todavía una afirmación de conocimiento:
  // el pipeline es fail-closed en la etapa de claims, no una verdad vacua.
  push("claims", input.entry.claimIds.length > 0, `${input.entry.claimIds.length} claims`);
  push("evidence", input.entry.evidenceIds.length > 0, `${input.entry.evidenceIds.length} evidence`);
  push("temporal_analysis", true, `temporal=${input.entry.temporalStatus}`);
  push("policy_gate", input.policyGateGranted, input.policyGateGranted ? "granted" : "denied");
  const hasAudit = (input.auditIds?.length ?? 0) > 0;
  push("audit", hasAudit, `${input.auditIds?.length ?? 0} audit ids`);
  const validGitCommit = typeof input.gitCommit === "string" && /^[a-f0-9]{40,64}$/i.test(input.gitCommit);
  push("git_commit", validGitCommit, validGitCommit ? input.gitCommit! : "missing_or_invalid_commit");
  push("index", input.indexed === true, input.indexed === true ? "indexed" : "not_indexed");

  const hasEvidence = input.entry.evidenceIds.length > 0;
  const reconciliable = input.sanitizationAdmitted && input.policyGateGranted && hasEvidence && hasAudit && validGitCommit && input.indexed === true;
  push("reconciliation", reconciliable, reconciliable ? "consistent" : "inconsistent");

  const released = stages.every((s) => s.ok);
  push("release", released, released ? "released" : "blocked");

  const entry: KnowledgeEntry = Object.freeze({
    ...input.entry,
    claimIds: Object.freeze([...input.entry.claimIds]),
    sourceIds: Object.freeze([...input.entry.sourceIds]),
    evidenceIds: Object.freeze([...input.entry.evidenceIds]),
    gitCommit: input.gitCommit ?? input.entry.gitCommit,
    auditIds: Object.freeze([...(input.auditIds ?? input.entry.auditIds)]),
  });

  return { entry, stages: Object.freeze(stages), released };
}
