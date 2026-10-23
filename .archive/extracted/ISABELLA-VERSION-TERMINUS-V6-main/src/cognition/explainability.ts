export type ExplanationKind = "policy" | "security" | "routing" | "memory" | "governance" | "safety";

export interface DecisionExplanation {
  kind: ExplanationKind;
  decision: "ALLOW" | "DENY" | "REVIEW" | "REDIRECT";
  humanReadable: string;
  factors: readonly string[];
  evidenceRefs: readonly string[];
  policyVersion?: string;
  generatedAt: string;
}

export function explainDecision(input: Omit<DecisionExplanation,"generatedAt">): DecisionExplanation {
  if (!input.humanReadable.trim()) throw new Error("EXPLAINABILITY: explanation text is required");
  return Object.freeze({...input, factors:[...input.factors], evidenceRefs:[...input.evidenceRefs], generatedAt:new Date().toISOString()});
}

export function explainPolicyDecision(decision: "ALLOW"|"DENY"|"REVIEW", factors: readonly string[], evidenceRefs: readonly string[], policyVersion: string): DecisionExplanation {
  return explainDecision({
    kind:"policy",
    decision,
    humanReadable: decision==="ALLOW" ? "La operación cumple las condiciones de la política evaluada." : decision==="REVIEW" ? "La operación requiere revisión humana antes de producir un efecto relevante." : "La operación no cumple las condiciones de la política.",
    factors,
    evidenceRefs,
    policyVersion,
  });
}
