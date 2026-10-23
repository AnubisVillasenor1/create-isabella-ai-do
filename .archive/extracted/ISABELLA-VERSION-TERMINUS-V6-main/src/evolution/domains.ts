import type { Plane } from "../core/types";

/**
 * 70 dominios de ingeniería, distribuidos determinísticamente sobre los 18
 * planos del Blueprint V5. Total = 70 (exacto por spec V5).
 */
export const DOMAINS: ReadonlyArray<{ plane: number; name: string; domain: string }> = [
  { plane: 0, name: "FOUNDATION", domain: "runtime" },
  { plane: 0, name: "FOUNDATION", domain: "configuration" },
  { plane: 0, name: "FOUNDATION", domain: "supply_chain" },
  { plane: 1, name: "INGRESS", domain: "http_ingress" },
  { plane: 1, name: "INGRESS", domain: "request_limits" },
  { plane: 1, name: "INGRESS", domain: "normalization" },
  { plane: 2, name: "IDENTITY_AND_AUTHORITY", domain: "principals" },
  { plane: 2, name: "IDENTITY_AND_AUTHORITY", domain: "tenant_isolation" },
  { plane: 2, name: "IDENTITY_AND_AUTHORITY", domain: "consent" },
  { plane: 2, name: "IDENTITY_AND_AUTHORITY", domain: "human_approval" },
  { plane: 3, name: "CROWN", domain: "intent" },
  { plane: 3, name: "CROWN", domain: "policy" },
  { plane: 3, name: "CROWN", domain: "capability" },
  { plane: 3, name: "CROWN", domain: "risk" },
  { plane: 3, name: "CROWN", domain: "verification" },
  { plane: 4, name: "HYPERCORE", domain: "prefix_cache" },
  { plane: 4, name: "HYPERCORE", domain: "speculative" },
  { plane: 4, name: "HYPERCORE", domain: "veritas" },
  { plane: 5, name: "CONTEXT_AND_MEMORY", domain: "context_compressor" },
  { plane: 5, name: "CONTEXT_AND_MEMORY", domain: "short_term_state" },
  { plane: 5, name: "CONTEXT_AND_MEMORY", domain: "durable_memory" },
  { plane: 5, name: "CONTEXT_AND_MEMORY", domain: "provenance" },
  { plane: 5, name: "CONTEXT_AND_MEMORY", domain: "retention" },
  { plane: 6, name: "INTELLIGENCE_FABRIC", domain: "native_inference" },
  { plane: 6, name: "INTELLIGENCE_FABRIC", domain: "model_registry" },
  { plane: 6, name: "INTELLIGENCE_FABRIC", domain: "moe_routing" },
  { plane: 6, name: "INTELLIGENCE_FABRIC", domain: "external_providers" },
  { plane: 6, name: "INTELLIGENCE_FABRIC", domain: "fallback_policy" },
  { plane: 7, name: "NATIVE_ML", domain: "classifiers" },
  { plane: 7, name: "NATIVE_ML", domain: "skill_fusion" },
  { plane: 7, name: "NATIVE_ML", domain: "learning_ledger" },
  { plane: 7, name: "NATIVE_ML", domain: "offline_evaluation" },
  { plane: 8, name: "TOOLS", domain: "tool_registry" },
  { plane: 8, name: "TOOLS", domain: "permission_gates" },
  { plane: 8, name: "TOOLS", domain: "timeouts" },
  { plane: 8, name: "TOOLS", domain: "idempotency" },
  { plane: 8, name: "TOOLS", domain: "execution_receipts" },
  { plane: 9, name: "SKILLS", domain: "native_skills" },
  { plane: 9, name: "SKILLS", domain: "evolved_skills" },
  { plane: 9, name: "SKILLS", domain: "skill_routing" },
  { plane: 9, name: "SKILLS", domain: "skill_provenance" },
  { plane: 10, name: "AGENT_RUNTIME", domain: "planner" },
  { plane: 10, name: "AGENT_RUNTIME", domain: "orchestrator" },
  { plane: 10, name: "AGENT_RUNTIME", domain: "sandbox" },
  { plane: 10, name: "AGENT_RUNTIME", domain: "recovery" },
  { plane: 11, name: "GOVERNANCE", domain: "policy_as_code" },
  { plane: 11, name: "GOVERNANCE", domain: "decision_ledger" },
  { plane: 11, name: "GOVERNANCE", domain: "audit_receipts" },
  { plane: 11, name: "GOVERNANCE", domain: "risk_register" },
  { plane: 11, name: "GOVERNANCE", domain: "human_oversight" },
  { plane: 12, name: "OBSERVABILITY", domain: "metrics" },
  { plane: 12, name: "OBSERVABILITY", domain: "logs" },
  { plane: 12, name: "OBSERVABILITY", domain: "traces" },
  { plane: 12, name: "OBSERVABILITY", domain: "runtime_health" },
  { plane: 13, name: "SECURITY", domain: "output_gate" },
  { plane: 13, name: "SECURITY", domain: "egress" },
  { plane: 13, name: "SECURITY", domain: "secret_scanning" },
  { plane: 13, name: "SECURITY", domain: "crypto" },
  { plane: 14, name: "DATA_AND_LEDGERS", domain: "repositories" },
  { plane: 14, name: "DATA_AND_LEDGERS", domain: "append_only_evidence" },
  { plane: 14, name: "DATA_AND_LEDGERS", domain: "bookpi" },
  { plane: 15, name: "FEDERATION", domain: "latam_aegis" },
  { plane: 15, name: "FEDERATION", domain: "external_integrations" },
  { plane: 15, name: "FEDERATION", domain: "sovereign_boundaries" },
  { plane: 16, name: "PRESENTATION", domain: "chat" },
  { plane: 16, name: "PRESENTATION", domain: "dashboards" },
  { plane: 16, name: "PRESENTATION", domain: "immersive" },
  { plane: 17, name: "PRODUCTION_CONTROL", domain: "cicd" },
  { plane: 17, name: "PRODUCTION_CONTROL", domain: "migrations" },
  { plane: 17, name: "PRODUCTION_CONTROL", domain: "release_gates" },
] as const;

export const DOMAIN_COUNT = DOMAINS.length;

export function planeForDomain(domain: string): Plane | undefined {
  const entry = DOMAINS.find((d) => d.domain === domain);
  return entry ? { index: entry.plane, name: entry.name } : undefined;
}

export function isKnownDomain(domain: string): boolean {
  return DOMAINS.some((d) => d.domain === domain);
}