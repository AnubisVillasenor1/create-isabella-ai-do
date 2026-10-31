// state: draft | engine-generated
import { describe, expect, it } from 'vitest';
import { mulberry32, hashSeed, isReproducible, permutation } from '../../src/lib/native-ml/prng';
import {
  fitStandardScaler,
  fitMinMaxScaler,
  fitLabelEncoder,
  imputeMissing,
} from '../../src/lib/native-ml/preprocessing';
import {
  binaryClassificationMetrics,
  rocAuc,
  regressionMetrics,
  silhouetteScore,
  topKAccuracy,
} from '../../src/lib/native-ml/metrics';
import { stratifiedSplit, crossValidate, bootstrapMeanCI } from '../../src/lib/native-ml/evaluation';
import { trainSoftmax, predictSoftmax } from '../../src/lib/native-ml/multiclass';
import { trainDecisionTree, predictTree, trainRandomForest, predictForest } from '../../src/lib/native-ml/tree';
import { fitPlattScaling, fitTemperatureScaling, expectedCalibrationError } from '../../src/lib/native-ml/calibration';
import { linearAttribution, permutationImportance } from '../../src/lib/native-ml/explain';
import { ksTwoSample, populationStabilityIndex, jensenShannon } from '../../src/lib/native-ml/drift';
import { trainIsolationForest, isolationScore, robustMadtected } from '../../src/lib/native-ml/anomaly-forest';
import { fitHolt, holtForecast, fitSes } from '../../src/lib/native-ml/timeseries';
import { buildTfidfIndex, rankQuery } from '../../src/lib/native-ml/ranking';
import { createOnlineClassifier, partialFit, predictOnline, meanOnlineLoss } from '../../src/lib/native-ml/online';
import { demographicParity, equalizedOdds, calibrationByGroup } from '../../src/lib/native-ml/fairness';
import { defineContract, coerceNumericRow, validateRow } from '../../src/lib/native-ml/feature-contract';
import { serialize, deserialize, verifyEnvelope } from '../../src/lib/native-ml/serde';
import { buildModelDossier, verifyDossier } from '../../src/lib/native-ml/cards';

describe('prng determinism', () => {
  it('is reproducible for the same seed', () => {
    expect(mulberry32(hashSeed('alpha'))()).toBe(mulberry32(hashSeed('alpha'))());
    expect(isReproducible((s) => JSON.stringify(permutation(6, mulberry32(9))), () =>
      permutation(6, mulberry32(9))
    )).toBe(true);
  });
});

describe('preprocessing', () => {
  it('standard scaler round-trips', () => {
    const rows = [[1, 10], [2, 20], [3, 30], [4, 40]];
    const sc = fitStandardScaler(rows);
    const t = sc.transform([3, 30]);
    expect(sc.inverse(t)[0]).toBeCloseTo(3);
    expect(sc.inverse(t)[1]).toBeCloseTo(30);
  });
  it('min-max maps to [0,1]', () => {
    const sc = fitMinMaxScaler([[0], [5], [10]]);
    expect(sc.transform([0])[0]).toBeCloseTo(0);
    expect(sc.transform([10])[0]).toBeCloseTo(1);
  });
  it('label encoder round-trips', () => {
    const enc = fitLabelEncoder(['b', 'a', 'c', 'a']);
    expect(enc.classes).toEqual(['a', 'b', 'c']);
    expect(enc.decode(enc.encode('c'))).toBe('c');
    expect(() => enc.encode('z')).toThrow(/unknown_label_class/);
  });
  it('imputes non-finite with column mean', () => {
    const out = imputeMissing([[1], [Number.NaN], [3]]);
    expect(out[1]![0]).toBeCloseTo(2);
  });
});

describe('metrics', () => {
  it('binary confusion-derived scores', () => {
    const m = binaryClassificationMetrics([1, 1, 0, 0], [1, 0, 0, 0]);
    expect(m.truePositive).toBe(1);
    expect(m.falseNegative).toBe(1);
    expect(m.accuracy).toBeCloseTo(0.75);
  });
  it('rocAuc is 1 for perfectly separable scores', () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9])).toBeCloseTo(1);
  });
  it('regression r2', () => {
    const r = regressionMetrics([1, 2, 3], [1, 2, 3]);
    expect(r.r2).toBeCloseTo(1);
    expect(r.mae).toBeCloseTo(0);
  });
  it('silhouette positive for separated clusters', () => {
    const rows = [[0], [0.1], [10], [10.1]];
    expect(silhouetteScore(rows, [0, 0, 1, 1])).toBeGreaterThan(0.5);
  });
  it('topK accuracy', () => {
    expect(topKAccuracy([['a', 'b']], [['x', 'a', 'y']], 2)).toBe(1);
    expect(topKAccuracy([['a']], [['x', 'y', 'a']], 2)).toBe(0);
  });
});

describe('evaluation', () => {
  it('stratified split is deterministic and class-preserving', () => {
    const labels = [0, 0, 0, 0, 1, 1, 1, 1];
    const items = labels.map((l, i) => i);
    const a = stratifiedSplit(items, labels, 0.5, 42);
    const b = stratifiedSplit(items, labels, 0.5, 42);
    expect(a.train).toEqual(b.train);
    expect(a.train.length + a.test.length).toBe(8);
  });
  it('crossValidate returns k scores', () => {
    const cv = crossValidate(20, 4, (train) => train.length / 20);
    expect(cv.scores).toHaveLength(4);
    expect(cv.mean).toBeGreaterThan(0);
  });
  it('bootstrap CI brackets the mean', () => {
    const values = Array.from({ length: 40 }, (_, i) => i + 1);
    const ci = bootstrapMeanCI(values, { samples: 200, seed: 3 });
    expect(ci.lower).toBeLessThanOrEqual(ci.mean);
    expect(ci.upper).toBeGreaterThanOrEqual(ci.mean);
  });
});

describe('multiclass softmax', () => {
  it('learns separable 3-class data', () => {
    const features = [
      [1, 0, 0], [0.9, 0.1, 0], [0, 1, 0], [0.1, 0.9, 0], [0, 0, 1], [0, 0.1, 0.9],
    ];
    const labels = [0, 0, 1, 1, 2, 2];
    const model = trainSoftmax(features, labels, 3, { epochs: 200, learningRate: 0.5 });
    expect(predictSoftmax(model, [1, 0, 0]).label).toBe(0);
    expect(predictSoftmax(model, [0, 1, 0]).label).toBe(1);
    expect(predictSoftmax(model, [0, 0, 1]).label).toBe(2);
  });
});

describe('tree + forest', () => {
  it('decision tree fits separable data', () => {
    const features = [[0], [0.2], [0.4], [0.6], [0.8], [1]];
    const labels = [0, 0, 0, 1, 1, 1];
    const tree = trainDecisionTree(features, labels, { maxDepth: 4, featureSubset: 1 });
    expect(predictTree(tree, [0.1])).toBe(0);
    expect(predictTree(tree, [0.9])).toBe(1);
  });
  it('random forest predicts a class', () => {
    const features = [[0, 0], [0, 1], [1, 0], [1, 1], [0.1, 0.1], [0.9, 0.9]];
    const labels = [0, 0, 1, 1, 0, 1];
    const forest = trainRandomForest(features, labels, { trees: 5, maxDepth: 3 }, 1);
    const p = predictForest(forest, [0.95, 0.95]);
    expect([0, 1]).toContain(p.label);
  });
});

describe('calibration', () => {
  it('Platt scaling keeps order and lands in (0,1)', () => {
    const scores = [-2, -1, 1, 2];
    const labels = [0, 0, 1, 1];
    const c = fitPlattScaling(scores, labels);
    const low = c.calibrate(-2);
    const high = c.calibrate(2);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(1);
    expect(low).toBeGreaterThan(0);
  });
  it('temperature scaling returns normalized probs', () => {
    const logits = [[2, 0], [0, 2], [1, 1]];
    const t = fitTemperatureScaling(logits, [0, 1, 0]);
    const probs = t.calibrate([2, 0]);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it('ECE is low for well-calibrated predictions', () => {
    const probs = [0.9, 0.9, 0.1, 0.1];
    const labels = [1, 1, 0, 0];
    expect(expectedCalibrationError(probs, labels)).toBeLessThan(0.2);
  });
});

describe('explain', () => {
  it('linear attribution sums to score', () => {
    const { contributions, score } = linearAttribution([2, -1], 1, [3, 4]);
    expect(score).toBeCloseTo(2 * 3 - 1 * 4 + 1);
    expect(contributions[0]!.contribution).toBeCloseTo(6);
  });
  it('permutation importance flags the relevant feature', () => {
    const features = [[1, 0], [0, 1], [1, 1], [0, 0]];
    const labels = [1, 0, 1, 0];
    const predict = (rows: readonly (readonly number[])[]) => rows.map((r) => r[0]! > 0.5 ? 1 : 0);
    const score = (p: readonly number[], t: readonly number[]) =>
      p.filter((x, i) => x === t[i]).length / p.length;
    const imp = permutationImportance(predict, features, labels, score, 1);
    expect(imp[0]!).toBeGreaterThanOrEqual(imp[1]!);
  });
});

describe('drift', () => {
  it('KS detects a shifted distribution', () => {
    const base = Array.from({ length: 60 }, (_, i) => (i % 10) / 10);
    const shifted = base.map((v) => v + 0.5);
    expect(ksTwoSample(base, shifted).drifted).toBe(true);
  });
  it('KS on identical samples does not drift', () => {
    const s = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    expect(ksTwoSample(s, s.slice()).drifted).toBe(false);
  });
  it('PSI level + JS divergence bounds', () => {
    const ref = Array.from({ length: 100 }, (_, i) => i / 100);
    expect(populationStabilityIndex(ref, ref.map((v) => v)).level).toBe('stable');
    expect(jensenShannon([0.5, 0.5], [0.5, 0.5])).toBeCloseTo(0);
    expect(jensenShannon([1, 0], [0, 1])).toBeCloseTo(1);
  });
});

describe('anomaly detection', () => {
  it('isolation forest scores an outlier higher', () => {
    const data = Array.from({ length: 40 }, (_, i) => [(i % 5) / 5, (i % 3) / 3]);
    const model = trainIsolationForest(data, { trees: 40, sampleSize: 40 }, 7);
    const normal = isolationScore(model, [0.2, 0.33]);
    const outlier = isolationScore(model, [50, 50]);
    expect(outlier).toBeGreaterThan(normal);
  });
  it('robust MAD flags the extreme value', () => {
    const res = robustMadtected([1, 1, 1, 1, 1, 1, 100]);
    expect(res[6]!.isAnomaly).toBe(true);
    expect(res[0]!.isAnomaly).toBe(false);
  });
});

describe('timeseries', () => {
  it('Holt extrapolates a rising trend', () => {
    const series = [1, 2, 3, 4, 5, 6, 7];
    const model = fitHolt(series, 0.5, 0.5);
    const fc = holtForecast(model, 3);
    expect(fc[2]!).toBeGreaterThan(series[series.length - 1]!);
  });
  it('SES level stays within data range', () => {
    const s = fitSes([2, 4, 6, 8]);
    expect(s.level).toBeGreaterThanOrEqual(2);
    expect(s.level).toBeLessThanOrEqual(8);
  });
});

describe('ranking', () => {
  it('TF-IDF ranks the matching document first', () => {
    const index = buildTfidfIndex([
      { id: 'd1', text: 'quantum entanglement qubits coherence' },
      { id: 'd2', text: 'baking bread flour yeast oven' },
    ]);
    const ranked = rankQuery(index, 'quantum qubits coherence', 2);
    expect(ranked[0]!.id).toBe('d1');
  });
});

describe('online learning', () => {
  it('partialFit reduces loss and learns the label', () => {
    const state = createOnlineClassifier(1);
    let firstLoss = 0;
    for (let i = 0; i < 60; i++) {
      const label = i % 2;
      partialFit(state, [label === 1 ? 1 : -1], label, { learningRate: 0.3 });
      if (i === 0) firstLoss = meanOnlineLoss(state);
    }
    expect(meanOnlineLoss(state)).toBeLessThan(firstLoss);
    expect(predictOnline(state, [1]).label).toBe(1);
    expect(predictOnline(state, [-1]).label).toBe(0);
  });
});

describe('fairness', () => {
  const samples = [
    { label: 1 as const, prediction: 1 as const, score: 0.9, group: 'A' },
    { label: 1 as const, prediction: 1 as const, score: 0.8, group: 'A' },
    { label: 0 as const, prediction: 0 as const, score: 0.2, group: 'B' },
    { label: 0 as const, prediction: 1 as const, score: 0.6, group: 'B' },
  ];
  it('reports parity, odds and calibration', () => {
    expect(demographicParity(samples).perGroup.A).toBeCloseTo(1);
    expect(demographicParity(samples).perGroup.B).toBeCloseTo(0.5);
    const odds = equalizedOdds(samples);
    expect(odds.partial).toBe(true); // group A has no negatives
    const cal = calibrationByGroup(samples);
    expect(cal.find((r) => r.group === 'A')!.observedRate).toBe(1);
  });
});

describe('feature contract', () => {
  const contract = defineContract([
    { name: 'x', type: 'bounded', min: 0, max: 1 },
    { name: 'y', type: 'number' },
  ]);
  it('coerces valid rows and rejects invalid', () => {
    expect(coerceNumericRow(contract, [0.5, 3])).toEqual([0.5, 3]);
    expect(() => coerceNumericRow(contract, [2, 3])).toThrow(/out_of_bounds/);
    expect(validateRow(contract, [0.5]).length).toBe(1); // arity mismatch
  });
});

describe('serde', () => {
  it('round-trips and detects tampering', () => {
    const env = serialize({ b: 1, a: [2, 3] });
    expect(verifyEnvelope(env)).toBe(true);
    expect(deserialize<{ a: number[] }>(JSON.stringify(env)).a).toEqual([2, 3]);
    const tampered = { ...env, payload: { b: 999, a: [2, 3] } };
    expect(verifyEnvelope(tampered)).toBe(false);
  });
});

describe('cards dossier', () => {
  it('bundles and verifies integrity', () => {
    const model = {
      modelId: 'm1', version: '0.1.0', territoryId: 't', ownerId: 'o', task: 'classification' as const,
      algorithm: 'a', datasetIds: ['d'], modelHash: 'h', createdAt: '2026-01-01T00:00:00.000Z',
      approvalStatus: 'PENDING_REVIEW' as const,
    };
    const dossier = buildModelDossier({
      modelCard: { model, capabilities: ['classification'], limitations: [], evaluation: {}, fallback: true, createdAt: model.createdAt },
      evaluation: { kind: 'classification', metrics: binaryClassificationMetrics([1, 0], [1, 0]), auc: 0.9 },
    });
    expect(verifyDossier(dossier)).toBe(true);
    expect(dossier.governanceState).toBe('draft | engine-generated');
  });
});
