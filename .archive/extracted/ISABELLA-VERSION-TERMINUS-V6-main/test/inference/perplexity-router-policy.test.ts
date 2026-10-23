import { describe, expect, it } from "vitest";
import { describePerplexityReadiness, resolvePerplexityGenerationConfig } from "../../src/inference/perplexity-router";

describe("Perplexity Router generation policy", () => {
  it("does not enable generation from an API key alone", () => {
    expect(resolvePerplexityGenerationConfig({ PERPLEXITY_API_KEY: "secret-key" })).toBeNull();
    expect(describePerplexityReadiness({ PERPLEXITY_API_KEY: "secret-key" })).toEqual({
      configured: false,
      model: null,
      paidOptInRequired: true,
    });
  });

  it("requires an explicit model identifier and paid opt-in", () => {
    expect(resolvePerplexityGenerationConfig({
      PERPLEXITY_API_KEY: "secret-key",
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
    })).toBeNull();
    expect(resolvePerplexityGenerationConfig({
      PERPLEXITY_API_KEY: "secret-key",
      PERPLEXITY_ROUTER_MODEL: "perplexity/kimi-k3",
    })).toBeNull();
  });

  it("enables only the operator-selected model after paid opt-in", () => {
    const env = {
      PERPLEXITY_API_KEY: "secret-key",
      PERPLEXITY_ROUTER_MODEL: "publisher/selected-model",
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
    };
    expect(resolvePerplexityGenerationConfig(env)).toEqual({
      apiKey: "secret-key",
      model: "publisher/selected-model",
    });
    expect(describePerplexityReadiness(env)).toEqual({
      configured: true,
      model: "publisher/selected-model",
      paidOptInRequired: true,
    });
  });

  it("fails closed if opt-in is not exactly true or values are blank", () => {
    expect(resolvePerplexityGenerationConfig({
      PERPLEXITY_API_KEY: "secret-key",
      PERPLEXITY_ROUTER_MODEL: "publisher/selected-model",
      ALLOW_PAID_PROVIDER_FALLBACK: "yes",
    })).toBeNull();
    expect(resolvePerplexityGenerationConfig({
      PERPLEXITY_API_KEY: "  ",
      PERPLEXITY_ROUTER_MODEL: "  ",
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
    })).toBeNull();
  });
});
