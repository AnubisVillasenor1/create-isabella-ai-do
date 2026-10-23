/** Admisión (INGRESS — admission control). Fail-closed por defecto. */

export type AdmissionEffect = "ALLOW" | "DENY";

export interface AdmissionVerdict {
  effect: AdmissionEffect;
  reason: string;
  evidencedAt: string;
}

export interface AdmissionRule {
  name: string;
  test: (ctx: AdmissionContext) => boolean;
  effect: AdmissionEffect;
  reason: string;
}

export interface AdmissionContext {
  methodId: string;
  tenantId?: string;
  principalId?: string;
  remoteIp?: string;
  rateKey: string;
}

export const DENY_ALL: AdmissionRule = {
  name: "deny-by-default",
  test: () => true,
  effect: "DENY",
  reason: "fail-closed: ninguna regla de admisión ha aprobado",
};

export function evaluateAdmission(
  ctx: AdmissionContext,
  rules: readonly AdmissionRule[],
  opts: { failClosed?: boolean } = {},
): AdmissionVerdict {
  const failClosed = opts.failClosed ?? true;
  const ordered = [...rules, ...(failClosed ? [DENY_ALL] : [])];

  for (const rule of ordered) {
    let allowed = false;
    try {
      allowed = rule.test(ctx);
    } catch {
      allowed = false;
    }
    if (allowed) {
      return {
        effect: rule.effect,
        reason: `regla '${rule.name}': ${rule.reason}`,
        evidencedAt: new Date().toISOString(),
      };
    }
  }

  return {
    effect: failClosed ? "DENY" : "ALLOW",
    reason: failClosed
      ? "ninguna regla de admisión aprobó (fail-closed)"
      : "ninguna regla denegó (admisión abierta)",
    evidencedAt: new Date().toISOString(),
  };
}