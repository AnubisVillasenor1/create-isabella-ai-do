import { describe, expect, it } from "vitest";
import { GovernedInferenceRouter } from "../../src/inference/router";

describe("inference guardrails", () => {
  it("rejects a model without chat capability", () => {
    const r = new GovernedInferenceRouter();
    expect(() => r.register({
      descriptor: {
        id: "embedding-only",
        version: "1.0.0",
        provider: "test",
        capabilities: ["embedding"],
        contextWindow: 4096,
        maxOutputTokens: 1,
        latencyClass: "FAST",
      },
      generate: async () => ({ modelId: "embedding-only", text: "", inputTokens: 0, outputTokens: 0, latencyMs: 1, finishReason: "stop" }),
    })).toThrow(/chat capability/);
  });

  it("rejects context overflow", async () => {
    const r = new GovernedInferenceRouter();
    r.register({
      descriptor: {
        id: "m1",
        version: "1.0.0",
        provider: "test",
        capabilities: ["chat"],
        contextWindow: 8,
        maxOutputTokens: 4,
        latencyClass: "FAST",
      },
      generate: async () => ({ modelId: "m1", text: "ok", inputTokens: 1, outputTokens: 1, latencyMs: 1, finishReason: "stop" }),
    });
    await expect(r.generate({ prompt: "this prompt is intentionally long", maxTokens: 2 })).rejects.toThrow(/context window/);
  });
});
