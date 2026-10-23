/**
 * HyperCore **V5** (heurístico, legado) — decide activaciones por presión y
 * riesgo y ejecuta un pipeline determinista sobre un runtime inyectado.
 *
 * NO confundir con el módulo V6 Ω² (`src/hypercore/`, tipos `HyperCore*` en
 * CamelCase), que añade predicción, caché gobernada, expertos paralelos,
 * verificación Veritas Ω y auditoría fail-closed. Ambos contratos coexisten y
 * se exportan por el barril con nombres distintos deliberadamente.
 */
import {
  HYPERCORE_ACTIVATIONS, type HypercoreActivation, type HypercoreMode, type RiskTier, EARLY_EXIT_MAX_RISK,
} from "../core/types";

export interface HypercoreDecision {
  mode: HypercoreMode; activations: HypercoreActivation[]; governanceInvariant: "PRESERVED"; reason: string;
}
export interface HypercoreRuntime {
  prefixCache?: (key: string) => Promise<unknown | undefined>;
  semanticCache?: (query: string) => Promise<unknown | undefined>;
  draft?: (input: unknown, maxTokens: number) => Promise<readonly unknown[]>;
  verify?: (input: unknown, draft: readonly unknown[]) => Promise<{ accepted: boolean; output?: unknown }>;
  parallel?: <T>(branches: readonly (() => Promise<T>)[]) => Promise<readonly T[]>;
}
export interface HypercoreExecutionResult {
  decision: HypercoreDecision;
  cacheHit: boolean;
  speculativeAccepted: boolean;
  output?: unknown;
}
const MODE_ACTIVATIONS: Record<HypercoreMode, HypercoreActivation[]> = {
  CRUISE: ["PREFIX_CACHE", "SEMANTIC_CACHE"],
  BOOST: ["PREFIX_CACHE", "SEMANTIC_CACHE", "DRAFT_MODEL", "PARALLEL_BRANCHES", "VERIFIER_FANOUT"],
  HYPERBOOST: ["PREFIX_CACHE", "SEMANTIC_CACHE", "DRAFT_MODEL", "PARALLEL_BRANCHES", "VERIFIER_FANOUT", "EARLY_EXIT"],
};
const RISK_RANK: Record<RiskTier, number> = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, NEGLIGIBLE: 1 };
export const EARLY_EXIT_MAX_RISK_RANK = RISK_RANK[EARLY_EXIT_MAX_RISK];
export function modeForPressure(pressure: number): HypercoreMode {
  if (pressure >= 0.9) return "HYPERBOOST";
  if (pressure >= 0.6) return "BOOST";
  return "CRUISE";
}
export function decideHypercore(mode: HypercoreMode, riskTier: RiskTier, _pressure: number): HypercoreDecision {
  let activations = [...MODE_ACTIVATIONS[mode]];
  if (activations.includes("EARLY_EXIT") && RISK_RANK[riskTier] > EARLY_EXIT_MAX_RISK_RANK) activations = activations.filter((a) => a !== "EARLY_EXIT");
  return {
    mode, activations, governanceInvariant: "PRESERVED",
    reason: activations.includes("EARLY_EXIT")
      ? `HYPERBOOST con EARLY_EXIT permitido para ${riskTier}; la autoridad permanece intacta`
      : `modo ${mode}; aceleración gobernada para riesgo ${riskTier}`,
  };
}
export async function executeHypercore(
  runtime: HypercoreRuntime,
  decision: HypercoreDecision,
  input: { cacheKey: string; semanticQuery: string; prompt: unknown; draftTokens: number },
): Promise<HypercoreExecutionResult> {
  let cacheHit = false;
  if (decision.activations.includes("PREFIX_CACHE") && runtime.prefixCache && await runtime.prefixCache(input.cacheKey) !== undefined) cacheHit = true;
  if (!cacheHit && decision.activations.includes("SEMANTIC_CACHE") && runtime.semanticCache && await runtime.semanticCache(input.semanticQuery) !== undefined) cacheHit = true;
  if (cacheHit) return { decision, cacheHit: true, speculativeAccepted: false };

  if (decision.activations.includes("DRAFT_MODEL") && runtime.draft && runtime.verify) {
    const draft = await runtime.draft(input.prompt, input.draftTokens);
    const verified = await runtime.verify(input.prompt, draft);
    return { decision, cacheHit: false, speculativeAccepted: verified.accepted, output: verified.output };
  }
  return { decision, cacheHit: false, speculativeAccepted: false };
}
export function isActivationAllowed(decision: HypercoreDecision, activation: HypercoreActivation): boolean { return decision.activations.includes(activation); }
export function allActivations(): readonly HypercoreActivation[] { return HYPERCORE_ACTIVATIONS; }
