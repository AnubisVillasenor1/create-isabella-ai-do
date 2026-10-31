import { describe, expect, it } from "vitest";
import { evaluateBlockers, firstBlockingLock, isBlocked } from "../../src/commerce/locks";

describe("commerce/locks", () => {
  const base = { subscriptionStatus: "active" as const, riskLevel: "low" as const };

  it("no bloquea una operación sin condiciones negativas", () => {
    expect(isBlocked(evaluateBlockers(base))).toBe(false);
    expect(evaluateBlockers(base)).toHaveLength(0);
  });

  it("bloquea por suscripción inválida", () => {
    const blockers = evaluateBlockers({ ...base, subscriptionStatus: "canceled" });
    expect(firstBlockingLock(blockers)?.code).toBe("SUBSCRIPTION_INVALID");
  });

  it("bloquea por cuenta suspendida y exige revisión humana", () => {
    const blockers = evaluateBlockers({ ...base, subscriptionStatus: "suspended" });
    const lock = firstBlockingLock(blockers);
    expect(lock?.code).toBe("ACCOUNT_SUSPENDED");
    expect(lock?.requiresHumanReview).toBe(true);
    expect(lock?.retryable).toBe(false);
  });

  it("bloquea canal sin permiso", () => {
    const blockers = evaluateBlockers({ ...base, channelPermissionValid: false });
    expect(firstBlockingLock(blockers)?.code).toBe("CHANNEL_NO_PERMISSION");
  });

  it("bloquea contenido alterado tras la aprobación", () => {
    const blockers = evaluateBlockers({ ...base, contentUnchangedSinceApproval: false });
    expect(firstBlockingLock(blockers)?.code).toBe("CONTENT_CHANGED_AFTER_APPROVAL");
  });

  it("bloquea por consentimiento ausente", () => {
    const blockers = evaluateBlockers({ ...base, consentPresent: false });
    expect(firstBlockingLock(blockers)?.code).toBe("CONSENT_MISSING");
  });

  it("bloquea firma de webhook inválida con revisión humana", () => {
    const blockers = evaluateBlockers({ ...base, webhookSignatureValid: false });
    const lock = firstBlockingLock(blockers);
    expect(lock?.code).toBe("WEBHOOK_SIGNATURE_INVALID");
    expect(lock?.requiresHumanReview).toBe(true);
  });

  it("bloquea pago duplicado sin duplicar ingresos", () => {
    const blockers = evaluateBlockers({ ...base, duplicatePayment: true });
    expect(firstBlockingLock(blockers)?.code).toBe("DUPLICATE_PAYMENT");
  });

  it("bloquea riesgo crítico con revisión humana", () => {
    const blockers = evaluateBlockers({ ...base, riskLevel: "critical" });
    const lock = firstBlockingLock(blockers);
    expect(lock?.code).toBe("RISK_CRITICAL");
    expect(lock?.requiresHumanReview).toBe(true);
  });

  it("bloquea oferta archivada, presupuesto excedido y proveedor sin confirmar", () => {
    expect(firstBlockingLock(evaluateBlockers({ ...base, offerArchived: true }))?.code).toBe("OFFER_ARCHIVED");
    expect(firstBlockingLock(evaluateBlockers({ ...base, budgetExceeded: true }))?.code).toBe("BUDGET_EXCEEDED");
    expect(firstBlockingLock(evaluateBlockers({ ...base, providerConfirmed: false }))?.code).toBe("PROVIDER_UNCONFIRMED");
  });

  it("cada candado expone acción requerida y retryable", () => {
    for (const blocker of evaluateBlockers({ ...base, riskLevel: "critical", consentPresent: false })) {
      expect(blocker.action.length).toBeGreaterThan(0);
      expect(typeof blocker.retryable).toBe("boolean");
    }
  });
});