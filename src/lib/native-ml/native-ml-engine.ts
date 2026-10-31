// state: draft | engine-generated
//
// Governed orchestration facade. The individual learners, metrics, calibration,
// registry and provenance pieces existed as isolated primitives; nothing tied
// them into one honest training run. This composes them: scale → stratified
// split → incremental logistic training → held-out metrics → Platt calibration
// → registry entry → provenance event → dossier. It adds no HTTP surface and
// moves no value. The output is `PENDING_REVIEW` by construction: a green
// pipeline proves capability, never authority or production (AGENTS.md §1).

import { createHash } from 'node:crypto';
import type { ModelArtifact, ModelIdentity, NativeMLHooks } from './types';
import { fitStandardScaler } from './preprocessing';
import { stratifiedSplit } from './evaluation';
import { createOnlineClassifier, partialFit, predictOnline, onlineArtifact } from './online';
import { binaryClassificationMetrics, rocAuc, type BinaryMetrics } from './metrics';
import { fitPlattScaling, type PlattCalibrator } from './calibration';
import { ModelRegistry } from './registry';
import { MlProvenanceLedger } from './provenance';
import { buildModelDossier, type ModelDossier } from './cards';
import { permutationImportance } from './explain';

export interface BinaryTrainingInput {
  features: readonly (readonly number[])[];
  labels: readonly number[];
  datasetId: string;
  ownerId: string;
  territoryId: string;
  epochs?: number;
}

export interface GovernedTrainingOutcome {
  model: ModelIdentity;
  artifact: ModelArtifact;
  heldOut: BinaryMetrics;
  auc: number;
  calibrator: { a: number; b: number };
  featureImportance: number[];
  dossier: ModelDossier;
  approvalRequired: true;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class NativeMlOrchestrator {
  readonly registry = new ModelRegistry();
  readonly ledger = new MlProvenanceLedger();

  constructor(private readonly hooks: NativeMLHooks = {}) {}

  async trainBinary(input: BinaryTrainingInput): Promise<GovernedTrainingOutcome> {
    const { features, labels } = input;
    if (features.length === 0 || features.length !== labels.length)
      throw new Error('invalid_dataset_cardinality');
    const width = features[0]!.length;
    if (
      width === 0 ||
      features.some((r) => r.length !== width || r.some((v) => !Number.isFinite(v)))
    )
      throw new Error('invalid_feature_matrix');
    if (labels.some((l) => l !== 0 && l !== 1)) throw new Error('binary_labels_required');

    const modelId = `native-orch-${hash({ datasetId: input.datasetId, ownerId: input.ownerId, width }).slice(0, 16)}`;
    const decision = await this.hooks.authorize?.({
      action: 'native_ml.orchestrated_train',
      territoryId: input.territoryId,
      modelId,
    });
    if (decision && decision.decision !== 'ALLOW')
      throw new Error(`native_ml_${decision.decision.toLowerCase()}`);

    // Scale on the full matrix (documented, deterministic) for stable SGD.
    const scaler = fitStandardScaler(features);
    const scaled = features.map((r) => scaler.transform(r));

    const { train, test } = stratifiedSplit(
      scaled.map((row, i) => ({ row, label: labels[i]! })),
      labels,
      0.3,
      hash({ datasetId: input.datasetId }).charCodeAt(0)
    );
    if (train.length < 2 || test.length < 2) throw new Error('insufficient_split_samples');

    const state = createOnlineClassifier(width);
    const epochs = Math.max(1, Math.min(input.epochs ?? 20, 200));
    for (let e = 0; e < epochs; e++)
      for (const { row, label } of train) partialFit(state, row, label, { learningRate: 0.1 });

    const testRows = test.map((t) => t.row);
    const testLabels = test.map((t) => t.label);
    const preds = testRows.map((r) => predictOnline(state, r).label);
    const scores = testRows.map((r) => predictOnline(state, r).probability);
    const heldOut = binaryClassificationMetrics(testLabels, preds);
    let auc = 0.5;
    try {
      auc = rocAuc(testLabels, scores);
    } catch {
      auc = 0.5; // single-class held-out fold: AUC undefined, report neutral honestly
    }
    const calibrator = fitPlattScaling(scores, testLabels);

    const snapshot = onlineArtifact(state);
    const artifact: ModelArtifact = {
      weights: snapshot.weights,
      bias: snapshot.bias,
      artifactHash: snapshot.artifactHash,
    };
    const model: ModelIdentity = {
      modelId,
      version: '0.1.0',
      territoryId: input.territoryId,
      ownerId: input.ownerId,
      task: 'classification',
      algorithm: 'native-orchestrated-logistic-sgd',
      datasetIds: [input.datasetId],
      modelHash: artifact.artifactHash,
      createdAt: new Date().toISOString(),
      approvalStatus: 'PENDING_REVIEW',
    };

    const featureImportance = permutationImportance(
      (rows) => rows.map((r) => predictOnline(state, r).label),
      testRows,
      testLabels,
      (p, t) => binaryClassificationMetrics(t, p as number[]).accuracy
    );

    this.registry.register(model, artifact, input.ownerId, null);
    const event = this.ledger.record({
      type: 'training',
      subjectId: modelId,
      actor: input.ownerId,
      metadata: { heldOut, auc, epochs, width },
    });

    const dossier = buildModelDossier({
      modelCard: {
        model,
        capabilities: ['classification', 'explainability'],
        limitations: ['requiere aprobación humana', 'no sustituye políticas CROWN'],
        evaluation: { accuracy: heldOut.accuracy, f1: heldOut.f1, auc },
        fallback: true,
        createdAt: model.createdAt,
      },
      evaluation: { kind: 'classification', metrics: heldOut, auc },
      featureContractHash: hash({ width }),
      provenanceAnchor: event.hash,
    });

    await this.hooks.audit?.('native_ml.orchestrated_training_completed', {
      modelId,
      dossierHash: dossier.dossierHash,
      provenanceSeq: event.seq,
    });

    return {
      model,
      artifact,
      heldOut,
      auc,
      calibrator: { a: calibrator.a, b: calibrator.b },
      featureImportance,
      dossier,
      approvalRequired: true,
    };
  }

  /** Calibrated prediction on one raw (unscaled) row using a prior scaler. */
  static calibratedProbability(calibrator: PlattCalibrator, rawScore: number): number {
    return calibrator.calibrate(rawScore);
  }
}
