// state: draft | engine-generated
//
// Unified model dossier. Data cards and model cards exist but are produced in
// isolation, so no single artifact ties a model to its dataset, held-out
// metrics, fairness snapshot, feature contract and provenance anchor. This
// bundles them into one hashed document suitable for a human review packet.
// It is documentation of evidence, not a certification: the dossier cannot make
// a model approved, and its hash only attests to the bundle's integrity.

import { createHash } from 'node:crypto';
import type { DataCard, ModelCard } from './sovereign-core';
import type { BinaryMetrics, RegressionMetrics } from './metrics';

export type MetricSnapshot =
  | { kind: 'classification'; metrics: BinaryMetrics; auc: number }
  | { kind: 'regression'; metrics: RegressionMetrics }
  | { kind: 'other'; metrics: Record<string, number> };

export interface FairnessSnapshot {
  demographicParityDifference: number;
  impactRatio: number;
  ece?: number;
}

export interface DriftSnapshot {
  ksStatistic?: number;
  psi?: number;
  note: string;
}

export interface ModelDossier {
  modelCard: ModelCard;
  dataCards: DataCard[];
  evaluation: MetricSnapshot;
  fairness: FairnessSnapshot | null;
  drift: DriftSnapshot | null;
  featureContractHash: string | null;
  provenanceAnchor: string | null;
  governanceState: 'draft | engine-generated';
  compiledAt: string;
  dossierHash: string;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export interface BuildDossierInput {
  modelCard: ModelCard;
  dataCards?: DataCard[];
  evaluation: MetricSnapshot;
  fairness?: FairnessSnapshot;
  drift?: DriftSnapshot;
  featureContractHash?: string | null;
  provenanceAnchor?: string | null;
  clock?: () => string;
}

/** Assemble and hash a dossier; validates internal consistency of the bundle. */
export function buildModelDossier(input: BuildDossierInput): ModelDossier {
  if (!input.modelCard?.model?.modelId) throw new Error('dossier_requires_model_card');
  const evaluation = input.evaluation;
  if (evaluation.kind === 'classification') {
    if (!(evaluation.auc >= 0 && evaluation.auc <= 1)) throw new Error('auc_out_of_range');
  }
  const compiledAt = (input.clock ?? (() => new Date().toISOString()))();
  const body = {
    modelCard: input.modelCard,
    dataCards: input.dataCards ?? [],
    evaluation,
    fairness: input.fairness ?? null,
    drift: input.drift ?? null,
    featureContractHash: input.featureContractHash ?? null,
    provenanceAnchor: input.provenanceAnchor ?? null,
    governanceState: 'draft | engine-generated' as const,
    compiledAt,
  };
  return { ...body, dossierHash: sha256(body) };
}

/** Verify a dossier's hash still matches its contents (tamper check). */
export function verifyDossier(dossier: ModelDossier): boolean {
  const { dossierHash: _ignored, ...rest } = dossier;
  void _ignored;
  return sha256(rest) === dossier.dossierHash;
}
