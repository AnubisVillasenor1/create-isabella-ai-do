/**
 * Superficie de integración con el Hugging Face Hub para Isabella.
 * state: draft | engine-generated.
 *
 * Expone el catálogo de modelos/datasets (información) y la ingesta PROPUESTA de
 * una model card de dataset (datos). No usa el router de inferencia (de pago) ni
 * concede autoridad: los documentos salen como PENDING_REVIEW.
 * CAPABILITY ≠ AUTHORITY ≠ EVIDENCE.
 */
export * from './client';
export * from './catalog';
export * from './ingest';

import type { HfHubClient, HfDatasetQuery, HfModelQuery } from './client';
import { HF_HUB_DISCLAIMER } from './catalog';
import { datasetCardToKnowledge, type HfKnowledgeDocument } from './ingest';

export interface HfCatalogInput {
  readonly task?: string;
  readonly search?: string;
  readonly limit?: number;
}

export interface HfCatalogResult {
  readonly models: Awaited<ReturnType<HfHubClient['listModels']>>;
  readonly datasets: Awaited<ReturnType<HfHubClient['listDatasets']>>;
  readonly disclaimer: string;
}

/** Reúne modelos y datasets del Hub en una sola lectura de catálogo (paralela). */
export async function queryHfHubCatalog(
  client: HfHubClient,
  input: HfCatalogInput = {}
): Promise<HfCatalogResult> {
  const modelQuery: HfModelQuery = {
    ...(input.task?.trim() ? { task: input.task.trim() } : {}),
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
  };
  const datasetQuery: HfDatasetQuery = {
    ...(input.search?.trim() ? { search: input.search.trim() } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
  };
  const [models, datasets] = await Promise.all([
    client.listModels(modelQuery),
    client.listDatasets(datasetQuery),
  ]);
  return Object.freeze({ models, datasets, disclaimer: HF_HUB_DISCLAIMER });
}

export interface HfIngestInput {
  readonly datasetId: string;
  readonly revision?: string;
}

/** Lee la model card de un dataset y la propone como conocimiento PENDING_REVIEW. */
export async function ingestHfDataset(
  client: HfHubClient,
  input: HfIngestInput
): Promise<HfKnowledgeDocument> {
  const dataset = await client.getDataset(input.datasetId);
  const readme = await client.getFileText({
    repo: dataset.id,
    repoType: 'datasets',
    path: 'README.md',
    ...(input.revision ? { revision: input.revision } : {}),
  });
  return datasetCardToKnowledge(dataset, readme);
}
