import { describe, expect, it } from "vitest";
import type { Application, Request, Response } from "express";
import type { FixedWindowRateLimiter } from "../../src/security/rate-limit";
import { OMEGA_ROUTES_VERSION, registerOmegaRoutes } from "../../src/routes/omega";

type Handler = (req: Request, res: Response) => void | Promise<void>;

function makeRes() {
  const captured = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
}

function harness() {
  const handlers = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
  } as unknown as Application;
  registerOmegaRoutes({
    app,
    enforceRateLimit: () => true,
    rateLimiter: {} as FixedWindowRateLimiter,
  });
  return handlers;
}

const call = (handlers: Map<string, Handler>, key: string, body: unknown) => {
  const { res, captured } = makeRes();
  handlers.get(key)!({ body, query: {} } as unknown as Request, res);
  return captured;
};

const validAssertions = [
  {
    stage: "constitution",
    identity: "operator:1",
    evidence: ["ev-1"],
    authority: "mandate:1",
    auditTrail: ["audit-1"],
    humanOverrideAvailable: true,
    economicJustification: "cost < benefit",
    territory: "RDM",
    explanation: "porque sí",
    recoveryPlan: "rollback",
    learningRecord: "crisis-1",
  },
  { stage: "policy" },
  { stage: "mandate" },
  { stage: "capability" },
  { stage: "execution" },
];

describe("Ω∞ Omega routes", () => {
  it("expone una versión de superficie", () => {
    expect(OMEGA_ROUTES_VERSION).toBe("1.1.0");
  });

  it("GET omega/constitution publica artículos y flujo", () => {
    const handlers = harness();
    const captured = call(handlers, "GET /api/v3/omega/constitution", undefined);
    const body = captured.body as Record<string, unknown>;
    expect((body.articles as unknown[]).length).toBe(10);
    expect((body.flow as unknown[]).length).toBe(5);
  });

  it("POST constitution/evaluate aprueba una propuesta completa", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/constitution/evaluate", { assertions: validAssertions });
    const body = captured.body as Record<string, unknown>;
    expect(captured.status).toBe(200);
    expect((body.decision as Record<string, unknown>).allowed).toBe(true);
  });

  it("POST constitution/evaluate responde 422 cuando se incumple", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/constitution/evaluate", { assertions: [] });
    expect(captured.status).toBe(422);
    expect((captured.body as Record<string, unknown>).decision).toBeDefined();
  });

  it("POST simulation/run devuelve el informe", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/simulation/run", { base: 100, volatility: 0.2, confidence: 0.9 });
    const body = captured.body as Record<string, unknown>;
    expect((body.report as Record<string, unknown>).bestCase).toBe(120);
    expect((body.report as Record<string, unknown>).worstCase).toBe(80);
  });

  it("POST capital/value devuelve el capital cognitivo", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/capital/value", {
      utility: 10,
      trust: 20,
      demand: 30,
      evidence: 40,
      reputation: 50,
    });
    expect((captured.body as Record<string, unknown>).capital).toMatchObject({ value: 150 });
  });

  it("POST civilization/value aplica la ecuación maestra con cero anulante", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/civilization/value", {
      intelligence: 1,
      governance: 1,
      evidence: 1,
      trust: 0,
      economy: 1,
      memory: 1,
      resilience: 1,
      territorialImpact: 1,
    });
    const equation = (captured.body as { equation: { value: number; zeroFactors: string[] } }).equation;
    expect(equation.value).toBe(0);
    expect(equation.zeroFactors).toEqual(["trust"]);
  });

  it("GET omega/nexus devuelve el modelo de vista", () => {
    const handlers = harness();
    const captured = call(handlers, "GET /api/v3/omega/nexus", undefined);
    const view = (captured.body as { view: { panelCount: number; panels: unknown[] } }).view;
    expect(view.panelCount).toBe(8);
    expect(view.panels.length).toBe(8);
  });

  it("POST twins/federate autoriza con aprobación humana", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/twins/federate", {
      nodes: [{ id: "a", capabilities: ["read"], dataResidency: "eu" }],
      grants: [{ fromTwin: "a", toTwin: "a", scope: "read", approvedByHuman: true }],
    });
    const federation = (captured.body as { federation: { edges: Array<{ authorized: boolean }> } }).federation;
    expect(federation.edges[0]?.authorized).toBe(true);
  });

  it("POST memory/store + memory/query usa la memoria en proceso", () => {
    const handlers = harness();
    call(handlers, "POST /api/v3/omega/memory/store", { id: "m1", layer: "semantic", content: "hola mundo", importance: 0.7 });
    const captured = call(handlers, "POST /api/v3/omega/memory/query", { text: "hola" });
    expect((captured.body as Record<string, unknown>).count).toBe(1);
  });

  it("POST trust/analyze calcula el puntaje verificado", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/trust/analyze", {
      attestations: [{ subject: "s", issuer: "i", claim: "c", weight: 0.8, verified: true }],
    });
    const mesh = (captured.body as { mesh: { nodes: Array<{ score: number; grade: string }> } }).mesh;
    expect(mesh.nodes[0]?.score).toBe(1);
    expect(mesh.nodes[0]?.grade).toBe("high");
  });

  it("POST research/run selecciona la hipótesis con evidencia suficiente", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/research/run", {
      hypotheses: [{ id: "h1", statement: "x", novelty: 0.9, feasibility: 0.9, evidence: 0.9, risk: 0.1 }],
    });
    expect((captured.body as Record<string, unknown>).selectedId).toBe("h1");
  });

  it("POST territory/fabricate nunca autoriza despliegue", () => {
    const handlers = harness();
    const captured = call(handlers, "POST /api/v3/omega/territory/fabricate", {
      territories: [{ id: "t", name: "Territorio", population: 1000, readiness: 0.9, sovereignty: "RDM" }],
    });
    expect((captured.body as Record<string, unknown>).deploymentAuthorized).toBe(false);
  });
});
