import type { RiskTier } from "../authority/method-id";
import { decideHypercore, modeForPressure, type HypercoreDecision } from "../evolution/hypercore";

export type ComplexityClass = "TRIVIAL" | "STANDARD" | "DEEP" | "CRITICAL";

export interface AdaptiveRequest {
  inputTokens: number;
  expectedOutputTokens: number;
  pressure: number;
  riskTier: RiskTier;
  requiresTools: boolean;
  requiresMemory: boolean;
}

export interface AdaptivePlan {
  complexity: ComplexityClass;
  hypercore: HypercoreDecision;
  parallelBranches: number;
  draftTokens: number;
  verifierFanout: number;
  cachePolicy: "NONE" | "PREFIX" | "PREFIX+SEMANTIC";
  authorityPath: "FULL";
}

export function planExecution(req: AdaptiveRequest): AdaptivePlan {
  const complexity: ComplexityClass =
    req.riskTier === "CRITICAL" ? "CRITICAL" :
    req.inputTokens + req.expectedOutputTokens > 8000 || req.requiresTools ? "DEEP" :
    req.inputTokens + req.expectedOutputTokens > 1500 || req.requiresMemory ? "STANDARD" : "TRIVIAL";

  const mode = modeForPressure(req.pressure);
  const hypercore = decideHypercore(mode, req.riskTier, req.pressure);
  const accelerationAllowed = req.riskTier !== "CRITICAL";
  return {
    complexity,
    hypercore,
    parallelBranches: accelerationAllowed && complexity !== "TRIVIAL" ? (mode === "HYPERBOOST" ? 4 : 2) : 1,
    draftTokens: accelerationAllowed ? (mode === "HYPERBOOST" ? 96 : mode === "BOOST" ? 48 : 0) : 0,
    verifierFanout: mode === "HYPERBOOST" && req.riskTier !== "CRITICAL" ? 3 : 1,
    cachePolicy: mode === "CRUISE" ? "PREFIX" : "PREFIX+SEMANTIC",
    authorityPath: "FULL",
  };
}
