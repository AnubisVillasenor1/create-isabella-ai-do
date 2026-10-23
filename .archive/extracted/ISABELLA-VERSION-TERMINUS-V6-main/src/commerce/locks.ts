/** COMMERCE — candados operativos: una operación se bloquea si se cumple la condición. */

import type { AuthContext, LockVerdict } from "./types";

export interface LockContext extends Pick<AuthContext, "subscriptionStatus" | "riskLevel"> {
  channelPermissionValid?: boolean;
  contentUnchangedSinceApproval?: boolean;
  consentPresent?: boolean;
  webhookSignatureValid?: boolean;
  duplicatePayment?: boolean;
  offerArchived?: boolean;
  budgetExceeded?: boolean;
  providerConfirmed?: boolean;
}

function lock(
  code: string,
  message: string,
  action: string,
  retryable: boolean,
  requiresHumanReview: boolean,
): LockVerdict {
  return { locked: true, code, message, action, retryable, requiresHumanReview };
}

/**
 * Candados del reglamento: suscripción inválida, cuenta suspendida, canal sin
 * permiso, contenido alterado tras aprobación, consentimiento ausente, firma de
 * webhook inválida, pago duplicado, riesgo crítico, oferta archivada,
 * presupuesto excedido y proveedor sin confirmación.
 */
export function evaluateBlockers(ctx: LockContext): readonly LockVerdict[] {
  const blockers: LockVerdict[] = [];

  const subscribed = ctx.subscriptionStatus === "active" || ctx.subscriptionStatus === "trialing";
  if (!subscribed && ctx.subscriptionStatus !== "suspended") {
    blockers.push(
      lock(
        "SUBSCRIPTION_INVALID",
        "No existe una suscripción válida para esta operación.",
        "Reanuda o contrata el plan correspondiente.",
        ctx.subscriptionStatus !== "canceled",
        false,
      ),
    );
  }

  if (ctx.subscriptionStatus === "suspended") {
    blockers.push(
      lock(
        "ACCOUNT_SUSPENDED",
        "La cuenta está suspendida; las operaciones quedan en pausa.",
        "Solicita revisión del estado de la cuenta.",
        false,
        true,
      ),
    );
  }

  if (ctx.channelPermissionValid === false) {
    blockers.push(
      lock(
        "CHANNEL_NO_PERMISSION",
        "El canal no tiene permisos válidos para publicar.",
        "Vuelve a autorizar el canal con permisos mínimos.",
        true,
        false,
      ),
    );
  }

  if (ctx.contentUnchangedSinceApproval === false) {
    blockers.push(
      lock(
        "CONTENT_CHANGED_AFTER_APPROVAL",
        "El contenido cambió después de la aprobación.",
        "Genera una nueva aprobación para la versión vigente.",
        false,
        false,
      ),
    );
  }

  if (ctx.consentPresent === false) {
    blockers.push(
      lock(
        "CONSENT_MISSING",
        "Falta consentimiento válido para procesar el dato.",
        "Obtén y registra el consentimiento explícito.",
        true,
        false,
      ),
    );
  }

  if (ctx.webhookSignatureValid === false) {
    blockers.push(
      lock(
        "WEBHOOK_SIGNATURE_INVALID",
        "La firma del webhook no es válida.",
        "Revisa la configuración de firma del proveedor.",
        false,
        true,
      ),
    );
  }

  if (ctx.duplicatePayment === true) {
    blockers.push(
      lock(
        "DUPLICATE_PAYMENT",
        "El pago ya fue registrado previamente.",
        "Verifica el ledger de ventas; no se duplican ingresos.",
        false,
        false,
      ),
    );
  }

  if (ctx.riskLevel === "critical") {
    blockers.push(
      lock(
        "RISK_CRITICAL",
        "El riesgo de la cuenta es crítico.",
        "Revisión humana obligatoria antes de continuar.",
        false,
        true,
      ),
    );
  }

  if (ctx.offerArchived === true) {
    blockers.push(
      lock(
        "OFFER_ARCHIVED",
        "La oferta está archivada.",
        "Desarchiva y revalida la oferta o crea una nueva.",
        false,
        false,
      ),
    );
  }

  if (ctx.budgetExceeded === true) {
    blockers.push(
      lock(
        "BUDGET_EXCEEDED",
        "El presupuesto excede el límite configurado.",
        "Ajusta el presupuesto o amplía el límite.",
        true,
        false,
      ),
    );
  }

  if (ctx.providerConfirmed === false) {
    blockers.push(
      lock(
        "PROVIDER_UNCONFIRMED",
        "El proveedor no confirma el estado del evento.",
        "Confirma el estado con el proveedor antes de continuar.",
        true,
        false,
      ),
    );
  }

  return blockers;
}

export function isBlocked(blockers: readonly LockVerdict[]): boolean {
  return blockers.some((b) => b.locked);
}

export function firstBlockingLock(blockers: readonly LockVerdict[]): LockVerdict | undefined {
  return blockers.find((b) => b.locked);
}