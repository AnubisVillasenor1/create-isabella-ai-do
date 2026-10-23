import { jsonResponse } from "@/lib/isabella/omega/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DatasetSplit = { config?: string; split?: string };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dataset = (url.searchParams.get("dataset") || "").trim();
  const requestedConfig = (url.searchParams.get("config") || "").trim().slice(0, 100);
  const requestedSplit = (url.searchParams.get("split") || "").trim().slice(0, 100);
  const rows = Math.max(1, Math.min(5, Number.parseInt(url.searchParams.get("rows") || "3", 10) || 3));

  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(dataset) || dataset.includes("..")) {
    return jsonResponse({ error: "invalid_dataset_id", message: "Usa el identificador owner/dataset de Hugging Face." }, 400);
  }

  const base = "https://datasets-server.huggingface.co";
  try {
    const splitsResponse = await fetch(`${base}/splits?dataset=${encodeURIComponent(dataset)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!splitsResponse.ok) {
      return jsonResponse({
        error: "dataset_splits_unavailable",
        upstreamStatus: splitsResponse.status,
        message: "El dataset puede ser privado, gated, no compatible con el viewer o estar temporalmente indisponible.",
      }, splitsResponse.status === 429 ? 429 : 502);
    }
    const splitsData = await splitsResponse.json() as { splits?: DatasetSplit[] };
    const available = Array.isArray(splitsData.splits) ? splitsData.splits : [];
    const selected = available.find((item) =>
      (!requestedConfig || item.config === requestedConfig) &&
      (!requestedSplit || item.split === requestedSplit)
    ) ?? available[0];

    if (!selected?.config || !selected.split) {
      return jsonResponse({ error: "dataset_has_no_previewable_splits", availableSplits: available.slice(0, 50) }, 422);
    }

    const params = new URLSearchParams({
      dataset,
      config: selected.config,
      split: selected.split,
      offset: "0",
      length: String(rows),
    });
    const sampleResponse = await fetch(`${base}/rows?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!sampleResponse.ok) {
      return jsonResponse({ error: "dataset_preview_unavailable", upstreamStatus: sampleResponse.status }, sampleResponse.status === 429 ? 429 : 502);
    }
    const sample = await sampleResponse.json() as { rows?: Array<{ row?: Record<string, unknown> }>; num_rows_total?: number; features?: unknown[] };
    const records = (sample.rows ?? []).map((item) => item.row ?? {});
    return jsonResponse({
      dataset,
      config: selected.config,
      split: selected.split,
      totalRows: sample.num_rows_total ?? null,
      sampleCount: records.length,
      features: sample.features ?? [],
      rows: records,
      source: "Hugging Face Datasets Viewer",
      notice: "Muestra de exploración. Comprueba licencia, privacidad, sesgos y procedencia antes de reutilizar los datos.",
    });
  } catch {
    return jsonResponse({ error: "dataset_preview_unreachable", retryable: true }, 502);
  }
}
