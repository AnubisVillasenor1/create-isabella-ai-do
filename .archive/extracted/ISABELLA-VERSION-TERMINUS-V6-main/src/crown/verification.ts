/** CROWN — verificación mecánica previa a la ejecución (verification). */

import type { RiskTier } from "../authority/method-id";
import type { RiskLevel } from "./intent";

export interface VerificationChain {
  name: string;
  passed: boolean;
  detail: string;
}

export interface VerificationResult {
  checks: readonly VerificationChain[];
  allPassed: boolean;
}

export const RISK_TIER_TO_LEVEL: Record<RiskTier, RiskLevel> = {
  NEGLIGIBLE: "minimal",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export interface VerificationInput {
  methodId: string;
  methodIdValid: boolean;
  riskTier: RiskTier | undefined;
  gateGranted: boolean;
  gateReason?: string;
  approvalProvided: boolean;
  governanceInvariantPreserved: boolean;
  registered: boolean;
}

export function riskLevelForRiskTier(tier: RiskTier | undefined): RiskLevel {
  if (!tier) {
    return "critical"; // tier desconocido ⇒ fail-closed
  }
  return RISK_TIER_TO_LEVEL[tier];
}

export function verifyMethod(input: VerificationInput): VerificationResult {
  const checks: VerificationChain[] = [];

  checks.push({
    name: "method-id-valido",
    passed: input.methodIdValid,
    detail: input.methodIdValid ? "identificador conforme al protocolo de 7 segmentos" : "identificador inválido",
  });

  checks.push({
    name: "capacidad-registrada",
    passed: input.registered,
    detail: input.registered ? "capacidad presente en el catálogo" : "capacidad ausente del catálogo",
  });

  checks.push({
    name: "puerta-de-capacidad",
    passed: input.gateGranted,
    detail: input.gateGranted ? (input.gateReason ?? "concedida") : (input.gateReason ?? "denegada"),
  });

  const highRisk = riskLevelForRiskTier(input.riskTier) === "high" || riskLevelForRiskTier(input.riskTier) === "critical";
  checks.push({
    name: "aprobacion-humana-si-requerida",
    passed: highRisk ? input.approvalProvided : true,
    detail: highRisk
      ? input.approvalProvided
        ? "aprobación humana presente para riesgo alto/crítico"
        : "se requiere aprobación humana para riesgo alto/crítico"
      : "no se requiere aprobación para este nivel de riesgo",
  });

  checks.push({
    name: "invariante-de-gobernanza-preservado",
    passed: input.governanceInvariantPreserved,
    detail: input.governanceInvariantPreserved
      ? "el estado de gobernanza no se degrada"
      : "esta invocación degradaría la gobernanza (invariante)",
  });

  return {
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}