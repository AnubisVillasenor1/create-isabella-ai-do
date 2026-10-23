import type { GenerationRequest, GenerationResult, InferenceAdapter, ModelDescriptor } from "./types";

export interface FreeProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  timeoutMs: number;
}



function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("timeout") ||
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("network")
    );
  }
  return false;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  // Keep the timeout signal alive for the response body, not just until headers arrive.
  // Clearing a manual timer when fetch() resolves leaves response.json()/text() unbounded.
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...init, signal });
}

async function retryWithBackoff<T>(
  operation: (attemptTimeoutMs: number) => Promise<T>,
  options: RetryOptions,
  context: string,
): Promise<T> {
  // timeoutMs is the deadline for the entire retry sequence, not a fresh allowance per attempt.
  const deadlineAt = Date.now() + options.timeoutMs;
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) break;
    try {
      return await operation(Math.max(1, remainingMs));
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxRetries || Date.now() >= deadlineAt) break;
      if (!isRetryableError(error)) throw error;
      const delay = options.baseDelayMs * Math.pow(2, attempt);
      const remainingAfterFailure = deadlineAt - Date.now();
      // Do not sleep through the entire remaining budget just to start a retry that cannot run.
      if (delay >= remainingAfterFailure) break;
      log("warn", `${context}: attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(delay);
    }
  }
  throw lastError ?? new Error(`${context}_RETRY_DEADLINE_EXCEEDED`);
}

export class OllamaAdapter implements InferenceAdapter {
  readonly descriptor: ModelDescriptor;
  private readonly config: FreeProviderConfig;

  constructor(config: Partial<FreeProviderConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      model: config.model ?? process.env.OLLAMA_MODEL ?? "llama3.2",
      timeoutMs: config.timeoutMs ?? 30_000,
      maxRetries: config.maxRetries ?? 2,
      retryBaseDelayMs: config.retryBaseDelayMs ?? 500,
    };
    this.descriptor = {
      id: `ollama-${this.config.model}`,
      version: "local",
      provider: "ollama",
      capabilities: ["chat"],
      contextWindow: 128_000,
      maxOutputTokens: 4096,
      latencyClass: "BALANCED",
    };
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const started = Date.now();
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/api/generate`;

    const result = await retryWithBackoff(
      async (attemptTimeoutMs) => {
        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: this.config.model,
              prompt: request.prompt,
              stream: false,
              options: {
                num_predict: request.maxTokens,
                temperature: request.temperature ?? 0.35,
              },
            }),
          },
          Math.min(this.config.timeoutMs, attemptTimeoutMs),
        );

        if (!response.ok) {
          throw new Error(`OLLAMA_HTTP_${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          response?: string;
          done?: boolean;
          eval_count?: number;
          prompt_eval_count?: number;
        };

        if (!data.response) {
          throw new Error("OLLAMA_EMPTY_RESPONSE");
        }

        return data;
      },
      {
        maxRetries: this.config.maxRetries,
        baseDelayMs: this.config.retryBaseDelayMs,
        timeoutMs: this.config.timeoutMs,
      },
      "OllamaAdapter",
    );

    const text = result.response ?? "";
    return {
      modelId: this.descriptor.id,
      text,
      inputTokens: result.prompt_eval_count ?? Math.ceil(request.prompt.length / 4),
      outputTokens: result.eval_count ?? Math.ceil(text.length / 4),
      latencyMs: Date.now() - started,
      finishReason: result.done === false ? "length" : "stop",
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${this.config.baseUrl.replace(/\/$/, "")}/api/tags`,
        { method: "GET" },
        5_000,
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class GratisAPIAdapter implements InferenceAdapter {
  readonly descriptor: ModelDescriptor;
  private readonly config: FreeProviderConfig;

  constructor(config: Partial<FreeProviderConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? process.env.GRATIS_API_URL ?? "https://api.gratis.ai/v1",
      apiKey: config.apiKey ?? process.env.GRATIS_API_KEY,
      model: config.model ?? process.env.GRATIS_API_MODEL ?? "gpt-4o-mini",
      timeoutMs: config.timeoutMs ?? 30_000,
      maxRetries: config.maxRetries ?? 2,
      retryBaseDelayMs: config.retryBaseDelayMs ?? 500,
    };
    this.descriptor = {
      id: `gratis-${this.config.model}`,
      version: "external",
      provider: "gratis-api",
      capabilities: ["chat"],
      contextWindow: 128_000,
      maxOutputTokens: 4096,
      latencyClass: "BALANCED",
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;
      const response = await fetchWithTimeout(
        `${this.config.baseUrl.replace(/\/$/, "")}/models`,
        { method: "GET", headers },
        5_000,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const started = Date.now();
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const result = await retryWithBackoff(
      async (attemptTimeoutMs) => {
        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: this.config.model,
              messages: [{ role: "user", content: request.prompt }],
              max_tokens: request.maxTokens,
              temperature: request.temperature ?? 0.35,
            }),
          },
          Math.min(this.config.timeoutMs, attemptTimeoutMs),
        );

        if (!response.ok) {
          throw new Error(`GRATIS_API_HTTP_${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("GRATIS_API_EMPTY_RESPONSE");
        }

        return { content, usage: data.usage, finishReason: data.choices?.[0]?.finish_reason };
      },
      {
        maxRetries: this.config.maxRetries,
        baseDelayMs: this.config.retryBaseDelayMs,
        timeoutMs: this.config.timeoutMs,
      },
      "GratisAPIAdapter",
    );

    return {
      modelId: this.descriptor.id,
      text: result.content,
      inputTokens: result.usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4),
      outputTokens: result.usage?.completion_tokens ?? Math.ceil(result.content.length / 4),
      latencyMs: Date.now() - started,
      finishReason: result.finishReason === "length" ? "length" : "stop",
    };
  }
}

export class FreeProviderRouter {
  private readonly adapters: InferenceAdapter[] = [];

  register(adapter: InferenceAdapter): void {
    this.adapters.push(adapter);
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const errors: string[] = [];

    for (const adapter of this.adapters) {
      try {
        log("info", `Trying provider: ${adapter.descriptor.provider}/${adapter.descriptor.id}`);
        const result = await adapter.generate(request);
        log("info", `Provider succeeded: ${adapter.descriptor.provider}`, {
          latencyMs: result.latencyMs,
        });
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log("warn", `Provider failed: ${adapter.descriptor.provider}`, { error: msg });
        errors.push(`${adapter.descriptor.provider}: ${msg}`);
      }
    }

    throw new Error(`ALL_PROVIDERS_FAILED: ${errors.join(" | ")}`);
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const adapter of this.adapters) {
      if (adapter instanceof OllamaAdapter || adapter instanceof GratisAPIAdapter) {
        results[adapter.descriptor.provider] = await adapter.healthCheck();
      } else {
        // Unknown adapters must not be reported healthy without an actual probe.
        results[adapter.descriptor.provider] = false;
      }
    }
    return results;
  }
}

export function createDefaultFreeProviderRouter(): FreeProviderRouter {
  const router = new FreeProviderRouter();

  const ollama = new OllamaAdapter();
  router.register(ollama);

  const gratisKey = process.env.GRATIS_API_KEY;
  if (gratisKey) {
    const gratis = new GratisAPIAdapter();
    router.register(gratis);
  } else {
    log("info", "GRATIS_API_KEY not set, skipping GratisAPIAdapter");
  }

  return router;
}
