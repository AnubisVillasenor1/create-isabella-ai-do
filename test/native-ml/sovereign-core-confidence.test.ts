// state: draft | engine-generated
import { describe, expect, it } from 'vitest';
import {
  predictRegression,
  trainDeterministicRegression,
  type RegressionModel,
} from '../../src/lib/native-ml/sovereign-core';

const approvedModel: RegressionModel = {
  weights: [2],
  bias: 1,
  artifactHash: 'test-artifact-hash',
  model: {
    modelId: 'test-regression',
    version: '1.0.0',
    territoryId: 'test-territory',
    ownerId: 'test-owner',
    task: 'regression',
    algorithm: 'deterministic-linear-sgd',
    datasetIds: ['test-dataset'],
    modelHash: 'test-model-hash',
    createdAt: '2026-10-23T00:00:00.000Z',
    approvalStatus: 'APPROVED',
  },
};

describe('native regression uncertainty contract', () => {
  it('never presents uncalibrated predictions as 100% confident', () => {
    const result = predictRegression(approvedModel, [[3]]);

    expect(result.predictions).toEqual([7]);
    expect(result.confidence).toBeNull();
    expect(result.explanation.confidenceStatus).toBe('uncalibrated');
    expect(result.requiresReview).toBe(true);
    expect(result.riskScore).toBe(1);
    expect(result.degraded).toBe(true);
  });

  it('rejects non-finite model parameters and predictions', () => {
    const invalidWeights = { ...approvedModel, weights: [Number.POSITIVE_INFINITY] };
    expect(() => predictRegression(invalidWeights, [[1]])).toThrow(/invalid_model_parameters/);
    expect(() => predictRegression(approvedModel, [[Number.MAX_VALUE]])).toThrow(
      /non_finite_regression_prediction/
    );
  });

  it('bounds training epochs and rejects overflowing training state', () => {
    const dataset = {
      dataset: {
        datasetId: 'test-dataset',
        version: '1',
        territoryId: 'test-territory',
        source: 'synthetic-test',
        license: 'test-only',
        schemaHash: 'schema-hash',
        contentHash: 'content-hash',
        createdAt: '2026-10-23T00:00:00.000Z',
      },
      features: [[1]],
      labels: [1],
    };
    expect(() => trainDeterministicRegression(dataset, 'test-owner', 'test-territory', 0)).toThrow(
      /invalid_regression_epochs/
    );
    expect(() =>
      trainDeterministicRegression(
        { ...dataset, features: [[Number.MAX_VALUE]], labels: [Number.MAX_VALUE] },
        'test-owner',
        'test-territory'
      )
    ).toThrow(/non_finite_regression_training_state/);
  });
});
