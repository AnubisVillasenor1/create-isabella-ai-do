/**
 * Shared policy helpers for external inference adapters.
 * These helpers make provider routing constraints deterministic and unit-testable.
 */

export function boundedMilliseconds(
  rawValue: string | number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (![fallback, minimum, maximum].every(Number.isFinite) || minimum <= 0 || maximum < minimum) {
    throw new RangeError('invalid millisecond bounds');
  }
  const parsed = rawValue === undefined || rawValue === '' ? Number.NaN : Number(rawValue);
  const candidate = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(maximum, Math.max(minimum, candidate));
}

/**
 * The OpenRouter free router and model IDs ending in :free are permitted when
 * paid routes are disabled. This is a conservative configuration guard, not a
 * guarantee that a provider's model remains free or available.
 */
export function isOpenRouterModelAllowed(modelId: string, paidRoutesEnabled: boolean): boolean {
  const model = modelId.trim();
  if (!model) return false;
  if (paidRoutesEnabled) return true;
  return model === 'openrouter/free' || model.endsWith(':free');
}

export interface OpenAICompatibleCandidate {
  readonly name: string;
  readonly key: string;
  readonly url: string;
  readonly model: string;
}

interface CandidateSpec {
  name: string;
  key: string | undefined;
  url: string;
  model: string | undefined;
}

/**
 * Candidate list for APIs whose billing/quota cannot be proven from an API key.
 * These providers are considered potentially billable: they are completely
 * disabled unless the operator opts into paid fallbacks and supplies an
 * explicit model ID for every provider. A provider key alone is not consent to
 * spend money, and default model IDs must not silently select a tariff.
 */
export function buildOpenAICompatibleCandidates(
  env: Readonly<Record<string, string | undefined>>
): readonly OpenAICompatibleCandidate[] {
  if (env.ALLOW_PAID_PROVIDER_FALLBACK !== 'true') return Object.freeze([]);
  const ollamaBase = (env.OLLAMA_BASE_URL?.trim() || 'https://ollama.com/v1').replace(/\/+$/, '');
  const specs: readonly CandidateSpec[] = [
    {
      name: 'ollama',
      key: env.OLLAMA_API_KEY,
      url: `${ollamaBase}/chat/completions`,
      model: env.OLLAMA_MODEL?.trim(),
    },
    {
      name: 'groq',
      key: env.GROQ_API_KEY,
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: env.GROQ_MODEL?.trim(),
    },
    {
      name: 'cerebras',
      key: env.CEREBRAS_API_KEY,
      url: 'https://api.cerebras.ai/v1/chat/completions',
      model: env.CEREBRAS_MODEL?.trim(),
    },
    {
      name: 'together',
      key: env.TOGETHER_API_KEY,
      url: 'https://api.together.xyz/v1/chat/completions',
      model: env.TOGETHER_MODEL?.trim(),
    },
    {
      name: 'deepinfra',
      key: env.DEEPINFRA_API_KEY,
      url: 'https://api.deepinfra.com/v1/openai/chat/completions',
      model: env.DEEPINFRA_MODEL?.trim(),
    },
    {
      name: 'fireworks',
      key: env.FIREWORKS_API_KEY,
      url: 'https://api.fireworks.ai/inference/v1/chat/completions',
      model: env.FIREWORKS_MODEL?.trim(),
    },
  ];
  const candidates: OpenAICompatibleCandidate[] = [];
  for (const spec of specs) {
    const key = spec.key?.trim();
    const model = spec.model?.trim();
    if (key && model)
      candidates.push(Object.freeze({ name: spec.name, key, url: spec.url, model }));
  }
  return Object.freeze(candidates);
}

type AssistantContentPart = { type?: unknown; text?: unknown };
type OpenAICompatibleResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

/** Extract only textual assistant content from common OpenAI-compatible response shapes. */
export function extractAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const response = payload as OpenAICompatibleResponse;
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    const text = content.trim();
    return text.length > 0 ? text : null;
  }
  if (!Array.isArray(content)) return null;
  const pieces = (content as AssistantContentPart[])
    .filter(
      (part) =>
        part &&
        (part.type === 'text' || part.type === 'output_text') &&
        typeof part.text === 'string'
    )
    .map((part) => (part.text as string).trim())
    .filter(Boolean);
  return pieces.length > 0 ? pieces.join('\n') : null;
}

export type KeylessFreeProviderName = 'pollinations' | 'llm7';

export interface KeylessFreeProviderConfig {
  readonly name: KeylessFreeProviderName;
  readonly endpoint: string;
  readonly model: string;
  /** Wire contract. llm7 is plain OpenAI-compatible; pollinations has two contracts. */
  readonly protocol: 'pollinations' | 'openai';
  /** Conservative pause after this provider rejects a request for quota. */
  readonly quotaCooldownMs: number;
  /** Optional operator-provided free-tier key. Never echoed in any response. */
  readonly authorization?: string;
}

export interface KeylessFreeMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LocalOllamaProviderConfig {
  readonly name: 'ollama-local';
  readonly endpoint: string;
  readonly model: string;
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/**
 * Local Ollama inference is keyless and must never be confused with a paid
 * OpenAI-compatible provider. It is opt-in and restricted to loopback/private
 * addresses unless the operator explicitly allows a remote host.
 */
export function resolveLocalOllamaProvider(
  env: Readonly<Record<string, string | undefined>>
): LocalOllamaProviderConfig | null {
  if (env.OLLAMA_ENABLED?.trim().toLowerCase() !== 'true') return null;
  const model = env.OLLAMA_MODEL?.trim();
  if (!model) return null;
  const rawBase = (env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  let base: URL;
  try {
    base = new URL(rawBase);
  } catch {
    return null;
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return null;
  const host = base.hostname.toLowerCase();
  const privateHost =
    LOOPBACK_HOSTS.has(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (!privateHost && env.OLLAMA_ALLOW_REMOTE?.trim().toLowerCase() !== 'true') return null;
  return Object.freeze({
    name: 'ollama-local',
    endpoint: `${rawBase}/api/chat`,
    model,
  });
}

export interface LocalCompatibleProviderConfig {
  readonly name: 'local-compatible';
  readonly endpoint: string;
  readonly model: string;
  readonly apiKey: string;
}

/**
 * Private local OpenAI-compatible inference server (llama.cpp / vLLM / LM Studio
 * serving a Qwen-class model). Opt-in and restricted to loopback/private addresses
 * unless the operator explicitly allows a remote host — mirroring the Ollama gate.
 * It is disclosed as "local-compatible", never presented as sovereign inference and
 * never confused with a paid provider. The base URL must already include the version
 * path (e.g. http://127.0.0.1:8089/v1); /chat/completions is appended.
 */
export function resolveLocalCompatibleProvider(
  env: Readonly<Record<string, string | undefined>>
): LocalCompatibleProviderConfig | null {
  if (env.ISABELLA_LOCAL_COMPAT_ENABLED?.trim().toLowerCase() !== 'true') return null;
  const model = env.ISABELLA_LOCAL_COMPAT_MODEL?.trim();
  if (!model) return null;
  const rawBase = (
    env.ISABELLA_LOCAL_COMPAT_BASE_URL?.trim() || 'http://127.0.0.1:8089/v1'
  ).replace(/\/+$/, '');
  let base: URL;
  try {
    base = new URL(rawBase);
  } catch {
    return null;
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return null;
  const host = base.hostname.toLowerCase();
  const privateHost =
    LOOPBACK_HOSTS.has(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (!privateHost && env.ISABELLA_LOCAL_COMPAT_ALLOW_REMOTE?.trim().toLowerCase() !== 'true')
    return null;
  return Object.freeze({
    name: 'local-compatible',
    endpoint: `${rawBase}/chat/completions`,
    model,
    apiKey: env.ISABELLA_LOCAL_COMPAT_API_KEY?.trim() ?? 'local',
  });
}

const KEYLESS_FREE_ALIASES: ReadonlySet<string> = new Set(['on', 'true', '1', 'auto']);
const KEYLESS_FREE_DISABLED: ReadonlySet<string> = new Set(['', 'off', 'false', '0', 'no']);
/** When the operator writes a generic opt-in, the most reliable free routes go first. */
const DEFAULT_KEYLESS_FREE_ORDER: readonly KeylessFreeProviderName[] = ['llm7', 'pollinations'];
const DEFAULT_KEYLESS_FREE_ENDPOINT = 'https://text.pollinations.ai';
const DEFAULT_KEYLESS_FREE_MODEL = 'openai';
const DEFAULT_LLM7_ENDPOINT = 'https://api.llm7.io';
const DEFAULT_LLM7_MODEL = 'gpt-oss:20b';

/**
 * Operator-gated keyless free text providers. These adapters emit REAL generative
 * text WITHOUT a credential so a node can converse before an operator configures a
 * keyed provider. They return nothing unless explicitly enabled, so user content
 * never leaves the node by default. Each is disclosed as an external engine and is
 * never presented as sovereign inference.
 *
 * The flag accepts a comma-separated order (e.g. `llm7,pollinations`) or a generic
 * opt-in alias, which selects the built-in order. Free tiers enforce their own
 * per-IP limits; the adapter never invents a reply when one is exhausted.
 */
export function resolveKeylessFreeProviders(
  env: Readonly<Record<string, string | undefined>>
): readonly KeylessFreeProviderConfig[] {
  const flag = (env.ISABELLA_KEYLESS_FREE_PROVIDER ?? '').trim().toLowerCase();
  if (KEYLESS_FREE_DISABLED.has(flag)) return [];
  const requested = KEYLESS_FREE_ALIASES.has(flag)
    ? DEFAULT_KEYLESS_FREE_ORDER
    : flag
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  const configs: KeylessFreeProviderConfig[] = [];
  const seen = new Set<string>();
  for (const name of requested) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (name === 'pollinations') {
      const key = env.KEYLESS_FREE_PROVIDER_KEY?.trim();
      const requestedQuota = Number(env.KEYLESS_FREE_QUOTA_COOLDOWN_MS ?? '');
      const quotaCooldownMs =
        Number.isFinite(requestedQuota) && requestedQuota >= 5_000
          ? Math.min(300_000, Math.trunc(requestedQuota))
          : 30_000;
      configs.push(
        Object.freeze({
          name: 'pollinations',
          endpoint: (
            env.KEYLESS_FREE_PROVIDER_URL?.trim() || DEFAULT_KEYLESS_FREE_ENDPOINT
          ).replace(/\/+$/, ''),
          model: env.KEYLESS_FREE_PROVIDER_MODEL?.trim() || DEFAULT_KEYLESS_FREE_MODEL,
          protocol: 'pollinations',
          quotaCooldownMs,
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        })
      );
    } else if (name === 'llm7') {
      const key = env.LLM7_API_KEY?.trim();
      configs.push(
        Object.freeze({
          name: 'llm7',
          endpoint: (env.LLM7_BASE_URL?.trim() || DEFAULT_LLM7_ENDPOINT).replace(/\/+$/, ''),
          model: env.LLM7_MODEL?.trim() || DEFAULT_LLM7_MODEL,
          protocol: 'openai',
          quotaCooldownMs: 2_000,
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        })
      );
    }
  }
  return configs;
}

/** First configured free provider; kept for readiness/description callers. */
export function resolveKeylessFreeProvider(
  env: Readonly<Record<string, string | undefined>>
): KeylessFreeProviderConfig | null {
  return resolveKeylessFreeProviders(env)[0] ?? null;
}

export type KeylessFreeFailureKind = 'quota' | 'auth' | 'request' | 'server' | 'network';

export interface KeylessFreeFailure {
  readonly kind: KeylessFreeFailureKind;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;
}

/** Parses Retry-After as delta-seconds or an HTTP-date; invalid input yields null. */
export function parseRetryAfterMs(
  value: string | null | undefined,
  nowMs: number = Date.now()
): number | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isFinite(seconds)
      ? Math.min(300_000, Math.max(0, Math.round(seconds * 1_000)))
      : null;
  }
  const date = Date.parse(raw);
  if (Number.isNaN(date)) return null;
  return Math.min(300_000, Math.max(0, date - nowMs));
}

/**
 * Maps a free-provider HTTP failure to a retry decision. Quota (402/429) and
 * auth failures are terminal for this request: retrying the same endpoint, even
 * with the plain-text contract, only burns the same window. Server/network
 * failures remain retryable.
 */
export function classifyKeylessFreeHttpFailure(
  status: number,
  retryAfterHeader?: string | null,
  nowMs: number = Date.now()
): KeylessFreeFailure {
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader, nowMs);
  if (status === 402 || status === 429) return { kind: 'quota', retryable: false, retryAfterMs };
  if (status === 401 || status === 403) return { kind: 'auth', retryable: false, retryAfterMs };
  if (status === 408) return { kind: 'network', retryable: true, retryAfterMs };
  if (status >= 500) return { kind: 'server', retryable: true, retryAfterMs };
  if (status >= 400) return { kind: 'request', retryable: false, retryAfterMs };
  return { kind: 'server', retryable: true, retryAfterMs };
}

/** Builds the bounded OpenAI-style message list forwarded to a keyless provider. */
export function buildKeylessFreeMessages(
  systemPrompt: string,
  input: string,
  history: readonly { readonly role: 'user' | 'assistant'; readonly content: string }[] = []
): readonly KeylessFreeMessage[] {
  return [
    { role: 'system', content: systemPrompt.trim().slice(0, 2_000) },
    ...history
      .slice(-8)
      .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2_000) })),
    { role: 'user', content: input.slice(0, 4_000) },
  ];
}

/** Normalizes plain-text output from a keyless provider; returns null when empty. */
export function extractKeylessFreeText(raw: string, maxLength = 8_000): string | null {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  return maxLength > 0 ? text.slice(0, maxLength) : text;
}
