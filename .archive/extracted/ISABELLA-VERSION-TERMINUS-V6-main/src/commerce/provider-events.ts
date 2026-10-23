/**
 * COMMERCE — puente evento-de-proveedor → SubscriptionStore
 * (state: draft | engine-generated).
 *
 * Un evento de webhook NO es autoridad por sí mismo: solo aplica transiciones
 * DESPUÉS de que el conector verificó la firma y resolvió el tenant. Isabella
 * registra el estado que el proveedor reporta; no procesa pagos ni infiere un
 * estado pagado sin referencia de proveedor.
 *
 * La clasificación de eventos es heurística y documentada; un proveedor con
 * vocabulario propio puede inyectar su propio `resolveIntent`.
 */
import type { PlanId, SubscriptionStatus } from "./types";
import { PLANS } from "./plans";
import type { SubscriptionRecord, SubscriptionStore } from "./subscriptions";

export type SubscriptionIntent = "activate" | "trial" | "past_due" | "cancel" | "suspend" | "ignore";

export type ApplyOutcome =
  | "APPLIED"
  | "IGNORED_UNMAPPED_EVENT"
  | "REJECTED_NO_SUBSCRIPTION"
  | "REJECTED_PLAN_UNRESOLVED"
  | "REJECTED_CONTRACT_REQUIRED"
  | "REJECTED_TRANSITION";

export interface ApplyResult {
  readonly outcome: ApplyOutcome;
  readonly intent: SubscriptionIntent;
  readonly record?: SubscriptionRecord;
}

export interface ProviderSubscriptionInput {
  readonly workspaceId: string;
  readonly provider: string;
  readonly externalRef: string;
  readonly eventType: string;
  readonly planCode?: PlanId;
  readonly currentPeriodEnd?: string;
  readonly contract?: boolean;
}

/**
 * Clasifica un evento por palabras clave EN ORDEN DE PRIORIDAD. Los estados
 * terminales (suspender/cancelar/mora) se evalúan antes que los activadores para
 * que, p. ej., "subscription.payment_failed" no se lea como activación.
 * Un vocabulario desconocido se ignora (no se inventa una transición).
 */
export function defaultResolveIntent(eventType: string): SubscriptionIntent {
  const value = eventType.trim().toLowerCase();
  if (value.length === 0) return "ignore";
  if (/suspend|paus/.test(value)) return "suspend";
  if (/cancel|delet|expir|ended|terminat/.test(value)) return "cancel";
  if (/past_?due|pay?ment_?failed|unpaid|overdue|dunning|failed/.test(value)) return "past_due";
  if (/trial/.test(value)) return "trial";
  if (/activat|created|renew|resum|paid|succeed|active|updated/.test(value)) return "activate";
  return "ignore";
}

const STATUS_FOR_INTENT: Partial<Record<SubscriptionIntent, Extract<SubscriptionStatus, "active" | "trialing">>> = {
  activate: "active",
  trial: "trialing",
};

/**
 * Aplica un evento de proveedor YA verificado al store. No lanza por estados de
 * negocio (contrato, transición, plan, ausencia): los devuelve como `outcome`.
 */
export async function applyProviderSubscriptionEvent(
  store: SubscriptionStore,
  input: ProviderSubscriptionInput,
  resolveIntent: (eventType: string) => SubscriptionIntent = defaultResolveIntent,
): Promise<ApplyResult> {
  if (!input.workspaceId.trim()) throw new Error("SUBSCRIPTION_WORKSPACE_REQUIRED");
  const intent = resolveIntent(input.eventType);
  if (intent === "ignore") return { outcome: "IGNORED_UNMAPPED_EVENT", intent };

  const existing = await store.get(input.workspaceId);

  if (intent === "cancel" || intent === "suspend" || intent === "past_due") {
    if (!existing) return { outcome: "REJECTED_NO_SUBSCRIPTION", intent };
    try {
      const record =
        intent === "cancel"
          ? await store.cancel(input.workspaceId, `provider:${input.eventType}`)
          : intent === "suspend"
            ? await store.suspend(input.workspaceId, `provider:${input.eventType}`)
            : await store.markPastDue(input.workspaceId, input.provider, input.externalRef);
      return { outcome: "APPLIED", intent, record };
    } catch (error) {
      return { outcome: classifyStoreError(error), intent };
    }
  }

  const targetStatus = STATUS_FOR_INTENT[intent];
  if (!targetStatus) return { outcome: "IGNORED_UNMAPPED_EVENT", intent };

  const planCode = input.planCode ?? existing?.planCode;
  if (!planCode) return { outcome: "REJECTED_PLAN_UNRESOLVED", intent };
  if (PLANS[planCode].contractRequired && input.contract !== true) {
    return { outcome: "REJECTED_CONTRACT_REQUIRED", intent };
  }

  try {
    const record = await store.subscribe({
      workspaceId: input.workspaceId,
      planCode,
      provider: input.provider,
      externalRef: input.externalRef,
      status: targetStatus,
      currentPeriodEnd: input.currentPeriodEnd,
      contract: input.contract === true,
    });
    return { outcome: "APPLIED", intent, record };
  } catch (error) {
    return { outcome: classifyStoreError(error), intent };
  }
}

function classifyStoreError(error: unknown): ApplyOutcome {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("SUBSCRIPTION_CONTRACT_REQUIRED")) return "REJECTED_CONTRACT_REQUIRED";
  if (message.includes("SUBSCRIPTION_TRANSITION_INVALID")) return "REJECTED_TRANSITION";
  throw error instanceof Error ? error : new Error("SUBSCRIPTION_APPLY_FAILED");
}
