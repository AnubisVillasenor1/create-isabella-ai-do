/**
 * Beta Subsystem: Verification Engine
 *
 * Verificación formal de respuestas, pruebas y consistencia post-ejecución.
 */

import type { CrownDecision, EvidenceRecord, ProvenanceRecord } from "../contracts";

export interface VerificationCheck {
  name: string;
  passed: boolean;
  details?: string;
}

export interface VerificationResult {
  valid: boolean;
  checks: VerificationCheck[];
  verifiedAt: string;
}

export type EpistemicTag = "E0" | "E1" | "E2" | "E3" | "E4";
export interface EpistemicClassification {
  tag: EpistemicTag;
  confidence: number;
  sources: number;
  conflicts: number;
  requiresHumanReview: boolean;
  reason: string;
}

export class VerificationEngine {
  classifyEpistemic(
    evidence: EvidenceRecord[],
    governance: CrownDecision,
  ): EpistemicClassification {
    const verified = evidence.filter((e) => e.confidence >= 0.7 && !e.isExpired);
    const conflicts = evidence.filter((e) => e.confidence < 0.3 || e.isExpired);
    const hasHighRisk =
      governance?.riskLevel === "R3_high" || governance?.riskLevel === "R4_critical";
    const requiresReview = governance?.reviewRequired === true || hasHighRisk;
    let tag: EpistemicTag = "E2";
    let reason = "";
    if (evidence.length === 0) {
      tag = "E2";
      reason = "Sin evidencia — incertidumbre moderada";
    } else if (verified.length >= 2 && conflicts.length === 0 && !requiresReview) {
      tag = "E0";
      reason = "Múltiples fuentes verificadas sin conflicto — certeza inmutable";
    } else if (verified.length >= 1 && conflicts.length === 0) {
      tag = "E1";
      reason = "Evidencia sólida sin contradicción — alta probabilidad";
    } else if (conflicts.length > 0 && verified.length > 0) {
      tag = "E2";
      reason = "Fuentes contrapuestas — expone divergencia";
    } else if (evidence.length >= 1 && verified.length === 0) {
      tag = "E3";
      reason = "Evidencia especulativa — baja convicción, requiere validación";
    }
    if (requiresReview || hasHighRisk) {
      tag = "E4";
      reason = "Acción alto impacto — requiere firma humana";
    }
    const confidence = evidence.length ? verified.length / evidence.length : 0;
    return {
      tag,
      confidence,
      sources: verified.length,
      conflicts: conflicts.length,
      requiresHumanReview: tag === "E4" || requiresReview,
      reason,
    };
  }

  verify(input: {
    response: string;
    governance: CrownDecision;
    evidence: EvidenceRecord[];
    provenance: ProvenanceRecord;
    costUsd?: number;
    reversible?: boolean;
  }): VerificationResult {
    const epistemic = this.classifyEpistemic(input.evidence, input.governance);
    const checks: VerificationCheck[] = [
      {
        name: "governance_compliance",
        passed: input.governance?.result !== "deny",
        details: `CROWN ${input.governance?.result} — ${epistemic.reason}`,
      },
      {
        name: "response_integrity",
        passed: typeof input.response === "string" && input.response.length > 0,
        details: `Respuesta ${input.response.length} chars — ${epistemic.tag}`,
      },
      {
        name: "provenance_sealed",
        passed: Boolean(input.provenance?.requestHash && input.provenance?.outputHash),
        details: `Provenance SHA-256 sellada — ${epistemic.tag}`,
      },
      {
        name: "epistemic_grading",
        passed: epistemic.tag !== "E4" || input.governance?.reviewRequired === true,
        details: `E0-E4: ${epistemic.tag} — ${epistemic.reason} — sources:${epistemic.sources} conflicts:${epistemic.conflicts}`,
      },
      {
        name: "evidence_quality",
        passed: epistemic.confidence >= 0.5 || epistemic.tag === "E2",
        details: `Calidad evidencia ${epistemic.confidence.toFixed(2)} — ${epistemic.sources} verificadas`,
      },
    ];

    const valid = checks.every((c) => c.passed);

    return {
      valid,
      checks,
      verifiedAt: new Date().toISOString(),
    };
  }
}

export const verificationEngine = new VerificationEngine();
