/**
 * ECONOMIC AUTHORITY (src/lib/monetization/economic-authority.ts)
 * -----------------------------------------------------------------
 * Contrato económico único para rutas de monetización:
 *  - validateMonetizationAmount: importe entero > 0, límite duro, currency explícita.
 *  - economyCapabilityGate: enforce runtime de `economy.ledger` (productionSafe=false
 *    ⇒ 503 CAPABILITY_NOT_CERTIFIED en staging/production).
 *  - resolveSubscriptionStatus: estado de suscripción DERIVADO server-side
 *    (nunca aceptado del cliente). Sin fuente durable ⇒ fail-closed INACTIVE
 *    en staging/production; en development emite ACTIVE explícito con
 *    source="development-default" para no ocultar el origen.
 *
 * Auditoría P0-02/P0-03/P1-07: el cliente ya no puede aportar subscriptionStatus
 * ni importes arbitrarios; la capability no certificada bloquea el runtime.
 */

import { z } from "zod";
import { config } from "../config";
import { getCapability } from "../platform-capabilities";
import { resolveRuntimeMode, isProductionLike, type RuntimeMode } from "../runtime-mode";
import { MAX_MONETIZATION_AMOUNT_CENTS, type SubscriptionStatus } from "./x402-connector";

export { MAX_MONETIZATION_AMOUNT_CENTS };

export const monetizationAmountSchema = z
  .number({
    required_error: "amountCents es obligatorio",
    invalid_type_error: "amountCents debe ser numérico",
  })
  .int("amountCents debe ser un entero (centavos)")
  .positive("amountCents debe ser positivo")
  .max(MAX_MONETIZATION_AMOUNT_CENTS, `amountCents excede el máximo permitido`);

export const monetizationCurrencySchema = z.literal("USDC", {
  errorMap: () => ({ message: "currency debe ser USDC" }),
});

export type MonetizationAmountValidation =
  { ok: true; amountCents: number } | { ok: false; error: string };

/** Validación canónica de importes económicos. Única puerta para amountCents. */
export function validateMonetizationAmount(amountCents: unknown): MonetizationAmountValidation {
  const parsed = monetizationAmountSchema.safeParse(amountCents);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_AMOUNT" };
  }
  return { ok: true, amountCents: parsed.data };
}

export type CapabilityGateResult =
  | { blocked: false }
  | { blocked: true; error: "CAPABILITY_NOT_CERTIFIED"; capability: string; notes: string };

/**
 * Enforce runtime de capabilities no certificadas (registry ⇒ runtime).
 * Una capability con productionSafe=false no puede ejecutarse en
 * staging/production sin importar lo que afirme la documentación.
 */
export function economyCapabilityGate(capabilityId = "economy.ledger"): CapabilityGateResult {
  let mode: RuntimeMode;
  try {
    mode = resolveRuntimeMode(config().ISABELLA_RUNTIME_MODE);
  } catch {
    mode = "development";
  }
  if (!isProductionLike(mode)) return { blocked: false };

  const capability = getCapability(capabilityId);
  if (!capability || !capability.productionSafe) {
    return {
      blocked: true,
      error: "CAPABILITY_NOT_CERTIFIED",
      capability: capabilityId,
      notes:
        "Capability no certificada para producción. La liquidación económica permanece deshabilitada hasta que EconomicAuthority pase certificación (auditoría P0-04/Fase 0).",
    };
  }
  return { blocked: false };
}

export interface DurableSubscriptionResolution {
  status: SubscriptionStatus;
  source: "durable" | "development-default" | "unavailable-fail-closed";
}

/**
 * Resuelve el estado de suscripción SIN aceptar input del cliente.
 * - staging/production: sin lookup durable todavía ⇒ INACTIVE (fail-closed).
 * - development: ACTIVE explícito con source trazable (nunca se presenta como durable).
 */
export function resolveSubscriptionStatus(
  _tenantId: string,
  _actorId: string,
): DurableSubscriptionResolution {
  let mode: RuntimeMode;
  try {
    mode = resolveRuntimeMode(config().ISABELLA_RUNTIME_MODE);
  } catch {
    mode = "development";
  }

  if (isProductionLike(mode)) {
    // PENDIENTE(Fase 1 EconomicAuthority): lookup en billing/subscriptions (Postgres).
    // Mientras no exista, la suscripción NUNCA puede derivarse del request.
    return { status: "INACTIVE", source: "unavailable-fail-closed" };
  }
  return { status: "ACTIVE", source: "development-default" };
}
