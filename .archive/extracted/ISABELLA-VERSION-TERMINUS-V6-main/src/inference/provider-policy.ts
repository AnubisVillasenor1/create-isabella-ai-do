/**
 * Shared policy helpers for external inference adapters.
 * These helpers make provider routing constraints deterministic and unit-testable.
 */

export function boundedMilliseconds(
  rawValue: string | number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (![fallback, minimum, maximum].every(Number.isFinite) || minimum <= 0 || maximum < minimum) {
    throw new RangeError("invalid millisecond bounds");
  }
  const parsed = rawValue === undefined || rawValue === "" ? Number.NaN : Number(rawValue);
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
  return model === "openrouter/free" || model.endsWith(":free");
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
  env: Readonly<Record<string, string | undefined>>,
): readonly OpenAICompatibleCandidate[] {
  if (env.ALLOW_PAID_PROVIDER_FALLBACK !== "true") return Object.freeze([]);
  const ollamaBase = (env.OLLAMA_BASE_URL?.trim() || "https://ollama.com/v1").replace(/\/+$/, "");
  const specs: readonly CandidateSpec[] = [
    { name: "ollama", key: env.OLLAMA_API_KEY, url: `${ollamaBase}/chat/completions`, model: env.OLLAMA_MODEL?.trim() },
    { name: "groq", key: env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: env.GROQ_MODEL?.trim() },
    { name: "cerebras", key: env.CEREBRAS_API_KEY, url: "https://api.cerebras.ai/v1/chat/completions", model: env.CEREBRAS_MODEL?.trim() },
    { name: "together", key: env.TOGETHER_API_KEY, url: "https://api.together.xyz/v1/chat/completions", model: env.TOGETHER_MODEL?.trim() },
    { name: "deepinfra", key: env.DEEPINFRA_API_KEY, url: "https://api.deepinfra.com/v1/openai/chat/completions", model: env.DEEPINFRA_MODEL?.trim() },
    { name: "fireworks", key: env.FIREWORKS_API_KEY, url: "https://api.fireworks.ai/inference/v1/chat/completions", model: env.FIREWORKS_MODEL?.trim() },
  ];
  const candidates: OpenAICompatibleCandidate[] = [];
  for (const spec of specs) {
    const key = spec.key?.trim();
    const model = spec.model?.trim();
    if (key && model) candidates.push(Object.freeze({ name: spec.name, key, url: spec.url, model }));
  }
  return Object.freeze(candidates);
}

type AssistantContentPart = { type?: unknown; text?: unknown };
type OpenAICompatibleResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

/** Extract only textual assistant content from common OpenAI-compatible response shapes. */
export function extractAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as OpenAICompatibleResponse;
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    const text = content.trim();
    return text.length > 0 ? text : null;
  }
  if (!Array.isArray(content)) return null;
  const pieces = (content as AssistantContentPart[])
    .filter((part) => part && (part.type === "text" || part.type === "output_text") && typeof part.text === "string")
    .map((part) => (part.text as string).trim())
    .filter(Boolean);
  return pieces.length > 0 ? pieces.join("\n") : null;
}

export interface KeylessFreeProviderConfig {
  readonly name: "pollinations";
  readonly endpoint: string;
  readonly model: string;
}

export interface KeylessFreeMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

const KEYLESS_FREE_ENABLE_VALUES: ReadonlySet<string> = new Set(["on", "true", "1", "pollinations"]);
const DEFAULT_KEYLESS_FREE_ENDPOINT = "https://text.pollinations.ai";
const DEFAULT_KEYLESS_FREE_MODEL = "openai";

/**
 * Operator-gated keyless free text provider. This adapter emits REAL generative
 * text WITHOUT a credential so a node can converse before an operator configures a
 * keyed provider. It returns null unless explicitly enabled, so user content never
 * leaves the node by default. It is disclosed as an external engine and is never
 * presented as sovereign inference.
 */
export function resolveKeylessFreeProvider(
  env: Readonly<Record<string, string | undefined>>,
): KeylessFreeProviderConfig | null {
  const flag = (env.ISABELLA_KEYLESS_FREE_PROVIDER ?? "").trim().toLowerCase();
  if (!KEYLESS_FREE_ENABLE_VALUES.has(flag)) return null;
  const endpoint = (env.KEYLESS_FREE_PROVIDER_URL?.trim() || DEFAULT_KEYLESS_FREE_ENDPOINT).replace(/\/+$/, "");
  const model = env.KEYLESS_FREE_PROVIDER_MODEL?.trim() || DEFAULT_KEYLESS_FREE_MODEL;
  return Object.freeze({ name: "pollinations", endpoint, model });
}

/** Builds the bounded OpenAI-style message list forwarded to a keyless provider. */
export function buildKeylessFreeMessages(
  systemPrompt: string,
  input: string,
  history: readonly { readonly role: "user" | "assistant"; readonly content: string }[] = [],
): readonly KeylessFreeMessage[] {
  return [
    { role: "system", content: systemPrompt.trim().slice(0, 2_000) },
    ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2_000) })),
    { role: "user", content: input.slice(0, 4_000) },
  ];
}

/** Normalizes plain-text output from a keyless provider; returns null when empty. */
export function extractKeylessFreeText(raw: string, maxLength = 8_000): string | null {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return null;
  return maxLength > 0 ? text.slice(0, maxLength) : text;
}

