import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { GenerationRequest, GenerationResult, InferenceAdapter, ModelDescriptor } from "../../src/inference/types";
import { FreeProviderRouter, GratisAPIAdapter, OllamaAdapter, createDefaultFreeProviderRouter } from "../../src/inference/free-providers";

function failingAdapter(name: string): InferenceAdapter {
  const descriptor: ModelDescriptor = { id: `fake-${name}`, version: "test", provider: name, capabilities: ["chat"], contextWindow: 1, maxOutputTokens: 1, latencyClass: "FAST" };
  return {
    descriptor,
    async generate(_request: GenerationRequest): Promise<GenerationResult> {
      throw new Error(`${name}_DOWN`);
    },
  };
}

function successfulAdapter(name: string): InferenceAdapter {
  const descriptor: ModelDescriptor = { id: `ok-${name}`, version: "test", provider: name, capabilities: ["chat"], contextWindow: 1, maxOutputTokens: 1, latencyClass: "FAST" };
  return {
    descriptor,
    async generate(request: GenerationRequest): Promise<GenerationResult> {
      return { modelId: descriptor.id, text: `${name}:${request.prompt}`, inputTokens: 1, outputTokens: 1, latencyMs: 1, finishReason: "stop" };
    },
  };
}

describe("free provider router", () => {
  it("fails closed when every provider is unavailable", async () => {
    const router = new FreeProviderRouter();
    router.register(failingAdapter("a"));
    router.register(failingAdapter("b"));
    await expect(router.generate({ prompt: "x", maxTokens: 10 })).rejects.toThrow("ALL_PROVIDERS_FAILED");
  });

  it("returns the first provider that succeeds, in registration order", async () => {
    const router = new FreeProviderRouter();
    router.register(failingAdapter("first"));
    router.register(successfulAdapter("second"));
    const result = await router.generate({ prompt: "hola", maxTokens: 10 });
    expect(result.modelId).toBe("ok-second");
    expect(result.text).toBe("second:hola");
  });

  it("skips the gratis adapter when no API key is configured", () => {
    const previousKey = process.env.GRATIS_API_KEY;
    delete process.env.GRATIS_API_KEY;
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      createDefaultFreeProviderRouter();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("GRATIS_API_KEY not set"));
    } finally {
      spy.mockRestore();
      if (previousKey === undefined) delete process.env.GRATIS_API_KEY;
      else process.env.GRATIS_API_KEY = previousKey;
    }
  });


  it("aborts when a provider sends headers but stalls the response body", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"response":"');
      // Intentionally leave the body open: the client timeout must cover body parsing too.
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
    }

    const adapter = new OllamaAdapter({
      baseUrl: `http://127.0.0.1:${address.port}`,
      timeoutMs: 80,
      maxRetries: 0,
    });

    try {
      await expect(adapter.generate({ prompt: "hello", maxTokens: 8 })).rejects.toThrow();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 3_000);

  it("does not report an unreachable compatible provider as healthy", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "unavailable" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
    }

    const adapter = new GratisAPIAdapter({
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      timeoutMs: 100,
      maxRetries: 0,
    });
    try {
      await expect(adapter.healthCheck()).resolves.toBe(false);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 3_000);

  it("bounds retries and backoff by one total timeout budget", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "temporarily unavailable" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
    }

    const adapter = new GratisAPIAdapter({
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      timeoutMs: 500,
      maxRetries: 3,
      retryBaseDelayMs: 500,
    });
    try {
      // Total timeout (500ms) bounds the entire retry sequence; first attempt takes ~150ms,
      // leaving ~350ms budget, not enough for retry (baseDelayMs: 500ms > remaining budget).
      // The retry logic correctly returns the HTTP 503 error instead of retrying.
      await expect(adapter.generate({ prompt: "hello", maxTokens: 8 })).rejects.toThrow("GRATIS_API_HTTP_503");
      expect(requests).toBe(1);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 5_000);

  it("declares a local ollama descriptor without network calls", () => {
    const adapter = new OllamaAdapter({ baseUrl: "http://127.0.0.1:1" });
    expect(adapter.descriptor.provider).toBe("ollama");
    expect(adapter.descriptor.id).toContain("ollama-");
  });
});