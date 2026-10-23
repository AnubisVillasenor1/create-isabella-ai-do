// HyperCore Ω — HTTP surface: heuristic prediction routes (HyperCore V5 semantics)
// plus the distributed skill execution runtime and the MCP JSON-RPC bridge.
//
// state: draft | engine-generated. Extracted from src/server.ts (TD-01) with no
// behaviour change; the route inventory is locked by test/deployment/route-inventory
// .test.ts. Every mutating route is admin-gated and rate-limited; the skill engine
// still ESCALATES high-risk executions and seals each run into BookPI.
import { randomUUID } from "node:crypto";
import type { Application, Request, Response } from "express";
import {
  HYPERCORE_DISCLAIMER,
  HYPERCORE_ID,
  HYPERCORE_OMEGA_MODES,
  HYPERCORE_VERSION,
  hyperCore,
  hyperPredict,
  type HyperCoreTask,
  type HyperPredictSession,
  type RiskClass,
} from "../hypercore";
import { HYPERCORE_OMEGA_PHASES, HyperCoreEngine, SkillMcpServer, type SkillRegistry } from "../skills";
import type { BookPiLedgerPort } from "../bookpi/ledger";
import type { FixedWindowRateLimiter } from "../security/rate-limit";
import { buildIsabellaCapabilityManifest } from "../isabella/recognition";

export interface HyperCoreRoutesDeps {
  readonly app: Application;
  /** Skill registry the engine and MCP server operate on. */
  readonly skills: SkillRegistry;
  /** Append-only BookPI sink for execution seals. */
  readonly ledger: Pick<BookPiLedgerPort, "append">;
  /** Bearer-token gate reused from the server (`authorizeApiToken`). */
  readonly authorizeApiToken: (req: Request, res: Response, envName: string) => boolean;
  /** Fixed-window limiter guard reused from the server (`enforceRateLimit`). */
  readonly enforceRateLimit: (req: Request, res: Response, limiter: FixedWindowRateLimiter, bucket: string) => boolean;
  /** Shared limiter instance for the HyperCore/MCP buckets. */
  readonly rateLimiter: FixedWindowRateLimiter;
  /** String-field extractor reused from the server (`commerceStringField`). */
  readonly commerceStringField: (body: Record<string, unknown>, key: string) => string | undefined;
  /** Optional evidence signing key for sealed executions. */
  readonly signingKey?: string;
}

export function registerHyperCoreRoutes(deps: HyperCoreRoutesDeps): void {
  const { app, skills, ledger, authorizeApiToken, enforceRateLimit, rateLimiter, commerceStringField } = deps;
  const HYPERCORE_ADMIN_PRINCIPAL = "genesis-admin";
  const HYPERCORE_RISK_CLASSES: readonly RiskClass[] = ["low", "medium", "high", "critical"];

  function parseHyperCoreRisk(body: Record<string, unknown>): RiskClass {
    const raw = (commerceStringField(body, "risk") ?? "low").toLowerCase();
    return HYPERCORE_RISK_CLASSES.includes(raw as RiskClass) ? (raw as RiskClass) : "low";
  }

  function stringArrayField(body: Record<string, unknown>, key: string): string[] {
    const value = body[key];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  app.get("/api/v1/hypercore/modes", (_req, res) => {
    res.json({
      success: true,
      id: HYPERCORE_ID,
      version: HYPERCORE_VERSION,
      modes: HYPERCORE_OMEGA_MODES,
      disclaimer: HYPERCORE_DISCLAIMER,
      capabilityManifest: buildIsabellaCapabilityManifest(),
    });
  });

  app.post("/api/v1/hypercore/run", async (req, res) => {
    if (!authorizeApiToken(req, res, "GENESIS_ADMIN_API_TOKEN")) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const intent = commerceStringField(body, "intent");
      const domain = commerceStringField(body, "domain");
      const prompt = commerceStringField(body, "prompt");
      if (!intent || !domain || !prompt) {
        res.status(400).json({ success: false, error: "intent, domain y prompt son requeridos" });
        return;
      }
      const task: HyperCoreTask = {
        taskId: commerceStringField(body, "taskId") ?? `task-${Date.now()}`,
        intent,
        domain,
        risk: parseHyperCoreRisk(body),
        prompt,
        contextTokens: typeof body.contextTokens === "number" ? body.contextTokens : 0,
        userScope: commerceStringField(body, "userScope"),
        territoryScope: commerceStringField(body, "territoryScope"),
        requiresAuthorization: body.requiresAuthorization === true,
      };
      const result = await hyperCore.run(task, { authenticatedPrincipal: HYPERCORE_ADMIN_PRINCIPAL });
      const delivered = result.status === "COMPLETED" || result.status === "CACHE_HIT";
      const status = delivered ? 200 : result.status === "ESCALATED" ? 202 : 403;
      res.status(status).json({ success: delivered, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : "HYPERCORE_RUN_FAILED" });
    }
  });

  app.post("/api/v1/hypercore/predict", (req, res) => {
    if (!authorizeApiToken(req, res, "GENESIS_ADMIN_API_TOKEN")) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const session: HyperPredictSession = {
        subject: commerceStringField(body, "subject") ?? HYPERCORE_ADMIN_PRINCIPAL,
        role: commerceStringField(body, "role") ?? "guardian",
        deviceTrusted: body.deviceTrusted === true,
        openArtifacts: stringArrayField(body, "openArtifacts"),
        currentIntent: commerceStringField(body, "currentIntent") ?? "",
        recentIntents: stringArrayField(body, "recentIntents"),
        risk: parseHyperCoreRisk(body),
        territory: commerceStringField(body, "territory") ?? "global",
      };
      const predictions = hyperPredict.predict(session);
      res.json({
        success: true,
        predictions,
        stats: hyperPredict.stats(),
        disclaimer: HYPERCORE_DISCLAIMER,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : "HYPERCORE_PREDICT_FAILED" });
    }
  });

  // -------------------------------------------------------------------------
  // HyperCore Ω — distributed skill execution runtime + MCP bridge.
  // state: draft | engine-generated. Admin-gated; every call passes the nine
  // execution phases, is triangulated and is sealed into BookPI. The service
  // mandate grants each skill exactly the scopes its own contract declares;
  // CROWN still ESCALATES high-risk executions for human approval.
  // -------------------------------------------------------------------------
  const hyperCoreOmegaEngine = new HyperCoreEngine(skills, {
    ledger,
    ...(deps.signingKey ? { signingKey: deps.signingKey } : {}),
  });

  const skillMcpServer = new SkillMcpServer({
    registry: skills,
    engine: hyperCoreOmegaEngine,
    identity: { actorId: "service:mcp", tenantId: "tamv", federationId: "federation-1", policyVersion: "CROWN-v20" },
    resolveScopes: (skillId) => skills.get(skillId).contract?.authority.requiredScopes ?? [],
  });

  app.get("/api/v1/hypercore/skills", (_req, res) => {
    res.json({
      success: true,
      contract: "isabella.hypercore.skills.v2",
      phases: HYPERCORE_OMEGA_PHASES,
      catalogManifest: skills.manifest(),
      skills: skills.list().map((skill) => ({
        id: skill.id,
        version: skill.version,
        methodId: skill.methodId,
        riskTier: skill.riskTier,
        scopes: skill.contract?.authority.requiredScopes ?? [],
      })),
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/v1/hypercore/skills/execute", async (req, res) => {
    if (!authorizeApiToken(req, res, "HYPERCORE_API_TOKEN")) return;
    if (!enforceRateLimit(req, res, rateLimiter, "hypercore-skill-execute")) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const skillId = typeof body.skillId === "string" ? body.skillId.trim() : "";
      if (!skillId) {
        res.status(400).json({ success: false, error: "SKILL_ID_REQUIRED" });
        return;
      }
      const signals = Array.isArray(body.signals) ? body.signals.filter((value): value is string => typeof value === "string") : [];
      const budgetRaw = typeof body.budget === "object" && body.budget !== null ? (body.budget as Record<string, unknown>) : {};
      const budget = {
        ...(typeof budgetRaw.maxLatencyMs === "number" ? { maxLatencyMs: budgetRaw.maxLatencyMs } : {}),
        ...(typeof budgetRaw.maxCalls === "number" ? { maxCalls: budgetRaw.maxCalls } : {}),
        ...(typeof budgetRaw.maxEnergyUnits === "number" ? { maxEnergyUnits: budgetRaw.maxEnergyUnits } : {}),
      };
      const requestId = typeof body.requestId === "string" ? body.requestId : randomUUID();
      const grantedScopes = skills.has(skillId) ? (skills.get(skillId).contract?.authority.requiredScopes ?? []) : [];
      const result = await hyperCoreOmegaEngine.execute({
        skillId,
        actorId: "service:hypercore-api",
        tenantId: typeof body.tenantId === "string" ? body.tenantId : "tamv",
        federationId: typeof body.federationId === "string" ? body.federationId : "federation-1",
        traceId: typeof body.traceId === "string" ? body.traceId : requestId,
        policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : "CROWN-v20",
        input: body.input ?? {},
        signals,
        grantedScopes,
        approvalProvided: body.approvalProvided === true,
        budget,
      });
      const status = result.status === "COMPLETED" ? 200 : result.status === "BLOCKED" ? 403 : 500;
      res.status(status).json({ success: result.status === "COMPLETED", result });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : "HYPERCORE_SKILL_EXECUTE_FAILED" });
    }
  });

  // MCP — Model Context Protocol over JSON-RPC 2.0 (initialize, tools/list, tools/call).
  app.post("/api/v1/mcp", async (req, res) => {
    if (!authorizeApiToken(req, res, "HYPERCORE_API_TOKEN")) return;
    if (!enforceRateLimit(req, res, rateLimiter, "mcp-jsonrpc")) return;
    try {
      const rpc = (req.body ?? {}) as Record<string, unknown>;
      const id = typeof rpc.id === "string" || typeof rpc.id === "number" || rpc.id === null ? rpc.id : null;
      const response = await skillMcpServer.handle({
        jsonrpc: typeof rpc.jsonrpc === "string" ? rpc.jsonrpc : "2.0",
        id,
        method: typeof rpc.method === "string" ? rpc.method : "",
        params: rpc.params,
      });
      res.json(response);
    } catch (error) {
      res.status(500).json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: error instanceof Error ? error.message : "MCP_INTERNAL_ERROR" } });
    }
  });
}
