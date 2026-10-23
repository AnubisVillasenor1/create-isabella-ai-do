/**
 * Beta Subsystem: Policy Engine (CROWN Gate)
 *
 * Evaluación de políticas constitucionales y control de acceso soberano.
 */

import type { CrownDecision, DataClassification, RiskLevel } from "../contracts";

export interface PolicyContext {
  identity: {
    actorId: string;
    tenantId: string;
    roles: string[];
    scopes: string[];
    assuranceLevel: string;
  };
  risk: {
    level: RiskLevel;
    requiresApproval: boolean;
  };
  classification: DataClassification;
  intent: string;
  requestedCapabilities?: string[];
}

export class PolicyEngine {
  evaluate(context: PolicyContext): CrownDecision {
    const scopeDenials: string[] = [];

    // Verificación de scopes solicitados
    if (context.requestedCapabilities && context.requestedCapabilities.length > 0) {
      for (const cap of context.requestedCapabilities) {
        if (!context.identity.scopes.includes(cap) && !context.identity.scopes.includes("all")) {
          scopeDenials.push(cap);
        }
      }
    }

    if (scopeDenials.length > 0) {
      return {
        decisionId: crypto.randomUUID(),
        result: "deny",
        riskLevel: context.risk.level,
        classification: context.classification,
        policyIds: ["POL-SCOPE-ENFORCEMENT"],
        reason: `Scopes denegados: ${scopeDenials.join(", ")}`,
        scopeDenials,
        reviewRequired: false,
        reversible: false,
        evaluatedAt: new Date().toISOString(),
      };
    }

    if (context.risk.requiresApproval) {
      return {
        decisionId: crypto.randomUUID(),
        result: "review",
        riskLevel: context.risk.level,
        classification: context.classification,
        policyIds: ["POL-HUMAN-IN-THE-LOOP"],
        reason: "La operación requiere confirmación humana según política CROWN.",
        scopeDenials: [],
        reviewRequired: true,
        reversible: true,
        evaluatedAt: new Date().toISOString(),
      };
    }

    return {
      decisionId: crypto.randomUUID(),
      result: "allow",
      riskLevel: context.risk.level,
      classification: context.classification,
      policyIds: ["POL-DEFAULT-ALLOW"],
      reason: "Operación autorizada por política CROWN estándar.",
      scopeDenials: [],
      reviewRequired: false,
      reversible: true,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const policyEngine = new PolicyEngine();
