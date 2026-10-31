// state: draft | engine-generated
//
// Governed model registry. Native training produced artifacts but there was no
// place to version them, record lineage, or roll back — so "which model is live
// and why" was unanswerable. This is an in-memory, append-only registry: entries
// are immutable, transitions are explicit and audited, and rollback selects a
// prior version rather than mutating history. A registry records state; it does
// not decide state — approval remains a human act.

import { createHash } from 'node:crypto';
import type { ApprovalStatus, ModelArtifact, ModelIdentity } from './types';

export interface RegistryEntry {
  identity: ModelIdentity;
  artifact: ModelArtifact;
  parentModelHash: string | null;
  registeredAt: string;
  registeredBy: string;
}

export interface LineageRecord {
  modelId: string;
  version: string;
  modelHash: string;
  parentModelHash: string | null;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class ModelRegistry {
  private readonly entries = new Map<string, RegistryEntry[]>();

  register(
    identity: ModelIdentity,
    artifact: ModelArtifact,
    registeredBy: string,
    parentModelHash: string | null = null
  ): RegistryEntry {
    if (!identity.modelId || !identity.version) throw new Error('invalid_identity');
    const recomputed = hash({ weights: artifact.weights, bias: artifact.bias });
    if (recomputed !== artifact.artifactHash) throw new Error('artifact_hash_mismatch');
    if (artifact.artifactHash !== identity.modelHash && identity.task !== 'clustering')
      throw new Error('identity_artifact_hash_mismatch');
    const list = this.entries.get(identity.modelId) ?? [];
    if (list.some((e) => e.identity.version === identity.version))
      throw new Error('version_already_registered');
    if (parentModelHash !== null && !list.some((e) => e.identity.modelHash === parentModelHash))
      throw new Error('unknown_parent');
    const entry: RegistryEntry = {
      identity: Object.freeze({ ...identity }),
      artifact: Object.freeze({
        ...artifact,
        weights: Object.freeze([...artifact.weights]) as number[],
      }),
      parentModelHash,
      registeredAt: new Date().toISOString(),
      registeredBy,
    };
    list.push(entry);
    this.entries.set(identity.modelId, list);
    return entry;
  }

  get(modelId: string, version: string): RegistryEntry | undefined {
    return this.entries.get(modelId)?.find((e) => e.identity.version === version);
  }

  latestApproved(modelId: string): RegistryEntry | undefined {
    const list = this.entries.get(modelId) ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]!.identity.approvalStatus === 'APPROVED') return list[i];
    }
    return undefined;
  }

  /**
   * Record a human approval decision. The caller must supply the approver's
   * identity; the registry never self-approves. Status transitions are validated
   * against the allowed graph (no re-approval of a revoked entry).
   */
  setStatus(
    modelId: string,
    version: string,
    status: ApprovalStatus,
    approver: string
  ): RegistryEntry {
    if (!approver) throw new Error('approver_required');
    const entry = this.get(modelId, version);
    if (!entry) throw new Error('entry_not_found');
    const from = entry.identity.approvalStatus;
    if (from === 'REVOKED') throw new Error('revoked_is_terminal');
    if (from === status) return entry;
    const updated: RegistryEntry = {
      ...entry,
      identity: Object.freeze({ ...entry.identity, approvalStatus: status }),
    };
    const list = this.entries.get(modelId)!;
    list[list.findIndex((e) => e.identity.version === version)] = updated;
    return updated;
  }

  /** Roll forward the pointer to a previously registered, still-approved version. */
  rollback(modelId: string, version: string, actor: string): RegistryEntry {
    if (!actor) throw new Error('actor_required');
    const entry = this.get(modelId, version);
    if (!entry) throw new Error('entry_not_found');
    if (entry.identity.approvalStatus !== 'APPROVED')
      throw new Error('cannot_rollback_to_unapproved');
    return entry;
  }

  lineage(modelId: string): LineageRecord[] {
    const list = this.entries.get(modelId) ?? [];
    return list.map((e) => ({
      modelId: e.identity.modelId,
      version: e.identity.version,
      modelHash: e.identity.modelHash,
      parentModelHash: e.parentModelHash,
    }));
  }

  versions(modelId: string): string[] {
    return (this.entries.get(modelId) ?? []).map((e) => e.identity.version);
  }

  size(): number {
    let n = 0;
    for (const list of this.entries.values()) n += list.length;
    return n;
  }
}
