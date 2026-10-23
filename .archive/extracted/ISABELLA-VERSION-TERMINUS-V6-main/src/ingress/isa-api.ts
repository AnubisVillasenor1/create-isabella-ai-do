/**
 * ISA-API v40 — extensión nativa del contrato de API.
 *
 * Formaliza el pipeline de 12 etapas de producción, el acto operativo canónico
 * TAP v1.0 y los tipos de acto. Es un contrato declarativo y determinista; no
 * ejecuta red ni efectos externos.
 */
import { createHash, randomUUID } from "node:crypto";

/** Cadena de autoridad de producción (12 eslabones, canon v40). */
export const ISA_API_STAGES = [
  "normalization",
  "correlation",
  "authentication",
  "tenant_resolution",
  "schema_validation",
  "authorization",
  "crown",
  "moe_route",
  "sandbox",
  "veritas",
  "audit",
  "response",
] as const;

export type IsaApiStage = (typeof ISA_API_STAGES)[number];

/** Tipos de acto operativo canónico TAP v1.0. */
export const TAP_ACT_TYPES = ["AI.QUERY", "AI.EXEC", "GOV.VOTE", "MSR.AWARD"] as const;

export type TapActType = (typeof TAP_ACT_TYPES)[number];

export interface TapHumanReview {
  required: boolean;
  status: "not_required" | "pending" | "approved" | "rejected";
}

export interface TapSignature {
  algorithm: "ML-DSA" | "ML-DSA-65" | "SLH-DSA" | "Ed25519" | "NONE";
  keyId: string;
  /** prueba criptográfica; "NONE" no es una firma válida. */
  proofValue: string;
}

export interface TapAct {
  actId: string;
  actType: TapActType;
  issuer: string;
  subject: string;
  intent: string;
  scope: string;
  timestamp: string;
  nonce: string;
  policyVersion: string;
  inputCommitment: string;
  toolPermissions: readonly string[];
  humanReview: TapHumanReview;
  signature: TapSignature;
  traceId: string;
}

export interface TapActInput {
  actType: TapActType;
  issuer: string;
  subject: string;
  intent: string;
  scope: string;
  policyVersion: string;
  payload: unknown;
  toolPermissions?: readonly string[];
  traceId?: string;
  humanReview?: TapHumanReview;
  signature?: TapSignature;
  nonce?: string;
  timestamp?: string;
}

/** Actos de alto impacto que exigen revisión humana. */
export const HIGH_IMPACT_TRIGGERS = [
  "fundamental_rights",
  "sensitive_data",
  "legal_effect_decision",
  "untrusted_code_execution",
  "policy_modification",
  "funds_administration",
  "credential_change",
  "production_model_change",
  "critical_infrastructure",
  "minors_involved",
  "high_uncertainty",
] as const;

export type HighImpactTrigger = (typeof HIGH_IMPACT_TRIGGERS)[number];

export function requiresHumanReview(triggers: readonly HighImpactTrigger[]): boolean {
  return triggers.length > 0;
}

function commitment(payload: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(payload) ?? "").digest("hex")}`;
}

/**
 * Construye un acto TAP v1.0. Si se declaran disparadores de alto impacto, el acto
 * se marca con revisión humana pendiente (fail-closed) y una firma "NONE" no
 * satisface los controles obligatorios.
 */
export function buildTapAct(input: TapActInput, highImpactTriggers: readonly HighImpactTrigger[] = []): TapAct {
  if (!input.issuer.trim() || !input.subject.trim()) throw new Error("TAP: issuer and subject are required");
  if (!input.scope.trim()) throw new Error("TAP: scope is required");
  const highImpact = requiresHumanReview(highImpactTriggers);
  const humanReview: TapHumanReview = highImpact
    ? { required: true, status: input.humanReview?.status ?? "pending" }
    : (input.humanReview ?? { required: false, status: "not_required" });
  return {
    actId: `urn:uuid:${randomUUID()}`,
    actType: input.actType,
    issuer: input.issuer,
    subject: input.subject,
    intent: input.intent,
    scope: input.scope,
    timestamp: input.timestamp ?? new Date().toISOString(),
    nonce: input.nonce ?? randomUUID(),
    policyVersion: input.policyVersion,
    inputCommitment: commitment(input.payload),
    toolPermissions: Object.freeze([...(input.toolPermissions ?? [])]),
    humanReview,
    signature: input.signature ?? { algorithm: "NONE", keyId: "unset", proofValue: "" },
    traceId: input.traceId ?? randomUUID(),
  };
}

export interface TapActValidation {
  valid: boolean;
  missing: readonly string[];
  requiresHumanApproval: boolean;
  signatureSatisfied: boolean;
}

/** Valida los controles obligatorios de un acto TAP (identificador, firma, etc.). */
export function validateTapAct(act: TapAct): TapActValidation {
  const missing: string[] = [];
  if (!act.actId) missing.push("act_id");
  if (!act.issuer) missing.push("issuer");
  if (!act.subject) missing.push("subject");
  if (!act.scope) missing.push("scope");
  if (!act.timestamp) missing.push("timestamp");
  if (!act.nonce) missing.push("nonce");
  if (!act.policyVersion) missing.push("policy_version");
  if (!act.traceId) missing.push("trace_id");
  const signatureSatisfied = act.signature.algorithm !== "NONE" && act.signature.proofValue.length > 0;
  if (!signatureSatisfied) missing.push("signature");
  const requiresHumanApproval = act.humanReview.required && act.humanReview.status !== "approved";
  return { valid: missing.length === 0, missing, requiresHumanApproval, signatureSatisfied };
}

export interface IsaStageVerdict {
  stage: IsaApiStage;
  passed: boolean;
  detail: string;
}

/**
 * Evalúa el pipeline ISA-API de 12 etapas de forma declarativa. `authorization` y
 * `crown` deben declararse concedidos; de lo contrario el pipeline falla (fail-closed).
 */
export function evaluateIsaPipeline(flags: Partial<Record<IsaApiStage, boolean>>): {
  passed: boolean;
  verdicts: readonly IsaStageVerdict[];
} {
  const REQUIRED: readonly IsaApiStage[] = ["normalization", "correlation", "authentication", "tenant_resolution", "schema_validation", "authorization", "crown"];
  const verdicts = ISA_API_STAGES.map((stage) => {
    const required = REQUIRED.includes(stage);
    const passed = flags[stage] ?? !required;
    return { stage, passed, detail: passed ? "ok" : "not satisfied" };
  });
  return { passed: verdicts.every((v) => v.passed), verdicts };
}