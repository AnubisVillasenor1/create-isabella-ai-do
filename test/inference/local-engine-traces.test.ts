import { describe, expect, it } from "vitest";
import { LocalInferenceEngine } from "../../src/inference/local-engine";

describe("native LLM · intent matching with traces", () => {
  it("returns HIGH confidence and matched terms for a full intent match", async () => {
    const engine = new LocalInferenceEngine();
    const result = await engine.generate({ prompt: "¿Quién eres y qué eres?", maxTokens: 128 });
    expect(result.confidence).toBe("HIGH");
    expect(result.intent).not.toBe("unknown");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("scores partial matches by relative keyword length and prefers the more specific one", () => {
    const engine = new LocalInferenceEngine();
    const short = (engine as unknown as { matchIntent: (p: string) => { score: number; matchedTerms: readonly string[] } }).matchIntent(
      "cuéntame de real",
    );
    const long = (engine as unknown as { matchIntent: (p: string) => { score: number } }).matchIntent(
      "cuéntame de real del monte",
    );
    expect(long.score).toBeGreaterThan(short.score);
    expect(short.matchedTerms).toContain("real");
  });

  it("falls back with LOW confidence and score 0 when nothing matches", async () => {
    const engine = new LocalInferenceEngine();
    const result = await engine.generate({ prompt: "zzzz qqqq", maxTokens: 128 });
    expect(result.confidence).toBe("LOW");
    expect(result.intent).toBe("unknown");
    const traced = (engine as unknown as { matchIntent: (p: string) => { score: number; matchedTerms: readonly string[] } }).matchIntent(
      "zzzz qqqq",
    );
    expect(traced.score).toBe(0);
    expect(traced.matchedTerms).toHaveLength(0);
  });

  it("tracks the distribution of served intents", async () => {
    const engine = new LocalInferenceEngine();
    await engine.generate({ prompt: "hola", maxTokens: 64 });
    await engine.generate({ prompt: "hola de nuevo", maxTokens: 64 });
    await engine.generate({ prompt: "zzzz qqqq", maxTokens: 64 });
    const distribution = engine.intentDistribution();
    expect(distribution.length).toBeGreaterThan(0);
    expect(distribution[0]?.count).toBeGreaterThanOrEqual(distribution.at(-1)?.count ?? 0);
  });

  it("respects the configured maximum response length", async () => {
    const engine = new LocalInferenceEngine({ maxResponseLength: 10 });
    const result = await engine.generate({ prompt: "hola", maxTokens: 64 });
    expect(result.text.length).toBeLessThanOrEqual(10);
  });
});
