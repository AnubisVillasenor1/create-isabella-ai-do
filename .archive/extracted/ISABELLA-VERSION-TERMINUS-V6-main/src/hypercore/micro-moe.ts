/**
 * Micro-MoE expert registry + affinity activation for HyperCore Ω² (state: draft).
 *
 * Experts are deterministic, in-process capabilities with DECLARED cost,
 * latency and energy metadata. Activation is TopK over a softmax of domain
 * affinity. Affinity is keyword-based and heuristic, not a learned router.
 */
import type { CognitiveState, ExpertScore, HyperCoreExpert } from "./types";

const DOMAIN_KEYWORDS: Record<string, readonly string[]> = {
  code: ["api", "code", "build", "generate", "function", "refactor", "test", "program", "endpoint"],
  database: ["database", "schema", "sql", "migration", "query", "table", "index"],
  security: ["security", "secret", "permission", "auth", "threat", "vulnerab", "credential"],
  legal: ["legal", "compliance", "policy", "regulat", "license", "gdpr"],
  math: ["math", "calcul", "equation", "numeric", "statistic", "formula"],
  finance: ["finance", "financial", "budget", "payment", "incentive", "cost", "revenue", "incentivo"],
  research: ["research", "source", "evidence", "investigat", "study", "literature"],
  architecture: ["architecture", "design", "system", "topology", "blueprint", "deploy"],
};

export function softmax(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 1 / values.length);
  return exps.map((value) => value / total);
}

export function expertAffinities(
  experts: readonly HyperCoreExpert[],
  state: CognitiveState,
): readonly ExpertScore[] {
  const raw = experts.map((expert) => affinityScoreFor(expert, state));
  const probabilities = softmax(raw);
  return Object.freeze(
    experts.map((expert, index) =>
      Object.freeze({
        expertId: expert.id,
        domain: expert.domain,
        affinity: raw[index] ?? 0,
        probability: probabilities[index] ?? 0,
      }),
    ),
  );
}

function affinityScoreFor(expert: HyperCoreExpert, state: CognitiveState): number {
  const keywords = DOMAIN_KEYWORDS[expert.domain] ?? [];
  const haystack = `${state.intent} ${state.domain} ${state.entities.join(" ")} ${state.objectives.join(" ")} ${state.constraints.join(" ")}`.toLowerCase();
  let score = 0;
  for (const keyword of keywords) if (haystack.includes(keyword)) score += 1;
  if (state.domain.toLowerCase() === expert.domain) score += 1.5;
  if (state.intent.toLowerCase().includes(expert.domain)) score += 1;
  return score;
}

function makeExpert(
  id: string,
  domain: string,
  costUnits: number,
  latencyMs: number,
  energyKwh: number,
  payload: (state: CognitiveState) => Record<string, unknown>,
): HyperCoreExpert {
  return Object.freeze({
    id,
    domain,
    costUnits,
    latencyMs,
    energyKwh,
    run: (state: CognitiveState): Record<string, unknown> => payload(state),
  });
}

export function createDefaultExperts(): readonly HyperCoreExpert[] {
  return Object.freeze([
    makeExpert("code-expert", "code", 1.2, 45, 0.00004, (state) => ({
      kind: "code",
      intent: state.intent,
      plan: "scaffold + tests",
    })),
    makeExpert("database-expert", "database", 1.4, 55, 0.00005, (state) => ({
      kind: "database",
      schema: "draft",
      intent: state.intent,
    })),
    makeExpert("security-expert", "security", 1.6, 40, 0.00003, (state) => ({
      kind: "security",
      risk: state.risk,
      recommendation: state.risk === "high" || state.risk === "critical" ? "step-up" : "monitor",
    })),
    makeExpert("legal-expert", "legal", 1.1, 50, 0.00003, (state) => ({
      kind: "legal",
      compliance: "review",
      intent: state.intent,
    })),
    makeExpert("math-expert", "math", 0.8, 25, 0.00002, () => ({
      kind: "math",
      verified: true,
    })),
    makeExpert("finance-expert", "finance", 1.5, 60, 0.00006, (state) => ({
      kind: "finance",
      impact: state.risk,
      proposal: "draft",
    })),
    makeExpert("research-expert", "research", 1.3, 70, 0.00005, (state) => ({
      kind: "research",
      sources: state.entities.length,
    })),
    makeExpert("architecture-expert", "architecture", 1.7, 65, 0.00005, (state) => ({
      kind: "architecture",
      blueprint: "draft",
      intent: state.intent,
    })),
  ]);
}
