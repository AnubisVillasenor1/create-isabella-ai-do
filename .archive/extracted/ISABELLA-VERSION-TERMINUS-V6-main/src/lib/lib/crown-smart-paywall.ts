/**
 * C.R.O.W.N. DYNAMIC SMART PAYWALL & GOVERNANCE GATE
 * ================================================================
 * Implementación canónica del Smart Paywall dinámico dentro del flujo de CROWN
 * (Policy Decision Point / Policy Enforcement Point).
 *
 * Flujo de 5 pasos:
 * 1. Normalización y Correlación Gateway (traceId, requestId, timestamp)
 * 2. ARGUS: Validación de Identidad, Tenant y Scopes
 * 3. CROWN PDP: Verificación de Suscripción Mensual (Status !== 'ACTIVE' -> DENY 403)
 * 4. Evaluador Dinámico de Contexto e Intención (E0-E4, Cuota tenant_quotas, IDH-D)
 * 5. Generación de Resultado CROWN:
 *    - ALLOW: Acceso Directo Incluido
 *    - MODIFY: Muro de Pago Dinámico (Tiers / Upgrade)
 *    - x402 CHALLENGE: Desafío HTTP 402 (Micro-pago A2A por Token)
 */

import { createHash, randomUUID } from "node:crypto";
import { getX402PaymentVaultAddress, PrincipalContext } from "./monetization/x402-connector";

export type EpistemicComplexity = "E0" | "E1" | "E2" | "E3" | "E4";

export type CrownDecisionType = "ALLOW" | "MODIFY" | "X402_CHALLENGE" | "DENY";

export interface SmartPaywallEvaluationRequest {
  traceId: string;
  requestId: string;
  context: PrincipalContext;
  resourceId: string;
  resourceType: "API_INFERENCE" | "DATASET" | "MCP_TOOL" | "PREMIUM_CONTENT" | "ADMIN_ACTION";
  epistemicComplexity: EpistemicComplexity;
  currentQuotaUsed: number;
  maxQuotaAllowed: number;
  idhdScore?: number; // 0 - 100
  requestedPriceCents?: number;
}

export interface SmartPaywallDecision {
  decisionId: string;
  traceId: string;
  decision: CrownDecisionType;
  allowed: boolean;
  httpStatusCode: number;
  reason: string;
  policyVersion: string;
  evidenceStatus: string;
  x402Terms?: {
    resourceId: string;
    priceCentsUSD: number;
    currency: string;
    recipientAddress: string;
    idempotencyKey: string;
    expiresAt: string;
  };
  upgradeRecommendation?: {
    suggestedPlan: string;
    message: string;
    currentQuotaUsed: number;
    maxQuotaAllowed: number;
  };
  auditSignature: string;
}

export class CrownSmartPaywallEngine {
  private readonly POLICY_VERSION = "v4.2.0-sovereign";

  /**
   * Ejecuta el pipeline completo de 5 pasos del Smart Paywall dinámico de CROWN.
   */
  public evaluate(request: SmartPaywallEvaluationRequest): SmartPaywallDecision {
    const decisionId = `dec_crown_${randomUUID()}`;
    const { context, resourceId, epistemicComplexity, currentQuotaUsed, maxQuotaAllowed } = request;

    // PASO 1 & 2: ARGUS Validación de Identidad y Tenant
    if (!context.tenantId || !context.actorId) {
      return this.buildDecision(
        decisionId,
        request.traceId,
        "DENY",
        401,
        "ARGUS_IDENTITY_UNRESOLVED: Invalid tenant or actor context",
        "E4_ACTION_REQUIRED",
      );
    }

    // PASO 3: CROWN PDP — Verificación de Suscripción Mensual Obligatoria
    if (context.subscriptionStatus !== "ACTIVE") {
      return this.buildDecision(
        decisionId,
        request.traceId,
        "DENY",
        403,
        "CROWN_POLICY_DENY: Active monthly subscription required to access and monetize resources",
        "E4_ACTION_REQUIRED",
      );
    }

    // PASO 4: Evaluador Dinámico de Contexto, Cuotas y Complejidad Epistémica (E0 - E4)
    const isQuotaExceeded = currentQuotaUsed >= maxQuotaAllowed;
    const isSpecializedAgenticResource =
      request.resourceType === "API_INFERENCE" ||
      request.resourceType === "MCP_TOOL" ||
      request.resourceType === "DATASET";

    // CASO A: Complejidad Crítica E4 que requiere autorización explícita o firma humana
    if (epistemicComplexity === "E4" && request.resourceType === "ADMIN_ACTION") {
      return this.buildDecision(
        decisionId,
        request.traceId,
        "MODIFY",
        422,
        "CROWN_GOVERNANCE_REQUIREMENT: Epistemic level E4 requires human-in-the-loop consensus signature",
        "E4_ACTION_REQUIRED",
      );
    }

    // CASO B: Recurso Agente a Agente (A2A) o Cuota Superada -> Desafío HTTP 402
    if (isQuotaExceeded && isSpecializedAgenticResource) {
      const priceCents = request.requestedPriceCents ?? 100; // $1.00 USD por defecto
      const idempotencyKey = `idemp_${Date.now()}_${decisionId.substring(10)}`;
      const expiresAt = new Date(Date.now() + 300_000).toISOString();

      return {
        decisionId,
        traceId: request.traceId,
        decision: "X402_CHALLENGE",
        allowed: false,
        httpStatusCode: 402,
        reason:
          "QUOTA_EXCEEDED_X402_REQUIRED: Metered billing micro-payment challenge issued via x402 protocol",
        policyVersion: this.POLICY_VERSION,
        evidenceStatus: "E0_CERTAINTY",
        x402Terms: {
          resourceId,
          priceCentsUSD: priceCents,
          currency: "USDC",
          recipientAddress: getX402PaymentVaultAddress(),
          idempotencyKey,
          expiresAt,
        },
        auditSignature: this.calculateSignature(decisionId, "X402_CHALLENGE", context.tenantId),
      };
    }

    // CASO C: Cuota Superada en Contenido Estándar -> Muro de Pago Dinámico (MODIFY / Upgrade)
    if (isQuotaExceeded) {
      return {
        decisionId,
        traceId: request.traceId,
        decision: "MODIFY",
        allowed: false,
        httpStatusCode: 402,
        reason:
          "QUOTA_EXCEEDED_UPGRADE_RECOMMENDED: Base subscription quota exhausted, upgrade plan required",
        policyVersion: this.POLICY_VERSION,
        evidenceStatus: "E1_HIGH_PROBABILITY",
        upgradeRecommendation: {
          suggestedPlan: "plan-merchant",
          message:
            "Has completado la cuota mensual de tu nivel. Actualiza al Plan Gremial para llamadas ilimitadas.",
          currentQuotaUsed,
          maxQuotaAllowed,
        },
        auditSignature: this.calculateSignature(decisionId, "MODIFY", context.tenantId),
      };
    }

    // CASO D: PASO 5 — Acceso Permitido dentro de la Suscripción Mensual Activa (ALLOW)
    return {
      decisionId,
      traceId: request.traceId,
      decision: "ALLOW",
      allowed: true,
      httpStatusCode: 200,
      reason: "CROWN_ALLOW: Request authorized under active monthly subscription",
      policyVersion: this.POLICY_VERSION,
      evidenceStatus: "E0_CERTAINTY",
      auditSignature: this.calculateSignature(decisionId, "ALLOW", context.tenantId),
    };
  }

  private buildDecision(
    decisionId: string,
    traceId: string,
    decision: CrownDecisionType,
    httpStatusCode: number,
    reason: string,
    evidenceStatus: string,
  ): SmartPaywallDecision {
    return {
      decisionId,
      traceId,
      decision,
      allowed: decision === "ALLOW",
      httpStatusCode,
      reason,
      policyVersion: this.POLICY_VERSION,
      evidenceStatus,
      auditSignature: this.calculateSignature(decisionId, decision, "SYSTEM_GATE"),
    };
  }

  private calculateSignature(decisionId: string, decision: string, tenantId: string): string {
    const raw = `${decisionId}|${decision}|${tenantId}|${this.POLICY_VERSION}|${Date.now()}`;
    return "crown-sig:" + createHash("sha256").update(raw).digest("hex");
  }

  public getPolicyVersion(): string {
    return this.POLICY_VERSION;
  }
}
