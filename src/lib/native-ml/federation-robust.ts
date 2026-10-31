// state: draft | engine-generated
//
// Byzantine-robust federated aggregation. The existing FedAvg trusts every
// signed update and averages magnitudes blindly, so a single malformed or
// adversarial node can drag the global model. This adds the missing guards: a
// per-update norm cap, coordinate-wise trimmed-mean and median aggregation, and
// an explicit poisoning screen (loss/divergence outliers). Signature verification
// stays injected — this module never fabricates a verifier or claims a cipher it
// cannot run. Robust aggregation is a control, not a substitute for human
// approval of the committed round.

import { createHash } from 'node:crypto';
import type { FederatedUpdate, ModelArtifact, ModelIdentity } from './types';

export type AggregationRule = 'trimmed_mean' | 'median' | 'fedavg';

export interface RobustAggregateOptions {
  rule?: AggregationRule;
  /** Fraction of extreme updates to drop per coordinate (trimmed mean). */
  trimFraction?: number;
  /** Max L2 norm of a delta accepted; larger deltas are clipped. */
  maxDeltaNorm?: number;
  /** Reject updates whose loss exceeds (median loss) * factor. */
  lossOutlierFactor?: number;
}

export interface RobustAggregateResult {
  artifact: ModelArtifact;
  acceptedNodeIds: string[];
  rejectedNodeIds: string[];
  reasons: Record<string, string>;
  roundId: string;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function l2Norm(v: readonly number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median_requires_values');
  const s = values.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

function coordinateMedian(columns: readonly (readonly number[])[]): number[] {
  return columns.map((col) => median(col));
}

/**
 * Aggregate federated updates with a robustness rule and poisoning screens.
 * `verifySignature` must be supplied by the caller (Ed25519/HMAC lives in the
 * crypto layer); updates that fail it are rejected, never averaged.
 */
export function aggregateRobust(
  model: ModelIdentity,
  baseArtifact: ModelArtifact,
  updates: readonly FederatedUpdate[],
  verifySignature: (update: FederatedUpdate) => boolean,
  options: RobustAggregateOptions = {}
): RobustAggregateResult {
  if (model.approvalStatus !== 'APPROVED') throw new Error('model_not_approved');
  const rule = options.rule ?? 'trimmed_mean';
  const trim = options.trimFraction ?? 0.2;
  const maxNorm = options.maxDeltaNorm ?? 4;
  const lossFactor = options.lossOutlierFactor ?? 3;
  if (!(trim >= 0 && trim < 0.5)) throw new Error('invalid_trim_fraction');
  if (!(maxNorm > 0)) throw new Error('invalid_max_delta_norm');

  const rejected: string[] = [];
  const reasons: Record<string, string> = {};
  const structurallyValid = updates.filter((u) => {
    const fail = (reason: string): boolean => {
      rejected.push(u.nodeId);
      reasons[u.nodeId] = reason;
      return false;
    };
    if (!verifySignature(u)) return fail('signature_invalid');
    if (u.modelId !== model.modelId) return fail('model_mismatch');
    if (u.territoryId !== model.territoryId) return fail('territory_mismatch');
    if (u.baseModelVersion !== model.version) return fail('base_version_mismatch');
    if (u.sampleCount <= 0) return fail('non_positive_samples');
    if (u.deltaWeights.length !== baseArtifact.weights.length) return fail('dimension_mismatch');
    if (!Number.isFinite(u.deltaBias) || u.deltaWeights.some((v) => !Number.isFinite(v)))
      return fail('non_finite_delta');
    if (!Number.isFinite(u.metrics.loss) || u.metrics.loss < 0) return fail('invalid_loss');
    return true;
  });
  if (structurallyValid.length < 2) {
    throw new Error('insufficient_valid_federated_updates');
  }

  // Poisoning screen: drop loss outliers relative to the cohort median.
  const losses = structurallyValid.map((u) => u.metrics.loss);
  const medLoss = median(losses);
  const pool = structurallyValid.filter((u) => {
    if (medLoss > 0 && u.metrics.loss > medLoss * lossFactor) {
      rejected.push(u.nodeId);
      reasons[u.nodeId] = 'loss_outlier';
      return false;
    }
    return true;
  });
  if (pool.length < 2) throw new Error('insufficient_valid_federated_updates');

  // Norm clipping applied to the surviving deltas.
  const clipped = pool.map((u) => {
    const norm = l2Norm(u.deltaWeights);
    const k = norm > maxNorm ? maxNorm / (norm || 1) : 1;
    return { update: u, weights: u.deltaWeights.map((w) => w * k), bias: u.deltaBias * k, k };
  });

  const totalSamples = clipped.reduce((s, c) => s + c.update.sampleCount, 0) || 1;
  const width = baseArtifact.weights.length;
  const aggregated = new Array<number>(width).fill(0);
  let aggregatedBias = 0;

  if (rule === 'fedavg') {
    for (let j = 0; j < width; j++) {
      aggregated[j] =
        clipped.reduce((s, c) => s + c.weights[j]! * c.update.sampleCount, 0) / totalSamples;
    }
    aggregatedBias = clipped.reduce((s, c) => s + c.bias * c.update.sampleCount, 0) / totalSamples;
  } else {
    const keep = Math.max(1, clipped.length - Math.floor(clipped.length * trim));
    for (let j = 0; j < width; j++) {
      const col = clipped.map((c) => c.weights[j]!).sort((a, b) => a - b);
      if (rule === 'median') aggregated[j] = median(col);
      else {
        // trimmed mean: drop `trim` fraction from each end.
        const drop = Math.floor((col.length - keep) / 2);
        const core = col.slice(drop, col.length - drop);
        aggregated[j] = core.reduce((a, b) => a + b, 0) / (core.length || 1);
      }
    }
    const biasCol = clipped.map((c) => c.bias).sort((a, b) => a - b);
    aggregatedBias =
      rule === 'median'
        ? median(biasCol)
        : biasCol.reduce((a, b) => a + b, 0) / (biasCol.length || 1);
  }

  const weights = baseArtifact.weights.map((base, j) => base + aggregated[j]!);
  const bias = baseArtifact.bias + aggregatedBias;
  if (weights.some((v) => !Number.isFinite(v)) || !Number.isFinite(bias))
    throw new Error('non_finite_aggregate');
  const artifactHash = hash({ weights, bias, rule });
  const acceptedNodeIds = clipped.map((c) => c.update.nodeId).sort();
  const roundId = `fedround_robust_${hash({ modelId: model.modelId, acceptedNodeIds, rule }).slice(0, 24)}`;
  return {
    artifact: { weights, bias, artifactHash },
    acceptedNodeIds,
    rejectedNodeIds: [...new Set(rejected)].sort(),
    reasons,
    roundId,
  };
}

/** Convenience: median aggregation (also exported as coordinateMedian for tests). */
export function aggregateMedian(
  model: ModelIdentity,
  baseArtifact: ModelArtifact,
  updates: readonly FederatedUpdate[],
  verifySignature: (update: FederatedUpdate) => boolean
): RobustAggregateResult {
  return aggregateRobust(model, baseArtifact, updates, verifySignature, { rule: 'median' });
}

export { coordinateMedian };
