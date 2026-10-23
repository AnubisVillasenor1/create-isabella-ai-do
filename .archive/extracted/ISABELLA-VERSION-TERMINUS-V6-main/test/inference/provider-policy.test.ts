import { describe, expect, it } from "vitest";
import { buildOpenAICompatibleCandidates, isOpenRouterModelAllowed } from "../../src/inference/provider-policy";

describe("OpenAI-compatible candidate builder", () => {
  it("fails closed without paid-provider opt-in, even when credentials exist", () => {
    expect(buildOpenAICompatibleCandidates({})).toHaveLength(0);
    expect(buildOpenAICompatibleCandidates({
      OLLAMA_API_KEY: "key",
      OLLAMA_MODEL: "gpt-oss:20b",
      GROQ_API_KEY: "groq-key",
      GROQ_MODEL: "openai/gpt-oss-20b",
    })).toHaveLength(0);
  });

  it("requires explicit opt-in, key, and model rather than supplying a default model", () => {
    expect(buildOpenAICompatibleCandidates({
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
      OLLAMA_API_KEY: "key",
    })).toHaveLength(0);

    const candidates = buildOpenAICompatibleCandidates({
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
      OLLAMA_API_KEY: "key",
      OLLAMA_MODEL: "gpt-oss:20b",
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: "ollama",
      url: "https://ollama.com/v1/chat/completions",
      model: "gpt-oss:20b",
    });
  });

  it("honors explicit provider base URL and model", () => {
    const [candidate] = buildOpenAICompatibleCandidates({
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
      OLLAMA_API_KEY: "key",
      OLLAMA_BASE_URL: "http://localhost:11434/v1/",
      OLLAMA_MODEL: "llama3.2",
    });
    expect(candidate?.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(candidate?.model).toBe("llama3.2");
  });

  it("preserves attempt order and drops providers missing either key or model", () => {
    const candidates = buildOpenAICompatibleCandidates({
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
      OLLAMA_API_KEY: "ollama-key",
      OLLAMA_MODEL: "ollama-model",
      GROQ_API_KEY: "groq-key",
      GROQ_MODEL: "groq-model",
      CEREBRAS_API_KEY: "cerebras-key",
      // No CEREBRAS_MODEL: must not silently choose a tariff/model.
      TOGETHER_API_KEY: "together-key",
      TOGETHER_MODEL: "together-model",
    });
    expect(candidates.map((candidate) => candidate.name)).toEqual(["ollama", "groq", "together"]);
  });

  it("treats blank credentials and models as absent", () => {
    expect(buildOpenAICompatibleCandidates({
      ALLOW_PAID_PROVIDER_FALLBACK: "true",
      OLLAMA_API_KEY: "   ",
      OLLAMA_MODEL: "gpt-oss:20b",
      GROQ_API_KEY: "groq-key",
      GROQ_MODEL: "  ",
    })).toHaveLength(0);
  });

  it("requires the exact paid opt-in value", () => {
    expect(buildOpenAICompatibleCandidates({
      ALLOW_PAID_PROVIDER_FALLBACK: "yes",
      GROQ_API_KEY: "groq-key",
      GROQ_MODEL: "model",
    })).toHaveLength(0);
  });
});

describe("OpenRouter free-model guard", () => {
  it("accepts the free router and explicit :free model IDs when paid routes are disabled", () => {
    expect(isOpenRouterModelAllowed("openrouter/free", false)).toBe(true);
    expect(isOpenRouterModelAllowed("publisher/model:free", false)).toBe(true);
  });

  it("rejects paid or unknown model IDs from the free route", () => {
    expect(isOpenRouterModelAllowed("publisher/model", false)).toBe(false);
    expect(isOpenRouterModelAllowed("   ", true)).toBe(false);
  });
});
