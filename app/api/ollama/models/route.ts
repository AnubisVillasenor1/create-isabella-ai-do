import { jsonResponse } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OllamaModel = { name: string; size?: number; modified_at?: string; details?: { parameter_size?: string; quantization_level?: string; family?: string } };

export async function GET() {
  const configuredBase = process.env.OLLAMA_BASE_URL?.trim();
  const baseUrl = configuredBase || (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:11434" : "");
  if (!baseUrl) {
    return jsonResponse({
      provider: "ollama",
      configured: false,
      models: [],
      message: "Configura OLLAMA_BASE_URL en el servidor. En producción, localhost no apunta al equipo del usuario.",
    }, 503);
  }

  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl);
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") throw new Error("invalid_protocol");
    endpoint.pathname = "/api/tags";
    endpoint.search = "";
  } catch {
    return jsonResponse({ error: "invalid_ollama_base_url" }, 500);
  }

  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return jsonResponse({ error: "ollama_catalog_unavailable", upstreamStatus: response.status }, 502);
    const data = await response.json() as { models?: OllamaModel[] };
    const models = (Array.isArray(data.models) ? data.models : []).slice(0, 100).map((model) => ({
      name: model.name,
      sizeBytes: model.size ?? null,
      modifiedAt: model.modified_at ?? null,
      parameters: model.details?.parameter_size ?? null,
      quantization: model.details?.quantization_level ?? null,
      family: model.details?.family ?? null,
    }));
    return jsonResponse({ provider: "ollama", configured: true, count: models.length, models });
  } catch {
    return jsonResponse({
      error: "ollama_unreachable",
      message: "No se pudo acceder a Ollama desde el servidor. Verifica OLLAMA_BASE_URL, red y servicio activo.",
      retryable: true,
    }, 502);
  }
}
