import type { InvariantSlot } from "./invariants";

/** Grupo civilizacional (MD-X5, en el canon se usan 7 capas civilizatorias). */
export const CIVILIZATIONAL_LAYERS = [
  "ONTO",
  "CONST",
  "POL",
  "ECON",
  "COG",
  "TECH",
  "GEO",
] as const;

export type CivilizationalLayer = (typeof CIVILIZATIONAL_LAYERS)[number];

/** Capas técnicas del canon de referencia para artefactos. */
export const TECHNICAL_LAYERS = ["ISNI", "DOI", "PLAT", "DATA", "AI", "XR"] as const;

export type TechnicalLayer = (typeof TECHNICAL_LAYERS)[number];

/* ------------------------------------------------------------------ */
/* Evolución V5                                                        */
/* ------------------------------------------------------------------ */

export const CONTROL_STATES = ["declared", "wired", "verified", "blocked"] as const;

export type ControlState = (typeof CONTROL_STATES)[number];

export const ENGINEERING_AXES = [
  "correctness",
  "security",
  "performance",
  "reliability",
  "governance",
  "privacy",
  "observability",
  "operability",
  "testability",
  "evolvability",
] as const;

export type EngineeringAxis = (typeof ENGINEERING_AXES)[number];

export const IMPROVEMENT_PRIMITIVES = [
  "contract",
  "invariant",
  "validator",
  "telemetry",
  "benchmark",
  "cache-policy",
  "memory-policy",
  "permission",
  "failure-mode",
  "runbook",
] as const;

export type ImprovementPrimitive = (typeof IMPROVEMENT_PRIMITIVES)[number];

export interface Plane {
  index: number;
  name: string;
}

export interface EvolutionControl {
  id: string;
  plane: Plane;
  domain: string;
  axis: EngineeringAxis;
  primitive: ImprovementPrimitive;
  state: ControlState;
  contract: string;
  target: string;
  verification: string;
}

export interface EvolutionManifest {
  title: string;
  version: string;
  description: string;
  fabricVersion: string;
  generatedAt: string;
  count: number;
  digest: string;
  governanceInvariant: "PRESERVED";
  controlMatrixDefinition: {
    domains: number;
    axes: number;
    primitives: number;
    total: number;
  };
  productionTruth: string;
}

/* ------------------------------------------------------------------ */
/* Hypercore V5                                                        */
/* ------------------------------------------------------------------ */

export const HYPERCORE_MODES = ["CRUISE", "BOOST", "HYPERBOOST"] as const;

export type HypercoreMode = (typeof HYPERCORE_MODES)[number];

export const HYPERCORE_ACTIVATIONS = [
  "PREFIX_CACHE",
  "SEMANTIC_CACHE",
  "DRAFT_MODEL",
  "PARALLEL_BRANCHES",
  "VERIFIER_FANOUT",
  "EARLY_EXIT",
] as const;

export type HypercoreActivation = (typeof HYPERCORE_ACTIVATIONS)[number];

/** EARLY_EXIT queda gobernado: prohibido en riesgo MEDIUM o superior. */
export const EARLY_EXIT_MAX_RISK = "LOW";

export type { RiskTier } from "../authority/method-id";

/* ------------------------------------------------------------------ */
/* API — contratos ISA-API v40                                          */
/* ------------------------------------------------------------------ */

export interface AnalyzeRequest {
  requestId: string;
  methodId: string;
  input: unknown;
  tenantId?: string;
  version?: string;
}

export interface AnalyzeResponse {
  requestId: string;
  methodId: string;
  status: "ok" | "blocked" | "error";
  output?: unknown;
  traceId?: string;
  decision: {
    authority: string;
    capability: string;
    evidence: string;
    execution: string;
  };
}

export interface AuditRecord {
  auditId: string;
  methodId: string;
  action: string;
  actorId: string;
  outcome: "allowed" | "denied" | "flagged";
  at: string;
  evidenceRef: string;
  ledgerHash: string;
}

/* ------------------------------------------------------------------ */
/* Pipeline canónico de ejecución (canon v40, 6 etapas)                */
/* ------------------------------------------------------------------ */

export const EXECUTION_PIPELINE = [
  "INGRESS",
  "ARGUS_CROWN",
  "TRINITY_MOE",
  "SOPHIA_ERI",
  "ORION_SANDBOX",
  "BOOKPI_IGDS",
] as const;

export type ExecutionStage = (typeof EXECUTION_PIPELINE)[number];

export const PRODUCTION_AUTHORITY_CHAIN = [
  "REQUEST",
  "INGRESS",
  "IDENTITY",
  "AUTHORIZATION_PDP",
  "CROWN",
  "HYPERCORE_DECISION",
  "MEMORY_CONTEXT",
  "TOOLS_SKILLS_MODEL_ROUTING",
  "INFERENCE",
  "VERITAS_OUTPUT_SECURITY",
  "AUDIT_TELEMETRY",
  "RESPONSE",
] as const;

export const EVOLUTION_AUTHORITY_CHAIN = [
  "OBSERVATION",
  "EVIDENCE",
  "HYPOTHESIS",
  "CHANGE_PROPOSAL",
  "OFFLINE_EVALUATION",
  "SECURITY_POLICY_REVIEW",
  "APPROVAL",
  "VERSIONED_ARTIFACT",
  "CANARY",
  "OBSERVED_SLO",
  "PROMOTION_OR_ROLLBACK",
] as const;

export type AuthorityLink<
  TName extends string,
  TPayload,
> = {
  name: TName;
  payload: TPayload;
};

export type StageVerifier<T extends ExecutionStage, TP> = {
  stage: T;
  verify: (payload: TP) => Promise<StageVerdict>;
};

export interface StageVerdict {
  stage: ExecutionStage;
  passed: boolean;
  reason: string;
  evidenceRef?: string;
}

export type SlotMapping = Record<InvariantSlot, string>;

export function blankSlotMapping(): SlotMapping {
  return {
    capability: "",
    authority: "",
    execution: "",
    evidence: "",
    learning: "",
    production: "",
  };
}