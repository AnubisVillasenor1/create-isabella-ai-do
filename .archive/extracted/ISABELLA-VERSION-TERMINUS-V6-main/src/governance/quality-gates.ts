/**
 * QUALITY_GATES — gates mínimos para eliminar errores, sesgos e inconsistencias
 * antes de promoción (15 gates canónicos).
 *
 * Dependencias: todos los módulos canónicos, CI, BookPI.
 */
import { assessManifestCompleteness, type EvidenceManifest } from "./evidence-manifest";
import { isInvariantPreserved } from "../core/invariants";

export const QUALITY_GATES = [
  "schema",
  "truthfulness",
  "identity",
  "preservation",
  "temporal",
  "security",
  "tenant",
  "concurrency",
  "evidence",
  "reproducibility",
  "external_actions",
  "licensing",
  "rollback",
  "no_overclaim",
  "human_gate",
] as const;

export type QualityGate = (typeof QUALITY_GATES)[number];

export interface QualityGateInput {
  /** 1. schema: todos los archivos tienen contexto, estado y dependencias. */
  allFilesHaveSchema: boolean;
  /** 2. truthfulness: no se presentan mocks/simulaciones/planes como producción. */
  noMockAsProduction: boolean;
  /** 3. identity: duplicados se deciden con hash, estructura, semántica, claims y tiempo. */
  identityMultiSignal: boolean;
  /** 4. preservation: ante duda se conserva. */
  preservationPolicyActive: boolean;
  /** 5. temporal: current e historical se recuperan según la consulta. */
  temporalRetrievalActive: boolean;
  /** 6. security: secretos, PII y malware se detectan antes de indexar. */
  securityPreIndexScan: boolean;
  /** 7. tenant: ningún manager, proxy, índice o LSP cruza tenants. */
  tenantIsolationEnforced: boolean;
  /** 8. concurrency: no hay carreras de entidad, commit o release. */
  concurrencySerialized: boolean;
  /** 9. evidence: cada afirmación importante tiene provenance y estado epistemológico. */
  evidenceManifest?: EvidenceManifest;
  /** 10. reproducibility: commit completo, configuración, entorno, pruebas y limitaciones. */
  reproducibilityDocumented: boolean;
  /** 11. external actions: push, PR, borrado y deploy requieren policy gate y aprobación. */
  externalActionsGated: boolean;
  /** 12. licensing: conservar avisos y licencias de terceros. */
  thirdPartyLicensesPreserved: boolean;
  /** 13. rollback: todo release tiene reversión verificable. */
  rollbackPlanPresent: boolean;
  /** 14. no overclaim: un resultado técnico no se eleva a verdad científica. */
  noTechnicalOverclaim: boolean;
  /** 15. human gate: operaciones críticas y claims controvertidos requieren revisión humana. */
  humanGateActive: boolean;
}

export interface QualityGateResult {
  gate: QualityGate;
  passed: boolean;
  detail: string;
}

export interface QualityGateReport {
  passed: boolean;
  results: readonly QualityGateResult[];
  blockers: readonly string[];
  invariantPreserved: boolean;
}

/**
 * Evalúa los 15 gates canónicos. Fail-closed: cualquier gate fallido bloquea la
 * promoción. El gate de evidencia usa la completitud del manifest.
 */
export function evaluateQualityGates(input: QualityGateInput): QualityGateReport {
  const results: QualityGateResult[] = [];
  const blockers: string[] = [];
  const record = (gate: QualityGate, passed: boolean, detail: string) => {
    results.push({ gate, passed, detail });
    if (!passed) blockers.push(gate);
  };

  record("schema", input.allFilesHaveSchema, "contexto/estado/dependencias presentes");
  record("truthfulness", input.noMockAsProduction, "sin mocks como producción");
  record("identity", input.identityMultiSignal, "identidad multi-señal");
  record("preservation", input.preservationPolicyActive, "PRESERVE → CLASSIFY → LINK → VERSION");
  record("temporal", input.temporalRetrievalActive, "current/historical por intención");
  record("security", input.securityPreIndexScan, "escaneo previo a indexar");
  record("tenant", input.tenantIsolationEnforced, "aislamiento de tenant");
  record("concurrency", input.concurrencySerialized, "mutación serializada");
  const evidenceOk = input.evidenceManifest ? assessManifestCompleteness(input.evidenceManifest).complete : false;
  record("evidence", evidenceOk, input.evidenceManifest ? "manifest de evidencia" : "sin manifest");
  record("reproducibility", input.reproducibilityDocumented, "reproducibilidad documentada");
  record("external_actions", input.externalActionsGated, "acciones externas con gate");
  record("licensing", input.thirdPartyLicensesPreserved, "licencias de terceros");
  record("rollback", input.rollbackPlanPresent, "plan de rollback");
  record("no_overclaim", input.noTechnicalOverclaim, "sin sobreclamación");
  record("human_gate", input.humanGateActive, "gate humano activo");

  const invariantPreserved = isInvariantPreserved();
  if (!invariantPreserved) {
    record("schema", false, "invariante operativo no preservado");
  }

  return {
    passed: blockers.length === 0,
    results: Object.freeze(results),
    blockers: Object.freeze(blockers),
    invariantPreserved,
  };
}
