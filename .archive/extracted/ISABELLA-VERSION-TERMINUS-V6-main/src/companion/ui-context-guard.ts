/**
 * UI CONTEXT GUARD — tenant/actor desde el UI nunca son autoridad (ISA-457/458).
 * state: draft | engine-generated (pendiente revisión humana).
 *
 * No hay frontend; este guard es el contrato que un futuro UI consumidor debe
 * respetar: un claim de UI (`tenantId`/`actorId`) SOLO puede coincidir con una
 * identidad ya verificada en backend (PDP admitted + principal autenticado).
 * El claim NUNCA confiere autoridad: el resultado siempre lleva
 * `authoritative: false` por tipo, y `claimIsAuthoritative()` es estructural-
 * mente `false`.
 */
import type { Principal } from "../identity/principal";
import type { PdpDecision } from "../identity/pdp";

export interface UiContextClaim {
  readonly tenantId: string;
  readonly actorId: string;
}

export interface VerifiedIdentity {
  readonly principal: Principal;
  readonly pdp: Pick<PdpDecision, "effect" | "admitted">;
}

export type UiGuardVerdict = "ALLOW_MATCH" | "DENY_MISMATCH" | "DENY_MISSING" | "DENY_EMPTY_CLAIM";

export interface UiContextGuardResult {
  readonly verdict: UiGuardVerdict;
  readonly authoritative: false;
  readonly reason: string;
}

function deny(verdict: UiGuardVerdict, reason: string): UiContextGuardResult {
  return Object.freeze({ verdict, authoritative: false as const, reason });
}

export function verifyUiContext(
  verified: VerifiedIdentity | undefined,
  claim: UiContextClaim | undefined,
): UiContextGuardResult {
  if (!verified) return deny("DENY_MISSING", "UI_CONTEXT_GUARD: sin identidad verificada en backend");
  if (verified.pdp.admitted !== true || verified.pdp.effect === "DENY") {
    return deny("DENY_MISSING", "UI_CONTEXT_GUARD: PDP no admite la identidad verificada");
  }
  if (!claim || claim.tenantId.trim().length === 0 || claim.actorId.trim().length === 0) {
    return deny("DENY_EMPTY_CLAIM", "UI_CONTEXT_GUARD: claim del UI vacío o incompleto");
  }
  const matches = verified.principal.id === claim.actorId && (verified.principal.tenantId ?? "") === claim.tenantId;
  if (!matches) {
    return deny(
      "DENY_MISMATCH",
      `UI_CONTEXT_GUARD: claim del UI (tenant=${claim.tenantId}, actor=${claim.actorId}) no coincide con la identidad verificada`,
    );
  }
  return Object.freeze({
    verdict: "ALLOW_MATCH" as const,
    authoritative: false as const,
    reason: "UI_CONTEXT_GUARD: el claim coincide con la identidad verificada; el claim NUNCA confiere autoridad.",
  });
}

export function claimIsAuthoritative(_claim: UiContextClaim | undefined): false {
  return false;
}