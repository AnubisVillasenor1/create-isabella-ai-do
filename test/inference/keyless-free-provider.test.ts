import { describe, expect, it } from 'vitest';
import {
  buildKeylessFreeMessages,
  classifyKeylessFreeHttpFailure,
  extractKeylessFreeText,
  parseRetryAfterMs,
  resolveKeylessFreeProvider,
  resolveKeylessFreeProviders,
  resolveLocalCompatibleProvider,
  resolveLocalOllamaProvider,
} from '../../src/inference/provider-policy';
import { describeModelRuntime } from '../../src/federation/openapi';

describe('keyless free provider policy', () => {
  it('stays off unless the operator explicitly enables it', () => {
    expect(resolveKeylessFreeProvider({})).toBeNull();
    expect(resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: '' })).toBeNull();
    expect(resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: 'off' })).toBeNull();
    expect(resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: 'false' })).toBeNull();
  });

  it('accepts the documented opt-in aliases case-insensitively', () => {
    for (const flag of ['on', 'ON', 'true', '1', 'auto']) {
      const config = resolveKeylessFreeProvider({ ISABELLA_KEYLESS_FREE_PROVIDER: flag });
      expect(config, flag).not.toBeNull();
      expect(config?.name).toBe('llm7');
      expect(config?.endpoint).toBe('https://api.llm7.io');
      expect(config?.model).toBe('gpt-oss:20b');
      expect(config?.protocol).toBe('openai');
    }
    const explicit = resolveKeylessFreeProvider({
      ISABELLA_KEYLESS_FREE_PROVIDER: "  pollinations  ",
    });
    expect(explicit?.name).toBe("pollinations");
    expect(explicit?.endpoint).toBe("https://text.pollinations.ai");
    expect(explicit?.model).toBe("openai");
    expect(explicit?.protocol).toBe("pollinations");
  });

  it("keeps an explicit order and de-duplicates providers", () => {
    const configs = resolveKeylessFreeProviders({
      ISABELLA_KEYLESS_FREE_PROVIDER: "pollinations, llm7,pollinations",
    });
    expect(configs.map((config) => config.name)).toEqual(["pollinations", "llm7"]);
    expect(resolveKeylessFreeProviders({ ISABELLA_KEYLESS_FREE_PROVIDER: "off" })).toEqual([]);
    expect(resolveKeylessFreeProviders({ ISABELLA_KEYLESS_FREE_PROVIDER: "unknown" })).toEqual([]);
  });

  it('honors endpoint and model overrides and normalizes trailing slashes', () => {
    const config = resolveKeylessFreeProvider({
      ISABELLA_KEYLESS_FREE_PROVIDER: 'pollinations',
      KEYLESS_FREE_PROVIDER_URL: 'https://example.invalid/free///',
      KEYLESS_FREE_PROVIDER_MODEL: '  mistral  ',
    });
    expect(config?.endpoint).toBe('https://example.invalid/free');
    expect(config?.model).toBe('mistral');
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('builds a bounded system + history + user message list', () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn-${index}`,
    }));
    const messages = buildKeylessFreeMessages('system', 'current', history);
    expect(messages).toHaveLength(10);
    expect(messages[0]).toEqual({ role: 'system', content: 'system' });
    expect(messages[1]?.content).toBe('turn-4');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'current' });
  });

  it('bounds forwarded content so no single field is unbounded', () => {
    const [system, user] = buildKeylessFreeMessages('x'.repeat(5_000), 'y'.repeat(9_000));
    expect(system?.content).toHaveLength(2_000);
    expect(user?.content).toHaveLength(4_000);
  });

  it('normalizes provider plain text and rejects empty output', () => {
    expect(extractKeylessFreeText('  hola\r\nmundo  ')).toBe('hola\nmundo');
    expect(extractKeylessFreeText('   ')).toBeNull();
    expect(extractKeylessFreeText('abcdef', 3)).toBe('abc');
  });

  it("accepts an optional free-tier key but never exposes it in the public catalog", () => {
    const env = {
      ISABELLA_KEYLESS_FREE_PROVIDER: "pollinations",
      KEYLESS_FREE_PROVIDER_KEY: "  pol_free_secret  ",
    };
    const config = resolveKeylessFreeProvider(env);
    expect(config?.authorization).toBe("Bearer pol_free_secret");
    expect(config?.endpoint).toBe("https://text.pollinations.ai");
    const catalog = describeModelRuntime(env);
    expect(catalog.models.some((model) => model.id === "keyless-pollinations")).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain("pol_free_secret");
  });

  it("keeps the optional llm7 free-tier key server-side only", () => {
    const env = {
      ISABELLA_KEYLESS_FREE_PROVIDER: "llm7",
      LLM7_MODEL: "  minimax-m2.7  ",
      LLM7_API_KEY: "llm7_secret_value",
    };
    const config = resolveKeylessFreeProvider(env);
    expect(config?.name).toBe("llm7");
    expect(config?.model).toBe("minimax-m2.7");
    expect(config?.authorization).toBe("Bearer llm7_secret_value");
    expect(JSON.stringify(describeModelRuntime(env))).not.toContain("llm7_secret_value");
  });

  it("classifies quota and auth failures as terminal for the request", () => {
    expect(classifyKeylessFreeHttpFailure(402)).toEqual({
      kind: "quota",
      retryable: false,
      retryAfterMs: null,
    });
    expect(classifyKeylessFreeHttpFailure(429, "7")).toEqual({
      kind: "quota",
      retryable: false,
      retryAfterMs: 7_000,
    });
    expect(classifyKeylessFreeHttpFailure(401).kind).toBe("auth");
    expect(classifyKeylessFreeHttpFailure(403).retryable).toBe(false);
    expect(classifyKeylessFreeHttpFailure(400).retryable).toBe(false);
    expect(classifyKeylessFreeHttpFailure(503).retryable).toBe(true);
    expect(classifyKeylessFreeHttpFailure(408).retryable).toBe(true);
  });

  it("parses Retry-After as delta-seconds or an HTTP-date and rejects garbage", () => {
    expect(parseRetryAfterMs("30")).toBe(30_000);
    expect(parseRetryAfterMs("0")).toBe(0);
    expect(parseRetryAfterMs("nope")).toBeNull();
    expect(parseRetryAfterMs("")).toBeNull();
    expect(parseRetryAfterMs(null)).toBeNull();
    const now = Date.parse("2026-10-26T00:00:00Z");
    expect(parseRetryAfterMs("Sun, 26 Oct 2026 00:00:12 GMT", now)).toBe(12_000);
    expect(parseRetryAfterMs("Sun, 26 Oct 2026 00:00:00 GMT", now)).toBe(0);
  });
});

describe('local Ollama provider policy', () => {
  it('stays off unless enabled with an explicit model', () => {
    expect(resolveLocalOllamaProvider({})).toBeNull();
    expect(resolveLocalOllamaProvider({ OLLAMA_ENABLED: 'true' })).toBeNull();
    expect(
      resolveLocalOllamaProvider({ OLLAMA_ENABLED: 'false', OLLAMA_MODEL: 'qwen2.5:0.5b' })
    ).toBeNull();
  });

  it('defaults to the loopback Ollama API and normalizes trailing slashes', () => {
    const config = resolveLocalOllamaProvider({
      OLLAMA_ENABLED: 'true',
      OLLAMA_MODEL: '  qwen2.5:0.5b  ',
      OLLAMA_BASE_URL: 'http://127.0.0.1:11434///',
    });
    expect(config).toEqual({
      name: 'ollama-local',
      endpoint: 'http://127.0.0.1:11434/api/chat',
      model: 'qwen2.5:0.5b',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('rejects remote hosts unless the operator explicitly allows them', () => {
    const remote = {
      OLLAMA_ENABLED: 'true',
      OLLAMA_MODEL: 'qwen2.5:0.5b',
      OLLAMA_BASE_URL: 'https://ollama.example.com',
    };
    expect(resolveLocalOllamaProvider(remote)).toBeNull();
    expect(resolveLocalOllamaProvider({ ...remote, OLLAMA_ALLOW_REMOTE: 'true' })?.endpoint).toBe(
      'https://ollama.example.com/api/chat'
    );
  });

  it('rejects malformed and non-HTTP endpoints', () => {
    expect(
      resolveLocalOllamaProvider({
        OLLAMA_ENABLED: 'true',
        OLLAMA_MODEL: 'm',
        OLLAMA_BASE_URL: 'file:///etc/passwd',
      })
    ).toBeNull();
    expect(
      resolveLocalOllamaProvider({
        OLLAMA_ENABLED: 'true',
        OLLAMA_MODEL: 'm',
        OLLAMA_BASE_URL: 'not a url',
      })
    ).toBeNull();
  });
});

describe('local OpenAI-compatible provider policy', () => {
  it('stays off unless enabled with an explicit model', () => {
    expect(resolveLocalCompatibleProvider({})).toBeNull();
    expect(resolveLocalCompatibleProvider({ ISABELLA_LOCAL_COMPAT_ENABLED: 'true' })).toBeNull();
    expect(
      resolveLocalCompatibleProvider({
        ISABELLA_LOCAL_COMPAT_ENABLED: 'false',
        ISABELLA_LOCAL_COMPAT_MODEL: 'qwen2.5-7b-instruct',
      })
    ).toBeNull();
  });

  it('defaults to the loopback llama.cpp server and normalizes trailing slashes', () => {
    const config = resolveLocalCompatibleProvider({
      ISABELLA_LOCAL_COMPAT_ENABLED: 'true',
      ISABELLA_LOCAL_COMPAT_MODEL: '  qwen2.5-7b-instruct  ',
      ISABELLA_LOCAL_COMPAT_BASE_URL: 'http://127.0.0.1:8089/v1///',
    });
    expect(config).toEqual({
      name: 'local-compatible',
      endpoint: 'http://127.0.0.1:8089/v1/chat/completions',
      model: 'qwen2.5-7b-instruct',
      apiKey: 'local',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('keeps an explicit key and rejects remote hosts unless the operator allows them', () => {
    const remote = {
      ISABELLA_LOCAL_COMPAT_ENABLED: 'true',
      ISABELLA_LOCAL_COMPAT_MODEL: 'qwen',
      ISABELLA_LOCAL_COMPAT_BASE_URL: 'https://gpu.example.com/v1',
      ISABELLA_LOCAL_COMPAT_API_KEY: 'secret',
    };
    expect(resolveLocalCompatibleProvider(remote)).toBeNull();
    expect(
      resolveLocalCompatibleProvider({ ...remote, ISABELLA_LOCAL_COMPAT_ALLOW_REMOTE: 'true' })
    ).toEqual({
      name: 'local-compatible',
      endpoint: 'https://gpu.example.com/v1/chat/completions',
      model: 'qwen',
      apiKey: 'secret',
    });
  });

  it('rejects malformed and non-HTTP endpoints', () => {
    expect(
      resolveLocalCompatibleProvider({
        ISABELLA_LOCAL_COMPAT_ENABLED: 'true',
        ISABELLA_LOCAL_COMPAT_MODEL: 'm',
        ISABELLA_LOCAL_COMPAT_BASE_URL: 'file:///etc/passwd',
      })
    ).toBeNull();
  });
});
