import { createHash, timingSafeEqual } from "node:crypto";

export type EvidenceKind = "claim" | "decision" | "tool" | "model" | "policy" | "error";
export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type GovernanceDecision = {
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason: string;
  risk: RiskLevel;
};

const SENSITIVE_ACTIONS = new Set([
  "payment.execute", "data.delete", "publish.external", "legal.submit",
  "infrastructure.change", "credential.rotate", "model.train.remote",
]);

export function evaluateGovernance(action: string, risk: RiskLevel): GovernanceDecision {
  const sensitive = SENSITIVE_ACTIONS.has(action);
  const critical = risk === "critical";
  if (critical) {
    return { allowed: false, requiresHumanApproval: true, reason: "Critical risk is blocked by default.", risk };
  }
  if (sensitive) {
    return { allowed: false, requiresHumanApproval: true, reason: "Sensitive side effects require explicit human authorization.", risk };
  }
  return { allowed: true, requiresHumanApproval: risk === "high", reason: "No prohibited side effect detected; normal policy checks still apply.", risk };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeTokenMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
