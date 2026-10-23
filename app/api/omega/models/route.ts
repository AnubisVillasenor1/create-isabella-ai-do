import { jsonResponse } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GatewayModel = {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  created?: number;
  context_window?: number;
  max_tokens?: number;
  tags?: string[];
  modalities?: { input?: string[]; output?: string[] };
  pricing?: { input?: string; output?: string };
  zdr?: string;
  no_training?: string;
};

function gatewayAuthHeaders(): HeadersInit | null {
  const credential = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!credential) return null;
  return { Authorization: `Bearer ${credential}`, Accept: "application/json" };
}

export async function GET(request: Request) {
  const headers = gatewayAuthHeaders();
  if (!headers) {
    return jsonResponse({
      error: "gateway_auth_not_configured",
      message: "Configura AI_GATEWAY_API_KEY o usa el entorno Vercel con autenticación OIDC disponible.",
    }, 503);
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 100);
  const modality = (url.searchParams.get("modality") || "").trim().toLowerCase();
  const provider = (url.searchParams.get("provider") || "").trim().toLowerCase();
  const allowedModalities = new Set(["text", "image", "audio", "video", "embedding", "reranking", "transcription", "speech", "realtime"]);
  if (modality && !allowedModalities.has(modality)) {
    return jsonResponse({ error: "unsupported_modality_filter", allowed: [...allowedModalities] }, 400);
  }

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      const status = response.status === 401 ? 503 : response.status === 429 ? 429 : 502;
      return jsonResponse({
        error: "gateway_model_catalog_unavailable",
        upstreamStatus: response.status,
        retryable: response.status === 429 || response.status >= 500,
      }, status);
    }

    const payload = await response.json() as { data?: GatewayModel[] };
    const all = Array.isArray(payload.data) ? payload.data : [];
    const filtered = all.filter((model) => {
      const id = (model.id || "").toLowerCase();
      const name = (model.name || "").toLowerCase();
      const tags = (model.tags || []).map((tag) => tag.toLowerCase());
      const modalities = [...(model.modalities?.input || []), ...(model.modalities?.output || [])].map((item) => item.toLowerCase());
      return (!query || id.includes(query) || name.includes(query) || tags.some((tag) => tag.includes(query)))
        && (!provider || id.startsWith(`${provider}/`))
        && (!modality || modalities.includes(modality) || tags.includes(modality));
    }).map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      type: model.type,
      contextWindow: model.context_window,
      maxTokens: model.max_tokens,
      tags: model.tags || [],
      modalities: model.modalities || {},
      pricing: model.pricing || {},
      zeroDataRetention: model.zdr || "unknown",
      noTraining: model.no_training || "unknown",
    }));

    return jsonResponse({
      count: filtered.length,
      totalAvailable: all.length,
      filters: { q: query || null, provider: provider || null, modality: modality || null },
      models: filtered.slice(0, 250),
      truncated: filtered.length > 250,
      source: "Vercel AI Gateway /v1/models",
      fetchedAt: new Date().toISOString(),
    }, 200);
  } catch {
    return jsonResponse({ error: "gateway_model_catalog_unreachable", retryable: true }, 502);
  }
}
