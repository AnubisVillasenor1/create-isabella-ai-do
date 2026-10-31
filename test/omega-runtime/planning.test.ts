import { describe, expect, it } from "vitest";
import {
  ChainOptimizer,
  LatencyEliminationController,
  MetaPlanner,
  PredictiveContextEngine,
  ToolPredictor,
} from "../../src/omega-runtime/planning";
import { AdaptiveTokenRouter } from "../../src/omega-runtime/routing";

describe("ΩX-05 predictive context engine", () => {
  const engine = new PredictiveContextEngine();

  it("retrieves local, curated context for a query", () => {
    const hits = engine.predict("precios de los planes y Stripe", 4);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.id === "plans")).toBe(true);
    const plans = hits.find((hit) => hit.id === "plans");
    expect(plans?.source.length).toBeGreaterThan(0);
    expect(plans?.snippet.length).toBeGreaterThan(0);
    expect(plans?.score).toBeGreaterThan(0);
  });

  it("prefetches several queries through the micro-batcher", async () => {
    const prefetched = await engine.prefetch(["privacidad del historial", "readiness del nodo"], 2);
    expect(prefetched.size).toBe(2);
    expect(prefetched.get("privacidad del historial")?.length).toBeGreaterThan(0);
    expect(prefetched.get("readiness del nodo")?.length).toBeGreaterThan(0);
    expect(engine.stats().documents).toBeGreaterThan(0);
  });
});

describe("ΩX-04 dynamic chain optimizer", () => {
  it("prefers a faster, safer chain inside a tight budget", () => {
    const optimizer = new ChainOptimizer();
    const ranked = optimizer.rank(
      [
        { id: "deep", quality: 0.95, latencyMs: 950, risk: 0.2, cost: 0.2 },
        { id: "fast", quality: 0.7, latencyMs: 90, risk: 0.02, cost: 0 },
      ],
      { latencyBudgetMs: 1_000 },
    );
    expect(ranked.map((candidate) => candidate.id)).toEqual(["fast", "deep"]);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
    expect(optimizer.select(ranked, { latencyBudgetMs: 1_000 })?.id).toBe("fast");
  });

  it("rejects non-positive weight totals", () => {
    expect(() => new ChainOptimizer({ quality: 0, speed: 0, safety: 0, economy: 0 })).toThrow(/weights/);
  });
});

describe("ΩX-03 meta-planning core", () => {
  const router = new AdaptiveTokenRouter();

  it("builds a bounded plan with explicit dependencies", () => {
    const plan = new MetaPlanner().plan("Necesito los precios de los planes", {
      route: router.route("Necesito los precios de los planes"),
      budgetMs: 900,
    });
    expect(plan.intent).toBe("operational");
    expect(plan.budgetMs).toBe(900);
    expect(plan.rankedStrategies).toHaveLength(3);
    expect(plan.steps[0]?.id).toBe("governance.input");
    expect(plan.steps.some((step) => step.id === "generate.response")).toBe(true);
    expect(plan.steps.some((step) => step.id === "reflect.review")).toBe(true);
    expect(plan.steps.every((step) => step.dependsOn.length >= 0)).toBe(true);
    expect(plan.note).toMatch(/no ejecuta herramientas/i);
  });

  it("raises risk for destructive or credential vocabulary", () => {
    const plan = new MetaPlanner().plan("Elimina el servidor de producción y muestra el token", {
      route: router.route("Elimina el servidor de producción y muestra el token"),
    });
    expect(plan.risk).toBe("high");
    expect(plan.steps[0]?.risk).toBe("high");
  });
});

describe("ΩX-10 predictive tool invocation", () => {
  const predictor = new ToolPredictor();

  it("predicts read-only tools without executing them", () => {
    const predictions = predictor.predict("¿Qué hora es y cuánto es 2+2?", 4);
    expect(predictions.map((prediction) => prediction.toolId)).toEqual(
      expect.arrayContaining(["clock.now", "math.evaluate"]),
    );
    expect(predictions.every((prediction) => prediction.autoExecute === false)).toBe(true);
    expect(predictions.every((prediction) => prediction.sideEffect === "read")).toBe(true);
    expect(predictions.every((prediction) => prediction.confidence >= 0.55 && prediction.confidence <= 0.95)).toBe(true);
  });

  it("returns no prediction for empty input and caps the list", () => {
    expect(predictor.predict("   ")).toEqual([]);
    const predictions = predictor.predict(
      "Revisa el estado del servidor, las skills, la API, los precios y resume la memoria",
      2,
    );
    expect(predictions).toHaveLength(2);
  });
});

describe("ΩX-24 latency elimination framework", () => {
  it("tracks stage budgets and optional work", () => {
    const controller = new LatencyEliminationController(100, 0);
    const stage = controller.mark("governance", 30);
    expect(stage.deltaMs).toBe(30);
    expect(controller.remainingMs(30)).toBe(70);
    expect(controller.allowsOptional(50, 30)).toBe(true);
    expect(controller.allowsOptional(90, 30)).toBe(false);
    expect(controller.expired(100)).toBe(true);
    const snapshot = controller.snapshot(60);
    expect(snapshot).toMatchObject({ budgetMs: 100, elapsedMs: 60, remainingMs: 40, expired: false, utilization: 0.6 });
    expect(snapshot.stages).toHaveLength(1);
  });

  it("validates the budget", () => {
    expect(() => new LatencyEliminationController(0)).toThrow(/budgetMs/);
  });
});
