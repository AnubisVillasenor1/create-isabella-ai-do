/**
 * Transforma artefactos del Hub (datasets, model cards) en *propuestas* de
 * conocimiento para Isabella. state: draft | engine-generated.
 *
 * Invariante: esto es una ADMISIÓN PROPUESTA, no verificada. Todo documento sale
 * con `status: "PENDING_REVIEW"` y provenance explícita. Material externo nunca
 * se etiqueta como aceptado o verdadero por el hecho de descargarse.
 */
import { sha256Hex } from "../lib/sha256";
import type { HfDatasetSummary, HfModelSummary } from "./client";

/** Tope de caracteres que se conservan de una model card al proponerla. */
export const HF_HUB_MAX_INGEST_CHARS = 20_000;

export interface HfKnowledgeDocument {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly source: string;
  readonly contentHash: string;
  readonly tags: readonly string[];
  readonly provenance: "huggingface-hub";
  readonly status: "PENDING_REVIEW";
  readonly truncated: boolean;
}

/** Elimina el front-matter YAML de una model card, conservando el cuerpo legible. */
export function stripYamlFrontmatter(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) return trimmed;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return trimmed;
  return trimmed.slice(end + 4).replace(/^\r?\n/, "");
}

function normalizeBody(text: string): { body: string; truncated: boolean } {
  const collapsed = stripYamlFrontmatter(text).replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (collapsed.length <= HF_HUB_MAX_INGEST_CHARS) return { body: collapsed, truncated: false };
  return { body: `${collapsed.slice(0, HF_HUB_MAX_INGEST_CHARS)}\n\n…[contenido truncado]`, truncated: true };
}

function toDocument(
  prefix: string,
  title: string,
  source: string,
  cardText: string,
  tags: readonly string[],
  fallback: string,
): HfKnowledgeDocument {
  const { body, truncated } = normalizeBody(cardText);
  const content = body || fallback;
  const contentHash = sha256Hex(content);
  return Object.freeze({
    id: `hf:${prefix}:${contentHash.slice(0, 24)}`,
    title,
    content,
    source,
    contentHash,
    tags: Object.freeze([...tags].slice(0, 24)),
    provenance: "huggingface-hub" as const,
    status: "PENDING_REVIEW" as const,
    truncated,
  });
}

export function datasetCardToKnowledge(dataset: HfDatasetSummary, readmeText: string): HfKnowledgeDocument {
  return toDocument(
    "dataset",
    `HF dataset · ${dataset.id}`,
    `https://huggingface.co/datasets/${dataset.id}`,
    readmeText,
    dataset.tags,
    `Dataset ${dataset.id} (sin model card de texto legible).`,
  );
}

export function modelCardToKnowledge(model: HfModelSummary, cardText: string): HfKnowledgeDocument {
  return toDocument(
    "model",
    `HF model · ${model.id} [${model.pipelineTag}]`,
    `https://huggingface.co/${model.id}`,
    cardText,
    model.tags,
    `Modelo ${model.id} (tarea: ${model.pipelineTag}; sin model card de texto legible).`,
  );
}
