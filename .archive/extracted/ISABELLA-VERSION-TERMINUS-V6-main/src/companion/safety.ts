export type CompanionSafetyAction = "ALLOW" | "REDIRECT" | "ESCALATE" | "BLOCK";
export type CompanionSafetyDomain = "sexualization" | "grooming" | "emotional_dependency" | "coercion" | "self_harm_signal" | "harassment";

export interface CompanionSafetyFinding {
  domain: CompanionSafetyDomain;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: string;
}

export interface CompanionSafetyVerdict {
  action: CompanionSafetyAction;
  findings: readonly CompanionSafetyFinding[];
  humanReviewRequired: boolean;
  rationale: string;
}

const RULES: ReadonlyArray<{domain: CompanionSafetyDomain; severity: CompanionSafetyFinding["severity"]; patterns: readonly RegExp[]}> = [
  { domain:"sexualization", severity:"HIGH", patterns:[/sexual(?:ly|ized)?/i,/sext(?:ing)?/i,/erotic/i,/porn/i] },
  { domain:"grooming", severity:"CRITICAL", patterns:[/groom(?:ing)?/i,/meet\s+(?:me|alone)/i,/keep\s+this\s+secret/i] },
  { domain:"emotional_dependency", severity:"HIGH", patterns:[/you(?:'re| are)\s+all\s+i\s+need/i,/only\s+you\s+understand\s+me/i,/don't\s+tell\s+anyone/i] },
  { domain:"coercion", severity:"HIGH", patterns:[/threaten/i,/blackmail/i,/force\s+me/i,/extort/i] },
  { domain:"self_harm_signal", severity:"CRITICAL", patterns:[/kill\s+myself/i,/self[- ]?harm/i,/suicid/i,/end\s+my\s+life/i] },
  { domain:"harassment", severity:"MEDIUM", patterns:[/doxx/i,/harass/i,/stalk/i] },
];

export function evaluateCompanionSafety(input: string): CompanionSafetyVerdict {
  if (!input.trim()) return { action:"ALLOW", findings:[], humanReviewRequired:false, rationale:"empty_input" };
  const findings: CompanionSafetyFinding[]=[];
  for (const rule of RULES) {
    const match=rule.patterns.find((p)=>p.test(input));
    if (match) findings.push({domain:rule.domain,severity:rule.severity,evidence:match.source});
  }
  if (findings.some(f=>f.domain==="self_harm_signal")) return {action:"ESCALATE",findings,humanReviewRequired:true,rationale:"vulnerability_signal_requires_human_route"};
  if (findings.some(f=>f.domain==="grooming")) return {action:"BLOCK",findings,humanReviewRequired:true,rationale:"grooming_or_coercive_contact_boundary"};
  if (findings.some(f=>f.domain==="sexualization" || f.domain==="emotional_dependency")) return {action:"REDIRECT",findings,humanReviewRequired:false,rationale:"non_romantic_non_sexual_companion_boundary"};
  if (findings.length) return {action:"ESCALATE",findings,humanReviewRequired:true,rationale:"human_review_for_high_impact_safety_signal"};
  return {action:"ALLOW",findings,humanReviewRequired:false,rationale:"no_companion_safety_signal"};
}
