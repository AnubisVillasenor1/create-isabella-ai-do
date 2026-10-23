import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../security/rate-limit";
import {
  buildNexusView,
  civilizationalValue,
  computeTrustMesh,
  CONSTITUTION_ARTICLES,
  CONSTITUTIONAL_FLOW,
  evaluateConstitution,
  fabricateTerritories,
  federateDigitalTwins,
  OmniMemory,
  runHyperSimulation,
  runResearchCycle,
  valuateCapital,
  type ConstitutionalAssertion,
  type FederationGrant,
  type MemoryLayer,
  type ResearchHypothesis,
  type Territory,
  type TrustAttestation,
  type TwinNode,
} from "../omega";

// Ω∞ (Omega Infinity) API v3 (state: draft | engine-generated).
// Expone el Constitution Engine (Ω∞-15), la Hyper Simulation Fabric (Ω∞-17), el
// Cognitive Capital Engine (Ω∞-20), la Ecuación Maestra Ω∞ y las capas de malla:
// Federated Digital Twin (Ω∞-16), Omni Memory (Ω∞-18), Trust Computing Mesh
// (Ω∞-19), Autonomous Research Engine (Ω∞-21), Nexus (Ω∞-22) y Territorial
// Civilization Fabric (Ω∞-23). Todo es cálculo explicable y fail-closed: nada
// autoriza, nada ejecuta y nada mueve fondos.

export const OMEGA_ROUTES_VERSION = "1.1.0" as const;
export const CONSTITUTION_METHOD_ID = "I.YUN.CONSTITUTION.evaluate_mandate.v1.0.0.HIGH.CONSTITUTIONAL" as const;
export const SIMULATION_METHOD_ID = "I.YUN.SIMULATION.run_mandate.v1.0.0.MEDIUM.TERRITORIAL" as const;
export const CAPITAL_METHOD_ID = "I.YUN.CAPITAL.valuate_intelligence.v1.0.0.LOW.TERRITORIAL" as const;
export const CIVILIZATION_METHOD_ID = "I.YUN.CIVILIZATION.master_equation.v1.0.0.HIGH.INSTITUTIONAL" as const;
export const NEXUS_METHOD_ID = "I.YUN.NEXUS.view_model.v1.0.0.LOW.TERRITORIAL" as const;
export const TWIN_METHOD_ID = "I.YUN.TWIN.federate.v1.0.0.HIGH.CONSTITUTIONAL" as const;
export const MEMORY_METHOD_ID = "I.YUN.MEMORY.omni.v1.0.0.MEDIUM.TERRITORIAL" as const;
export const TRUST_METHOD_ID = "I.YUN.TRUST.mesh.v1.0.0.HIGH.CONSTITUTIONAL" as const;
export const RESEARCH_METHOD_ID = "I.YUN.RESEARCH.run_cycle.v1.0.0.MEDIUM.TERRITORIAL" as const;
export const TERRITORY_METHOD_ID = "I.YUN.TERRITORY.fabricate.v1.0.0.HIGH.INSTITUTIONAL" as const;

export interface OmegaRouteDeps {
  readonly app: Application;
  readonly enforceRateLimit: (
    req: Request,
    res: Response,
    limiter: FixedWindowRateLimiter,
    bucket: string,
  ) => boolean;
  readonly rateLimiter: FixedWindowRateLimiter;
  /** Admin gate. When omitted, no token is required (development). */
  readonly authorizeAdmin?: (req: Request, res: Response) => boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(res: Response, error: unknown): void {
  res.status(400).json({ success: false, error: (error as Error).message || "OMEGA_ERROR" });
}

export function registerOmegaRoutes(deps: OmegaRouteDeps): void {
  const { app } = deps;
  const memory = new OmniMemory();

  app.get("/api/v3/omega/constitution", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-constitution")) return;
    res.json({
      success: true,
      methodId: CONSTITUTION_METHOD_ID,
      authorizationPerformed: false,
      flow: CONSTITUTIONAL_FLOW,
      articles: CONSTITUTION_ARTICLES,
    });
  });

  app.post("/api/v3/omega/constitution/evaluate", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-constitution-evaluate")) return;
    if (!isRecord(req.body) || !Array.isArray(req.body.assertions)) {
      res.status(400).json({ success: false, error: "CONSTITUTION_ASSERTIONS_REQUIRED" });
      return;
    }
    try {
      const decision = evaluateConstitution(req.body.assertions as ConstitutionalAssertion[]);
      res.status(decision.allowed ? 200 : 422).json({
        success: true,
        methodId: CONSTITUTION_METHOD_ID,
        authorizationPerformed: false,
        decision,
      });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/simulation/run", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-simulation-run")) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: "SIMULATION_BODY_REQUIRED" });
      return;
    }
    try {
      const report = runHyperSimulation({
        base: Number(req.body.base),
        volatility: Number(req.body.volatility),
        confidence: Number(req.body.confidence),
        economicImpact: req.body.economicImpact === undefined ? undefined : Number(req.body.economicImpact),
        socialImpact: req.body.socialImpact === undefined ? undefined : Number(req.body.socialImpact),
        riskMitigation: req.body.riskMitigation === undefined ? undefined : Number(req.body.riskMitigation),
      });
      res.json({ success: true, methodId: SIMULATION_METHOD_ID, authorizationPerformed: false, report });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/capital/value", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-capital-value")) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: "CAPITAL_BODY_REQUIRED" });
      return;
    }
    try {
      const capital = valuateCapital({
        utility: Number(req.body.utility),
        trust: Number(req.body.trust),
        demand: Number(req.body.demand),
        evidence: Number(req.body.evidence),
        reputation: Number(req.body.reputation),
        rarity: req.body.rarity === undefined ? undefined : Number(req.body.rarity),
        reproducibility: req.body.reproducibility === undefined ? undefined : Number(req.body.reproducibility),
      });
      res.json({ success: true, methodId: CAPITAL_METHOD_ID, authorizationPerformed: false, capital });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/civilization/value", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-civilization-value")) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: "CIVILIZATION_BODY_REQUIRED" });
      return;
    }
    try {
      const equation = civilizationalValue(req.body as Record<string, number>);
      res.json({ success: true, methodId: CIVILIZATION_METHOD_ID, authorizationPerformed: false, equation });
    } catch (error) {
      fail(res, error);
    }
  });

  app.get("/api/v3/omega/nexus", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-nexus")) return;
    const title = typeof req.query.title === "string" ? req.query.title : undefined;
    res.json({ success: true, methodId: NEXUS_METHOD_ID, authorizationPerformed: false, view: buildNexusView({ title }) });
  });

  app.post("/api/v3/omega/twins/federate", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-twins-federate")) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: "TWIN_BODY_REQUIRED" });
      return;
    }
    try {
      const federation = federateDigitalTwins({
        nodes: (req.body.nodes ?? []) as TwinNode[],
        grants: (req.body.grants ?? []) as FederationGrant[],
        now: typeof req.body.now === "string" ? req.body.now : undefined,
      });
      res.json({ success: true, methodId: TWIN_METHOD_ID, authorizationPerformed: false, federation });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/memory/store", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-memory-store")) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: "MEMORY_BODY_REQUIRED" });
      return;
    }
    try {
      const record = memory.store({
        id: String(req.body.id),
        layer: req.body.layer as MemoryLayer,
        content: String(req.body.content ?? ""),
        importance: Number(req.body.importance),
        createdAt: typeof req.body.createdAt === "string" ? req.body.createdAt : undefined,
      });
      res.json({ success: true, methodId: MEMORY_METHOD_ID, authorizationPerformed: false, record });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/memory/query", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-memory-query")) return;
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, error: "MEMORY_BODY_REQUIRED" });
      return;
    }
    try {
      const results = memory.query({
        layers: Array.isArray(req.body.layers) ? (req.body.layers as MemoryLayer[]) : undefined,
        minImportance: req.body.minImportance === undefined ? undefined : Number(req.body.minImportance),
        limit: req.body.limit === undefined ? undefined : Number(req.body.limit),
        text: typeof req.body.text === "string" ? req.body.text : undefined,
      });
      res.json({ success: true, methodId: MEMORY_METHOD_ID, authorizationPerformed: false, count: results.length, results });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/trust/analyze", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-trust-analyze")) return;
    if (!isRecord(req.body) || !Array.isArray(req.body.attestations)) {
      res.status(400).json({ success: false, error: "TRUST_ATTESTATIONS_REQUIRED" });
      return;
    }
    try {
      const mesh = computeTrustMesh(req.body.attestations as TrustAttestation[]);
      res.json({ success: true, methodId: TRUST_METHOD_ID, authorizationPerformed: false, mesh });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/research/run", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-research-run")) return;
    if (!isRecord(req.body) || !Array.isArray(req.body.hypotheses)) {
      res.status(400).json({ success: false, error: "RESEARCH_HYPOTHESES_REQUIRED" });
      return;
    }
    try {
      const result = runResearchCycle((req.body.hypotheses as ResearchHypothesis[]), {
        evidenceThreshold: req.body.evidenceThreshold === undefined ? undefined : Number(req.body.evidenceThreshold),
      });
      res.json({ success: true, methodId: RESEARCH_METHOD_ID, authorizationPerformed: false, ...result });
    } catch (error) {
      fail(res, error);
    }
  });

  app.post("/api/v3/omega/territory/fabricate", (req, res) => {
    if (!deps.enforceRateLimit(req, res, deps.rateLimiter, "omega-territory-fabricate")) return;
    if (!isRecord(req.body) || !Array.isArray(req.body.territories)) {
      res.status(400).json({ success: false, error: "TERRITORY_LIST_REQUIRED" });
      return;
    }
    try {
      const result = fabricateTerritories(req.body.territories as Territory[]);
      res.json({ success: true, methodId: TERRITORY_METHOD_ID, ...result });
    } catch (error) {
      fail(res, error);
    }
  });
}
