/** CROWN — núcleo de decisión: intento + riesgo + verificación (facade). */

import { parseMethodId, type RiskTier } from "../authority/method-id";
import type { ApprovalRef } from "../identity/approval";
import type { Principal } from "../identity/principal";
import type { CapabilityGate } from "./capability";
import { callGate } from "./capability";
import { assessIntent, riskFromDestructive, type IntentAssessment, type RiskLevel } from "./intent";
import { riskLevelForRiskTier, verifyMethod, type VerificationResult } from "./verification";

export type CrownResponseMode = "answer" | "clarify" | "refuse" | "approval" | "read_only";

export interface CrownVerdict {
  intent: IntentAssessment;
  riskLevel: RiskLevel;
  methodIdValid: boolean;
  registered: boolean;
  gateApproved: boolean;
  verification: VerificationResult;
  responseMode: CrownResponseMode;
  requiresHumanApproval: boolean;
}

export interface CrownEvaluationInput {
  input: string;
  methodId: string;
  principal: Principal;
  gate: CapabilityGate;
  approval?: ApprovalRef;
  action: string;
  resource: string;
  contextHash?: string;
  policyVersion?: string;
  governanceInvariantPreserved?: boolean;
}

/**
 * CROWN decide el modo de respuesta; no ejecuta. La ejecución sigue al
 * invocador del método y a la aprobación humana (Invariante Operativo).
 */
export function evaluateCrown(opts: CrownEvaluationInput): CrownVerdict {
  const intent = assessIntent(opts.input);

  let riskTier: RiskTier | undefined;
  let methodIdValid = false;
  try {
    riskTier = parseMethodId(opts.methodId).riskTier;
    methodIdValid = true;
  } catch {
    riskTier = undefined;
  }

  const intentRisk = riskFromDestructive(intent);
  const tierRisk = riskLevelForRiskTier(riskTier);
  const riskRank: Record<RiskLevel, number> = { minimal: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const riskLevel = riskRank[intentRisk] >= riskRank[tierRisk] ? intentRisk : tierRisk;

  const registered = opts.gate.descriptors.has(opts.methodId);
  const gateVerdict = callGate(opts.gate, opts.methodId, {
    principal: opts.principal,
    approval: opts.approval,
    action: opts.action,
    resource: opts.resource,
    contextHash: opts.contextHash,
    policyVersion: opts.policyVersion,
  });

  const verification = verifyMethod({
    methodId: opts.methodId,
    methodIdValid,
    riskTier,
    gateGranted: gateVerdict.granted,
    gateReason: gateVerdict.reason,
    approvalProvided: opts.approval?.decision === "ALLOW",
    governanceInvariantPreserved: opts.governanceInvariantPreserved ?? true,
    registered,
  });

  const requiresHumanApproval =
    riskLevel === "critical" ||
    riskLevel === "high" ||
    intent.isDestructive ||
    intent.isExternalAction ||
    intent.hasSecretRequest;

  let responseMode: CrownResponseMode = "answer";
  if (!methodIdValid || !registered) {
    responseMode = "refuse";
  } else if (gateVerdict.granted === false && requiresHumanApproval) {
    responseMode = "approval";
  } else if (!verification.allPassed) {
    responseMode = "refuse";
  } else if (requiresHumanApproval) {
    responseMode = "approval";
  } else if (intent.sensitivity !== "public") {
    responseMode = "read_only";
  } else if (intent.ambiguous) {
    responseMode = "clarify";
  }

  return {
    intent,
    riskLevel,
    methodIdValid,
    registered,
    gateApproved: gateVerdict.granted,
    verification,
    responseMode,
    requiresHumanApproval,
  };
}

export * from "./intent";
export * from "./capability";
export * from "./verification";