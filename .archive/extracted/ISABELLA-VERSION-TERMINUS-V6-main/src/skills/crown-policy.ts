/**
 * HyperCore Ω — CROWN policy adapter.
 *
 * CROWN decides; HyperCore obeys. This adapter maps the intrinsic properties of
 * a skill contract (authority scopes, risk tier, rate limits) and the caller's
 * granted scopes/approval into the four canonical verdicts:
 *
 *   ALLOW    — execute.
 *   DENY     — a required scope is missing (fail-closed).
 *   ESCALATE — high/critical risk without a valid human approval.
 *   DEGRADE  — the per-minute call budget is exhausted.
 */
import type { RiskTier } from "../authority/method-id";
import type { SkillContract } from "./contracts";

export type CrownPolicyVerdict = "ALLOW" | "DENY" | "ESCALATE" | "DEGRADE";

export interface CrownPolicyInput {
  readonly contract: SkillContract;
  readonly riskTier: RiskTier;
  readonly grantedScopes: readonly string[];
  readonly approvalProvided: boolean;
  /** Invocations of this skill observed in the current 60s window. */
  readonly callsThisWindow: number;
}

export interface CrownPolicyDecision {
  readonly verdict: CrownPolicyVerdict;
  readonly reason: string;
  readonly missingScopes: readonly string[];
}

export function evaluateCrownPolicy(input: CrownPolicyInput): CrownPolicyDecision {
  const missingScopes = input.contract.authority.requiredScopes.filter(
    (scope) => !input.grantedScopes.includes(scope),
  );
  if (missingScopes.length > 0) {
    return { verdict: "DENY", reason: `missing required scopes: ${missingScopes.join(", ")}`, missingScopes };
  }

  const highRisk = input.riskTier === "HIGH" || input.riskTier === "CRITICAL";
  const needsApproval = highRisk || input.contract.authority.requiresStepUp;
  if (needsApproval && !input.approvalProvided) {
    return { verdict: "ESCALATE", reason: "human approval required", missingScopes };
  }

  if (input.callsThisWindow >= input.contract.limits.maxCallsPerMinute) {
    return { verdict: "DEGRADE", reason: "calls-per-minute budget exhausted", missingScopes };
  }

  return { verdict: "ALLOW", reason: "policy satisfied", missingScopes };
}
