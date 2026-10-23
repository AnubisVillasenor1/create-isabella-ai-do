import { jsonResponse } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Resource = {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  tags?: string[];
  lastModified?: string;
  cardData?: Record<string, unknown>;
  gated?: boolean | string;
  private?: boolean;
};

const TYPES = new Set(["models", "datasets", "spaces"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || "models").toLowerCase();
  const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const task = (url.searchParams.get("task") || "").trim().slice(0, 80);
  const sort = (url.searchParams.get("sort") || "downloads").toLowerCase();
  const allowedSorts = new Set(["downloads", "likes", "lastModified"]);
  const limit = Math.max(1, Math.min(30, Number.parseInt(url.searchParams.get("limit") || "12", 10) || 12));

  if (!TYPES.has(type)) return jsonResponse({ error: "unsupported_resource_type", allowed: [...TYPES] }, 400);
  if (!allowedSorts.has(sort)) return jsonResponse({ error: "unsupported_sort", allowed: [...allowedSorts] }, 400);

  const endpoint = type === "models" ? "models" : type;
  const params = new URLSearchParams({ limit: String(limit), sort, direction: "-1" });
  if (query) params.set("search", query);
  if (task && type === "models") params.set("pipeline_tag", task);
  if (type === "models") params.set("inference_provider", "all");

  try {
    const headers: HeadersInit = { Accept: "application/json" };
    if (process.env.HF_TOKEN) headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;
    const response = await fetch(`https://huggingface.co/api/${endpoint}?${params.toString()}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return jsonResponse({
        error: "huggingface_catalog_unavailable",
        upstreamStatus: response.status,
        retryable: response.status === 429 || response.status >= 500,
      }, response.status === 429 ? 429 : 502);
    }

    const payload = await response.json() as Resource[];
    const resources = (Array.isArray(payload) ? payload : []).map((item) => ({
      id: item.id,
      author: item.author,
      downloads: item.downloads ?? 0,
      likes: item.likes ?? 0,
      task: item.pipeline_tag ?? null,
      tags: (item.tags ?? []).slice(0, 12),
      lastModified: item.lastModified ?? null,
      gated: item.gated ?? false,
      private: item.private ?? false,
      url: `https://huggingface.co/${type === "models" ? "" : type + "/"}${item.id}`,
    }));
    return jsonResponse({
      provider: "Hugging Face Hub",
      type,
      query: query || null,
      task: task || null,
      count: resources.length,
      resources,
      fetchedAt: new Date().toISOString(),
      notice: type === "models"
        ? "El catálogo y los pesos abiertos no garantizan inferencia gratuita. Verifica licencia, proveedor, disponibilidad, límites y coste de cada modelo."
        : "Verifica licencia, privacidad, calidad y condiciones de uso antes de incorporar el recurso.",
    });
  } catch {
    return jsonResponse({ error: "huggingface_hub_unreachable", retryable: true }, 502);
  }
}
