/** PDP — Policy Decision Point. Fail-closed RBAC + ABAC + tenant + consent. */
import { verifyHumanApproval, type ApprovalRef, type ApprovalTarget } from "./approval";
import type { ConsentRegistryLike, ConsentRequirement } from "./consent";
import { requireConsent } from "./consent";
import type { Principal } from "./principal";
import { hasPermission, type RbacPolicy } from "./rbac";
import { isolatedAccess, tenantIsActive, type TenantCatalog } from "./tenant";

export type PdpEffect = "ALLOW" | "FLAG" | "DENY";
export interface PdpDecision { effect: PdpEffect; reason: string; admitted: boolean; evidenceRef?: string; }
export interface PdpRequest {
  principal: Principal; action: string; resource: string; methodId: string; tenantId?: string;
  consent?: ConsentRequirement;
  attributeContext?: Readonly<Record<string, string | number | boolean>>;
}
export interface AttributeCondition {
  name: string;
  allowed: (ctx: Readonly<Record<string, string | number | boolean>>) => boolean;
}
export interface PdpDeps {
  rbac: RbacPolicy; tenants?: TenantCatalog; consent?: ConsentRegistryLike;
  attributeConditions?: readonly AttributeCondition[];
}
function deny(reason: string): PdpDecision { return { effect: "DENY", reason, admitted: false }; }

export function decidePdp(deps: PdpDeps, req: PdpRequest): PdpDecision {
  const effects: string[] = [];
  if (deps.tenants) {
    const tenant = req.tenantId ?? req.principal.tenantId ?? "";
    if (!tenantIsActive(deps.tenants, tenant)) return deny("arrendatario inactivo o inexistente");
    if (req.tenantId && !isolatedAccess(deps.tenants, req.principal.tenantId, req.tenantId)) return deny("aislamiento de arrendatario denegado");
    effects.push("tenant-ok");
  }
  if (deps.consent && req.consent) {
    if (!requireConsent(deps.consent, req.principal.id, req.consent)) return deny(`falta consentimiento para ${req.consent.purpose}:${req.consent.scope}`);
    effects.push("consent-ok");
  }
  const base: PdpEffect = hasPermission(deps.rbac, req.principal, req.action) ? "ALLOW" : "DENY";
  let effect: PdpEffect = base;
  effects.push(`rbac:${base}`);

  const attrs = { ...req.principal.attributes, ...(req.attributeContext ?? {}) };
  for (const condition of deps.attributeConditions ?? []) {
    try {
      const passed = condition.allowed(attrs);
      effects.push(`abac:${condition.name}:${passed ? "ALLOW" : "DENY"}`);
      if (!passed) return deny(effects.join("; "));
    } catch {
      return deny(`abac:${condition.name}:evaluation-error`);
    }
  }

  if (effect === "ALLOW" && req.principal.kind !== "human" && isPrivileged(req.action)) {
    effect = "FLAG";
    effects.push("machine+privileged→FLAG");
  }
  if (effect === "DENY") return deny(effects.join("; "));
  return { effect, reason: effects.join("; "), admitted: effect === "ALLOW" };
}

/** A FLAG may only be overridden by an approval bound to the exact live request. */
export function overrideWithHumanApproval(
  decision: PdpDecision,
  approval: ApprovalRef | undefined,
  target: ApprovalTarget,
): PdpDecision {
  if (decision.effect !== "FLAG") return decision;
  if (!approval || approval.decision !== "ALLOW" || !verifyHumanApproval(approval, target)) {
    return { ...decision, admitted: false, evidenceRef: approval?.evidenceId };
  }
  return {
    ...decision,
    effect: "ALLOW",
    admitted: true,
    evidenceRef: approval.evidenceId,
    reason: `${decision.reason}; human-approval:${approval.approver}`,
  };
}

export function isPrivileged(action: string): boolean {
  return /^(delete|modify|approve|escalate|admin|impersonate|reveal|transfer)/i.test(action);
}
