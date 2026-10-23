/**
 * Key-driven, fail-closed multimodal inference policy: image understanding
 * (vision) and image synthesis (text-to-image).
 *
 * Non-negotiable rules (AGENTS.md):
 * - Credentials, models and endpoints are NEVER invented. A provider becomes
 *   eligible only when its key (and model) are explicitly configured by the
 *   operator. With no eligible provider the caller fails closed.
 * - Local OpenAI-compatible servers (llama.cpp / vLLM / LM Studio) are treated
 *   as first-class candidates and win over remote providers when configured.
 * - A provider is "free" only in the sense that the operator selected it. This
 *   module never claims a remote route is free, and never enables a paid route
 *   on its own.
 *
 * The pure helpers below are unit-testable without network access.
 */

import { extractAssistantText } from "./provider-policy";

export const MULTIMODAL_CONTRACT_VERSION = "1.0.0" as const;

export type MultimodalKind = "vision" | "image";
export type MultimodalProtocol = "openai" | "gemini";

export interface MultimodalCandidate {
  readonly name: string;
  readonly kind: MultimodalKind;
  readonly protocol: MultimodalProtocol;
  /** Full request endpoint for OpenAI-compatible candidates, or the API root for Gemini. */
  readonly endpoint: string;
  readonly key: string;
  readonly model: string;
}

export interface MultimodalImage {
  readonly mimeType: string;
  readonly base64: string;
  readonly dataUrl: string;
}

export interface VisionAnalysis {
  readonly text: string;
  readonly provider: string;
}

export interface SynthesizedImage {
  readonly mimeType: string;
  readonly base64: string;
  readonly dataUrl: string;
  readonly provider: string;
}

export interface MultimodalReadiness {
  readonly vision: readonly string[];
  readonly image: readonly string[];
}

type Env = Readonly<Record<string, string | undefined>>;

const t = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const firstNonEmpty = (...values: readonly unknown[]): string => {
  for (const value of values) {
    const text = t(value);
    if (text) return text;
  }
  return "";
};

const baseUrl = (raw: unknown, fallback: string): string => (t(raw) || fallback).replace(/\/+$/, "");

const firstCsv = (raw: unknown): string => {
  const parts = t(raw)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] ?? "";
};

interface CandidateSpec {
  name: string;
  protocol: MultimodalProtocol;
  endpoint: string;
  key: unknown;
  model: unknown;
}

function resolveCandidates(specs: readonly CandidateSpec[], kind: MultimodalKind): readonly MultimodalCandidate[] {
  const candidates: MultimodalCandidate[] = [];
  for (const spec of specs) {
    const key = t(spec.key);
    const model = t(spec.model);
    const endpoint = t(spec.endpoint);
    if (!key || !model || !endpoint) continue;
    candidates.push(Object.freeze({ name: spec.name, kind, protocol: spec.protocol, endpoint, key, model }));
  }
  return Object.freeze(candidates);
}

const GEMINI_DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OPENROUTER_DEFAULT_BASE = "https://openrouter.ai/api/v1";

/**
 * Deterministic, credential-gated candidate list for image understanding, in
 * attempt order. Local engines win; then an explicitly configured free router;
 * then remote providers that the operator enabled with a key.
 */
export function buildVisionCandidates(env: Env): readonly MultimodalCandidate[] {
  const localBase = baseUrl(env.LOCAL_VISION_BASE_URL, "");
  const openrouterBase = baseUrl(env.OPENROUTER_BASE_URL, OPENROUTER_DEFAULT_BASE);
  const specs: readonly CandidateSpec[] = [
    { name: "local", protocol: "openai", endpoint: localBase ? `${localBase}/chat/completions` : "", key: firstNonEmpty(env.LOCAL_VISION_API_KEY, "local"), model: firstNonEmpty(env.LOCAL_VISION_MODEL, "qwen2.5-vl") },
    { name: "openrouter-free", protocol: "openai", endpoint: `${openrouterBase}/chat/completions`, key: env.OPENROUTER_API_KEY, model: firstNonEmpty(env.OPENROUTER_VISION_MODEL, "openrouter/free") },
    { name: "gemini", protocol: "gemini", endpoint: baseUrl(env.GEMINI_API_BASE, GEMINI_DEFAULT_BASE), key: firstNonEmpty(env.GEMINI_API_KEY, env.GOOGLE_API_KEY), model: firstNonEmpty(env.GEMINI_VISION_MODEL, "gemini-2.5-flash") },
    { name: "novita", protocol: "openai", endpoint: "https://api.novita.ai/v3/openai/chat/completions", key: env.NOVITA_API_KEY, model: firstNonEmpty(env.NOVITA_VISION_MODEL, "meta-llama/llama-3.2-11b-vision-instruct") },
    { name: "together", protocol: "openai", endpoint: "https://api.together.xyz/v1/chat/completions", key: env.TOGETHER_API_KEY, model: firstNonEmpty(env.TOGETHER_VISION_MODEL, "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo") },
    { name: "deepinfra", protocol: "openai", endpoint: "https://api.deepinfra.com/v1/openai/chat/completions", key: env.DEEPINFRA_API_KEY, model: firstNonEmpty(env.DEEPINFRA_VISION_MODEL, "meta-llama/Llama-3.2-11B-Vision-Instruct") },
    { name: "fireworks", protocol: "openai", endpoint: "https://api.fireworks.ai/inference/v1/chat/completions", key: env.FIREWORKS_API_KEY, model: firstNonEmpty(env.FIREWORKS_VISION_MODEL, "accounts/fireworks/models/llama-v3p2-11b-vision-instruct") },
    { name: "huggingface", protocol: "openai", endpoint: "https://router.huggingface.co/v1/chat/completions", key: env.HF_TOKEN, model: firstNonEmpty(env.HF_VISION_MODEL, firstCsv(env.HF_VISION_MODELS)) },
  ];
  return resolveCandidates(specs, "vision");
}

/** Deterministic, credential-gated candidate list for text-to-image synthesis. */
export function buildImageCandidates(env: Env): readonly MultimodalCandidate[] {
  const localBase = baseUrl(env.LOCAL_IMAGE_BASE_URL, "");
  const specs: readonly CandidateSpec[] = [
    { name: "local", protocol: "openai", endpoint: localBase ? `${localBase}/images/generations` : "", key: firstNonEmpty(env.LOCAL_IMAGE_API_KEY, "local"), model: firstNonEmpty(env.LOCAL_IMAGE_MODEL, "sd") },
    { name: "gemini", protocol: "gemini", endpoint: baseUrl(env.GEMINI_API_BASE, GEMINI_DEFAULT_BASE), key: firstNonEmpty(env.GEMINI_API_KEY, env.GOOGLE_API_KEY), model: firstNonEmpty(env.GEMINI_IMAGE_MODEL, "gemini-2.5-flash-image") },
    { name: "together", protocol: "openai", endpoint: "https://api.together.xyz/v1/images/generations", key: env.TOGETHER_API_KEY, model: firstNonEmpty(env.TOGETHER_IMAGE_MODEL, "black-forest-labs/FLUX.1-schnell-Free") },
    { name: "deepinfra", protocol: "openai", endpoint: "https://api.deepinfra.com/v1/openai/images/generations", key: env.DEEPINFRA_API_KEY, model: firstNonEmpty(env.DEEPINFRA_IMAGE_MODEL, "black-forest-labs/FLUX-1-schnell") },
    { name: "fireworks", protocol: "openai", endpoint: "https://api.fireworks.ai/inference/v1/images/generations", key: env.FIREWORKS_API_KEY, model: firstNonEmpty(env.FIREWORKS_IMAGE_MODEL, "accounts/fireworks/models/flux-1-schnell-fp8") },
    { name: "novita", protocol: "openai", endpoint: "https://api.novita.ai/v3/openai/images/generations", key: env.NOVITA_API_KEY, model: firstNonEmpty(env.NOVITA_IMAGE_MODEL, "sd_xl_base_1.0.safetensors") },
    { name: "huggingface", protocol: "openai", endpoint: "https://router.huggingface.co/v1/images/generations", key: env.HF_TOKEN, model: firstNonEmpty(env.HF_IMAGE_MODEL, firstCsv(env.HF_IMAGE_MODELS)) },
  ];
  return resolveCandidates(specs, "image");
}

export function describeMultimodalReadiness(env: Env): MultimodalReadiness {
  return Object.freeze({
    vision: Object.freeze(buildVisionCandidates(env).map((candidate) => candidate.name)),
    image: Object.freeze(buildImageCandidates(env).map((candidate) => candidate.name)),
  });
}

const IMAGE_DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Parse a strict image data URL. Anything else (including SVG/HTML) is rejected. */
export function parseImageDataUrl(input: unknown): MultimodalImage | null {
  if (typeof input !== "string") return null;
  const match = IMAGE_DATA_URL.exec(input.trim());
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  if (!mimeType || !base64) return null;
  return Object.freeze({ mimeType, base64, dataUrl: `data:${mimeType};base64,${base64}` });
}

export function buildOpenAIVisionBody(model: string, prompt: string, image: MultimodalImage): Record<string, unknown> {
  return {
    model,
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image.dataUrl } },
        ],
      },
    ],
  };
}

export function buildGeminiVisionBody(prompt: string, image: MultimodalImage): Record<string, unknown> {
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }],
      },
    ],
  };
}

export function buildOpenAIImageBody(model: string, prompt: string): Record<string, unknown> {
  return { model, prompt, n: 1, response_format: "b64_json" };
}

export function buildGeminiImageBody(prompt: string): Record<string, unknown> {
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
}

export function geminiGenerateEndpoint(candidate: MultimodalCandidate): string {
  return `${candidate.endpoint}/models/${encodeURIComponent(candidate.model)}:generateContent?key=${encodeURIComponent(candidate.key)}`;
}

type GeminiPart = { text?: unknown; inlineData?: { mimeType?: unknown; data?: unknown } };

function geminiParts(payload: unknown): readonly GeminiPart[] {
  if (!payload || typeof payload !== "object") return [];
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return [];
  const first = candidates[0] as { content?: { parts?: unknown } } | undefined;
  const parts = first?.content?.parts;
  return Array.isArray(parts) ? (parts as GeminiPart[]) : [];
}

export function extractGeminiText(payload: unknown): string | null {
  const pieces = geminiParts(payload)
    .map((part) => (typeof part.text === "string" ? part.text.trim() : ""))
    .filter(Boolean);
  return pieces.length > 0 ? pieces.join("\n") : null;
}

export function extractImageFromOpenAI(payload: unknown): { base64?: string; url?: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const first = data[0] as { b64_json?: unknown; url?: unknown } | undefined;
  if (!first) return null;
  const base64 = typeof first.b64_json === "string" && first.b64_json.trim() ? first.b64_json.trim() : undefined;
  const url = typeof first.url === "string" && first.url.trim() ? first.url.trim() : undefined;
  if (!base64 && !url) return null;
  return base64 ? { base64 } : { url };
}

export function extractImageFromGemini(payload: unknown): { mimeType: string; base64: string } | null {
  for (const part of geminiParts(payload)) {
    const inline = part.inlineData;
    if (!inline) continue;
    const data = typeof inline.data === "string" ? inline.data.trim() : "";
    if (!data) continue;
    const mimeType = typeof inline.mimeType === "string" && inline.mimeType.trim() ? inline.mimeType.trim() : "image/png";
    return { mimeType, base64: data };
  }
  return null;
}

interface JsonResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number): Promise<JsonResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function candidateRequest(candidate: MultimodalCandidate, body: Record<string, unknown>): { url: string; init: RequestInit } {
  if (candidate.protocol === "gemini") {
    return {
      url: geminiGenerateEndpoint(candidate),
      init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    };
  }
  return {
    url: candidate.endpoint,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${candidate.key}` },
      body: JSON.stringify(body),
    },
  };
}

/** Attempt vision analysis across candidates in order; return null when none succeed. */
export async function performVision(
  candidates: readonly MultimodalCandidate[],
  prompt: string,
  image: MultimodalImage,
  timeoutMs = 30_000,
): Promise<VisionAnalysis | null> {
  for (const candidate of candidates) {
    const body = candidate.protocol === "gemini" ? buildGeminiVisionBody(prompt, image) : buildOpenAIVisionBody(candidate.model, prompt, image);
    const { url, init } = candidateRequest(candidate, body);
    const result = await requestJson(url, init, timeoutMs);
    if (!result?.ok) continue;
    const text = candidate.protocol === "gemini" ? extractGeminiText(result.body) : extractAssistantText(result.body);
    if (text) return { text, provider: candidate.name };
  }
  return null;
}

/** Attempt image synthesis across candidates in order; return null when none succeed. */
export async function performImage(
  candidates: readonly MultimodalCandidate[],
  prompt: string,
  timeoutMs = 60_000,
): Promise<SynthesizedImage | null> {
  for (const candidate of candidates) {
    const body = candidate.protocol === "gemini" ? buildGeminiImageBody(prompt) : buildOpenAIImageBody(candidate.model, prompt);
    const { url, init } = candidateRequest(candidate, body);
    const result = await requestJson(url, init, timeoutMs);
    if (!result?.ok) continue;
    if (candidate.protocol === "gemini") {
      const image = extractImageFromGemini(result.body);
      if (image) {
        return { mimeType: image.mimeType, base64: image.base64, dataUrl: `data:${image.mimeType};base64,${image.base64}`, provider: candidate.name };
      }
      continue;
    }
    const image = extractImageFromOpenAI(result.body);
    if (image?.base64) {
      return { mimeType: "image/png", base64: image.base64, dataUrl: `data:image/png;base64,${image.base64}`, provider: candidate.name };
    }
    if (image?.url) {
      return { mimeType: "image/png", base64: "", dataUrl: image.url, provider: candidate.name };
    }
  }
  return null;
}
