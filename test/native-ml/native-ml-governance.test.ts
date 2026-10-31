// state: draft | engine-generated
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { FederatedUpdate, ModelArtifact, ModelIdentity } from '../../src/lib/native-ml/types';
import { aggregateRobust, aggregateMedian } from '../../src/lib/native-ml/federation-robust';
import { ModelRegistry } from '../../src/lib/native-ml/registry';
import { MlProvenanceLedger } from '../../src/lib/native-ml/provenance';
import { NativeMlOrchestrator } from '../../src/lib/native-ml/native-ml-engine';
import * as nativeMl from '../../src/lib/native-ml/index';

const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

function approvedModel(modelHash: string): ModelIdentity {
  return {
    modelId: 'fed-model', version: '1.0.0', territoryId: 'terra', ownerId: 'owner',
    task: 'classification', algorithm: 'a', datasetIds: ['d'], modelHash,
    createdAt: '2026-10-01T00:00:00.000Z', approvalStatus: 'APPROVED',
  };
}

function baseArtifact(): ModelArtifact {
  const weights = [1, 1];
  const bias = 0;
  return { weights, bias, artifactHash: sha({ weights, bias }) };
}

function update(nodeId: string, deltaWeights: number[], loss: number): FederatedUpdate {
  return {
    updateId: `u-${nodeId}`, nodeId, territoryId: 'terra', modelId: 'fed-model',
    baseModelVersion: '1.0.0', deltaWeights, deltaBias: 0.1, sampleCount: 10,
    metrics: { loss }, updateHash: sha({ nodeId, deltaWeights }), signature: 'OK',
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('robust federation', () => {
  const verify = (u: FederatedUpdate) => u.signature === 'OK';
  it('median aggregation resists a poisoned node', () => {
    const base = baseArtifact();
    const model = approvedModel(base.artifactHash);
    const honest = [update('n1', [0.1, 0.1], 0.2), update('n2', [0.2, 0.2], 0.2)];
    const poisoned = update('evil', [500, 500], 9);
    const result = aggregateRobust(model, base, [...honest, poisoned], verify, { rule: 'median' });
    expect(result.acceptedNodeIds).toContain('n1');
    // The loss-outlier screen removes the poisoned node; honest median stays near base.
    expect(result.rejectedNodeIds).toContain('evil');
    expect(result.reasons['evil']).toBe('loss_outlier');
    expect(result.artifact.weights[0]).toBeLessThan(2);
  });
  it('rejects structurally invalid and bad-signature updates', () => {
    const base = baseArtifact();
    const model = approvedModel(base.artifactHash);
    const badSig = { ...update('bad', [0.1, 0.1], 0.2), signature: 'NOPE' };
    const wrongDim = { ...update('dim', [0.1], 0.2) };
    const good = [update('n1', [0.1, 0.1], 0.2), update('n2', [0.1, 0.1], 0.2)];
    const r = aggregateMedian(model, base, [...good, badSig, wrongDim], verify);
    expect(r.rejectedNodeIds).toContain('bad');
    expect(r.rejectedNodeIds).toContain('dim');
    expect(r.reasons['bad']).toBe('signature_invalid');
  });
});

describe('model registry', () => {
  it('enforces artifact hash integrity', () => {
    const reg = new ModelRegistry();
    const weights = [1, 2];
    const bias = 0.5;
    const artifactHash = sha({ weights, bias });
    const model = approvedModel(artifactHash);
    const entry = reg.register(model, { weights, bias, artifactHash }, 'owner');
    expect(entry.identity.approvalStatus).toBe('APPROVED');
    const tampered = { weights, bias, artifactHash: 'deadbeef' };
    expect(() => reg.register({ ...model, version: '2.0.0' }, tampered, 'owner')).toThrow(
      /artifact_hash_mismatch/
    );
  });
  it('records lineage and blocks revoked re-approval', () => {
    const reg = new ModelRegistry();
    const w = [1];
    const h = sha({ weights: w, bias: 0 });
    const m = approvedModel(h);
    reg.register(m, { weights: w, bias: 0, artifactHash: h }, 'owner');
    reg.setStatus(m.modelId, '1.0.0', 'REVOKED', 'reviewer');
    expect(() => reg.setStatus(m.modelId, '1.0.0', 'APPROVED', 'reviewer')).toThrow(
      /revoked_is_terminal/
    );
    expect(reg.lineage(m.modelId)).toHaveLength(1);
  });
});

describe('ml provenance ledger', () => {
  it('chains events, verifies inclusion and detects tampering', () => {
    const ledger = new MlProvenanceLedger();
    ledger.record({ type: 'training', subjectId: 'm1', actor: 'owner', metadata: { a: 1 } });
    ledger.record({ type: 'evaluation', subjectId: 'm1', actor: 'owner' });
    ledger.record({ type: 'promotion', subjectId: 'm1', actor: 'reviewer' });
    expect(ledger.size()).toBe(3);
    expect(ledger.verifyChain()).toBe(true);
    expect(ledger.root()).toHaveLength(64);
    const proof = ledger.proveInclusion(1);
    expect(ledger.verifyInclusion(proof)).toBe(true);
    // Events are frozen and chained; a forged leaf cannot be proven included.
    const forged = { ...proof, leafHash: 'f'.repeat(64) };
    expect(ledger.verifyInclusion(forged)).toBe(false);
    expect(() => ledger.proveInclusion(99)).toThrow(/provenance_seq_out_of_range/);
  });
});

describe('governed orchestrator', () => {
  it('trains, evaluates on held-out data and stays PENDING_REVIEW', async () => {
    const orch = new NativeMlOrchestrator();
    const features = [
      [2, 0], [2.1, 0.1], [2, 0.2], [0, 2], [0.1, 2.1], [0.2, 2],
      [2.2, 0.1], [0.1, 2.2], [2, 0.1], [0.2, 2.1],
    ];
    const labels = [1, 1, 1, 0, 0, 0, 1, 0, 1, 0];
    const outcome = await orch.trainBinary({
      features, labels, datasetId: 'ds1', ownerId: 'owner', territoryId: 'terra',
    });
    expect(outcome.model.approvalStatus).toBe('PENDING_REVIEW');
    expect(outcome.approvalRequired).toBe(true);
    expect(outcome.heldOut.accuracy).toBeGreaterThan(0.5);
    expect(outcome.dossier.dossierHash).toHaveLength(64);
    expect(orch.registry.size()).toBe(1);
    expect(orch.ledger.size()).toBe(1);
  });
  it('honors a DENY authorization hook', async () => {
    const orch = new NativeMlOrchestrator({
      authorize: () => ({ decision: 'DENY', riskScore: 1, policyIds: ['p'], reasons: ['no'] }),
    });
    await expect(
      orch.trainBinary({ features: [[1], [0]], labels: [1, 0], datasetId: 'd', ownerId: 'o', territoryId: 't' })
    ).rejects.toThrow(/native_ml_deny/);
  });
});

describe('index surface', () => {
  it('exports the new foundational primitives without collisions', () => {
    for (const name of [
      'mulberry32', 'fitStandardScaler', 'binaryClassificationMetrics', 'crossValidate',
      'trainSoftmax', 'trainRandomForest', 'fitPlattScaling', 'permutationImportance',
      'ksTwoSample', 'trainIsolationForest', 'fitHolt', 'buildTfidfIndex', 'partialFit',
      'aggregateRobust', 'ModelRegistry', 'deserialize', 'defineContract', 'demographicParity',
      'buildModelDossier', 'MlProvenanceLedger', 'NativeMlOrchestrator',
    ]) {
      expect((nativeMl as Record<string, unknown>)[name], name).toBeTruthy();
    }
  });
});
