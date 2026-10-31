/**
 * Sincronización y quórum Ω∞ (state: implemented | tested).
 *
 *   ΩX-12 Federated Knowledge Synchronization — réplica LWW con relojes vectoriales
 *            y lápidas para conocimiento compartido entre nodos lógicos.
 *   ΩX-17 Distributed KV Fabric — anillo consistente con replicación y quórum
 *            de lectura/escritura en proceso.
 *
 * Honestidad operativa: ambas piezas viven en un único proceso. No abren sockets,
 * no hablan con otro host y no constituyen una federación desplegada. Sirven como
 * sustrato verificable para un transporte real futuro y como caché replicable local.
 */
import { createHash } from 'node:crypto';

export type VectorClock = Readonly<Record<string, number>>;

export type ClockOrder = 'equal' | 'ahead' | 'behind' | 'concurrent';

function cloneValue<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    throw new Error('FEDERATION_VALUE_NOT_CLONEABLE');
  }
}

function normalizeClock(clock: VectorClock): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [node, counter] of Object.entries(clock)) {
    if (!node || !Number.isFinite(counter) || counter < 0) continue;
    normalized[node] = Math.trunc(counter);
  }
  return normalized;
}

export function compareClocks(left: VectorClock, right: VectorClock): ClockOrder {
  const a = normalizeClock(left);
  const b = normalizeClock(right);
  const nodes = new Set([...Object.keys(a), ...Object.keys(b)]);
  let leftGreater = false;
  let rightGreater = false;
  for (const node of nodes) {
    const av = a[node] ?? 0;
    const bv = b[node] ?? 0;
    if (av > bv) leftGreater = true;
    else if (bv > av) rightGreater = true;
  }
  if (leftGreater && rightGreater) return 'concurrent';
  if (leftGreater) return 'ahead';
  if (rightGreater) return 'behind';
  return 'equal';
}

export function mergeClocks(left: VectorClock, right: VectorClock): Record<string, number> {
  const merged = normalizeClock(left);
  for (const [node, counter] of Object.entries(normalizeClock(right))) {
    merged[node] = Math.max(merged[node] ?? 0, counter);
  }
  return merged;
}

export interface FederatedRecord {
  readonly id: string;
  readonly value: unknown;
  readonly clock: VectorClock;
  readonly updatedAt: number;
  readonly deleted: boolean;
  readonly origin: string;
}

export interface MergeResult {
  readonly applied: boolean;
  readonly reason: 'applied' | 'equal-clock' | 'local-newer' | 'stale-clock' | 'evicted';
  readonly record?: FederatedRecord;
}

export interface FederatedSyncOptions {
  readonly nodeId: string;
  readonly maxRecords?: number;
  readonly tombstoneTtlMs?: number;
  readonly now?: () => number;
}

const MAX_RECORDS = 2_048;
const MAX_VALUE_BYTES = 32_768;

function valueBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
}

export class FederatedKnowledgeSync {
  readonly nodeId: string;
  private readonly maxRecords: number;
  private readonly tombstoneTtlMs: number;
  private readonly now: () => number;
  private readonly records = new Map<string, FederatedRecord>();
  private localClock: Record<string, number> = {};
  private applied = 0;
  private rejected = 0;
  private conflicted = 0;

  constructor(options: FederatedSyncOptions) {
    const nodeId = typeof options.nodeId === 'string' ? options.nodeId.trim() : '';
    if (!nodeId || nodeId.length > 64)
      throw new RangeError('FEDERATION: nodeId must be 1..64 chars');
    const maxRecords = options.maxRecords ?? 512;
    if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > MAX_RECORDS) {
      throw new RangeError(`FEDERATION: maxRecords must be 1..${MAX_RECORDS}`);
    }
    const tombstoneTtlMs = options.tombstoneTtlMs ?? 24 * 60 * 60 * 1_000;
    if (!Number.isFinite(tombstoneTtlMs) || tombstoneTtlMs <= 0)
      throw new RangeError('FEDERATION: invalid tombstone TTL');
    this.nodeId = nodeId;
    this.maxRecords = maxRecords;
    this.tombstoneTtlMs = tombstoneTtlMs;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.records.size;
  }

  upsert(id: string, value: unknown, now: number = this.now()): FederatedRecord {
    this.assertId(id);
    if (valueBytes(value) > MAX_VALUE_BYTES)
      throw new RangeError('FEDERATION: value exceeds 32 KiB');
    const clock = mergeClocks(this.localClock, {
      [this.nodeId]: (this.localClock[this.nodeId] ?? 0) + 1,
    });
    this.localClock = clock;
    const record: FederatedRecord = {
      id,
      value: cloneValue(value),
      clock,
      updatedAt: now,
      deleted: false,
      origin: this.nodeId,
    };
    this.store(record);
    this.applied += 1;
    this.enforceCapacity(record.id);
    return this.clone(record);
  }

  remove(id: string, now: number = this.now()): FederatedRecord | undefined {
    const existing = this.records.get(id);
    if (!existing) return undefined;
    const clock = mergeClocks(this.localClock, {
      [this.nodeId]: (this.localClock[this.nodeId] ?? 0) + 1,
    });
    this.localClock = clock;
    const record: FederatedRecord = {
      ...existing,
      value: null,
      clock,
      updatedAt: now,
      deleted: true,
      origin: this.nodeId,
    };
    this.store(record);
    this.applied += 1;
    return this.clone(record);
  }

  get(id: string): FederatedRecord | undefined {
    const record = this.records.get(id);
    return record && !record.deleted ? this.clone(record) : undefined;
  }

  list(): FederatedRecord[] {
    return [...this.records.values()]
      .filter((record) => !record.deleted)
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
      .map((record) => this.clone(record));
  }

  merge(incoming: FederatedRecord): MergeResult {
    this.assertId(incoming.id);
    if (!Number.isInteger(incoming.updatedAt) || incoming.updatedAt < 0) {
      throw new RangeError('FEDERATION: updatedAt must be a non-negative integer');
    }
    if (typeof incoming.deleted !== 'boolean')
      throw new RangeError('FEDERATION: deleted must be boolean');
    if (!incoming.deleted && valueBytes(incoming.value) > MAX_VALUE_BYTES) {
      throw new RangeError('FEDERATION: value exceeds 32 KiB');
    }
    this.localClock = mergeClocks(this.localClock, incoming.clock);
    const local = this.records.get(incoming.id);
    if (!local) {
      const record = this.sanitize(incoming);
      this.store(record);
      this.applied += 1;
      this.enforceCapacity(record.id);
      return { applied: true, reason: 'applied', record: this.clone(record) };
    }
    const order = compareClocks(incoming.clock, local.clock);
    if (order === 'behind') {
      this.rejected += 1;
      return { applied: false, reason: 'stale-clock' };
    }
    if (order === 'equal') {
      if (incoming.updatedAt === local.updatedAt && incoming.deleted === local.deleted) {
        this.rejected += 1;
        return { applied: false, reason: 'equal-clock' };
      }
      const wins =
        incoming.updatedAt > local.updatedAt ||
        (incoming.updatedAt === local.updatedAt && incoming.origin.localeCompare(local.origin) > 0);
      if (!wins) {
        this.rejected += 1;
        return { applied: false, reason: 'local-newer' };
      }
    }
    if (order === 'concurrent') this.conflicted += 1;
    const record = this.sanitize(incoming);
    this.store(record);
    this.applied += 1;
    this.enforceCapacity(record.id);
    return { applied: true, reason: 'applied', record: this.clone(record) };
  }

  mergeMany(incoming: readonly FederatedRecord[]): { applied: number; rejected: number } {
    let applied = 0;
    let rejected = 0;
    for (const record of incoming.slice(0, this.maxRecords)) {
      if (this.merge(record).applied) applied += 1;
      else rejected += 1;
    }
    return { applied, rejected };
  }

  exportSince(remoteClock: VectorClock = {}): FederatedRecord[] {
    const remote = normalizeClock(remoteClock);
    return [...this.records.values()]
      .filter((record) =>
        Object.entries(normalizeClock(record.clock)).some(
          ([node, counter]) => counter > (remote[node] ?? 0)
        )
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((record) => this.clone(record));
  }

  pruneTombstones(now: number = this.now()): number {
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.deleted && now - record.updatedAt > this.tombstoneTtlMs) {
        this.records.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  digest(): string {
    const rows = [...this.records.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((record) => ({
        id: record.id,
        value: record.value,
        clock: record.clock,
        updatedAt: record.updatedAt,
        deleted: record.deleted,
      }));
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }

  stats(): {
    readonly nodeId: string;
    readonly records: number;
    readonly live: number;
    readonly tombstones: number;
    readonly applied: number;
    readonly rejected: number;
    readonly conflicts: number;
    readonly clock: VectorClock;
    readonly digest: string;
  } {
    const values = [...this.records.values()];
    const tombstones = values.filter((record) => record.deleted).length;
    return {
      nodeId: this.nodeId,
      records: values.length,
      live: values.length - tombstones,
      tombstones,
      applied: this.applied,
      rejected: this.rejected,
      conflicts: this.conflicted,
      clock: { ...this.localClock },
      digest: this.digest(),
    };
  }

  private sanitize(incoming: FederatedRecord): FederatedRecord {
    return {
      id: incoming.id.trim(),
      value: incoming.deleted ? null : cloneValue(incoming.value),
      clock: normalizeClock(incoming.clock),
      updatedAt: incoming.updatedAt,
      deleted: incoming.deleted,
      origin:
        typeof incoming.origin === 'string' && incoming.origin
          ? incoming.origin.slice(0, 64)
          : 'remote',
    };
  }

  private store(record: FederatedRecord): void {
    this.records.set(record.id, {
      ...record,
      value: record.deleted ? null : cloneValue(record.value),
      clock: normalizeClock(record.clock),
    });
  }

  private clone(record: FederatedRecord): FederatedRecord {
    return {
      ...record,
      value: record.deleted ? null : cloneValue(record.value),
      clock: { ...record.clock },
    };
  }

  private enforceCapacity(protectedId?: string): void {
    while (this.records.size > this.maxRecords) {
      const oldest = [...this.records.values()]
        .filter((record) => record.id !== protectedId)
        .sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id))[0];
      if (!oldest) {
        this.records.delete(protectedId ?? '');
        break;
      }
      this.records.delete(oldest.id);
    }
  }

  private assertId(id: string): void {
    if (typeof id !== 'string' || !id.trim() || id.length > 128)
      throw new RangeError('FEDERATION: invalid record id');
  }
}

export interface KvReplica {
  readonly nodeId: string;
  readonly value: unknown;
  readonly version: number;
  readonly updatedAt: number;
  readonly tombstone: boolean;
}

export interface KvWriteResult {
  readonly ok: boolean;
  readonly key: string;
  readonly version: number;
  readonly replicas: readonly string[];
  readonly acknowledgements: number;
  readonly quorumRequired: number;
}

export interface KvReadResult {
  readonly key: string;
  readonly found: boolean;
  readonly value: unknown;
  readonly replicas: readonly string[];
  readonly acknowledgements: number;
  readonly quorumRequired: number;
  readonly quorumMet: boolean;
  readonly source: string | null;
}

interface StoredKvEntry {
  readonly value: unknown;
  readonly version: number;
  readonly updatedAt: number;
  readonly tombstone: boolean;
}

export interface KvFabricOptions {
  readonly nodeIds: readonly string[];
  readonly replicationFactor?: number;
  readonly virtualNodes?: number;
  readonly maxKeys?: number;
  readonly now?: () => number;
}

function ringPosition(value: string): number {
  return createHash('sha256').update(value, 'utf8').digest().readUInt32BE(0);
}

export class DistributedKvFabric {
  private readonly nodes: readonly string[];
  private readonly replicationFactor: number;
  private readonly virtualNodes: number;
  private readonly maxKeys: number;
  private readonly now: () => number;
  private readonly ring: ReadonlyArray<{ readonly position: number; readonly nodeId: string }>;
  private readonly stores = new Map<string, Map<string, StoredKvEntry>>();
  private readonly health = new Map<string, boolean>();
  private readonly keyRecency = new Map<string, number>();
  private version = 0;
  private writes = 0;
  private reads = 0;
  private quorumFailures = 0;

  constructor(options: KvFabricOptions) {
    const nodeIds = [
      ...new Set(
        options.nodeIds.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
      ),
    ];
    if (nodeIds.length < 1 || nodeIds.length > 16)
      throw new RangeError('KV: nodeIds must contain 1..16 unique nodes');
    this.nodes = nodeIds;
    const replicationFactor = options.replicationFactor ?? Math.min(3, nodeIds.length);
    if (
      !Number.isInteger(replicationFactor) ||
      replicationFactor < 1 ||
      replicationFactor > nodeIds.length
    ) {
      throw new RangeError('KV: replicationFactor must be 1..nodes');
    }
    const virtualNodes = options.virtualNodes ?? 24;
    if (!Number.isInteger(virtualNodes) || virtualNodes < 4 || virtualNodes > 256) {
      throw new RangeError('KV: virtualNodes must be 4..256');
    }
    const maxKeys = options.maxKeys ?? 1_024;
    if (!Number.isInteger(maxKeys) || maxKeys < 1 || maxKeys > 16_384)
      throw new RangeError('KV: invalid maxKeys');
    this.replicationFactor = replicationFactor;
    this.virtualNodes = virtualNodes;
    this.maxKeys = maxKeys;
    this.now = options.now ?? Date.now;
    this.ring = this.buildRing(nodeIds, virtualNodes);
    for (const nodeId of nodeIds) {
      this.stores.set(nodeId, new Map());
      this.health.set(nodeId, true);
    }
  }

  set(key: string, value: unknown, now: number = this.now()): KvWriteResult {
    this.assertKey(key);
    let cloned: unknown;
    try {
      cloned = structuredClone(value);
    } catch {
      throw new Error('KV_VALUE_NOT_CLONEABLE');
    }
    if (Buffer.byteLength(JSON.stringify(cloned) ?? '', 'utf8') > 65_536) {
      throw new RangeError('KV: value exceeds 64 KiB');
    }
    this.version += 1;
    const entry: StoredKvEntry = {
      value: cloned,
      version: this.version,
      updatedAt: now,
      tombstone: false,
    };
    return this.writeToReplicas(key, entry);
  }

  remove(key: string, now: number = this.now()): KvWriteResult {
    this.assertKey(key);
    this.version += 1;
    return this.writeToReplicas(key, {
      value: null,
      version: this.version,
      updatedAt: now,
      tombstone: true,
    });
  }

  get(key: string): KvReadResult {
    this.assertKey(key);
    this.reads += 1;
    const replicas = this.replicasFor(key);
    const quorumRequired = this.quorumRequired();
    const entries = replicas
      .map((nodeId) => ({ nodeId, entry: this.stores.get(nodeId)?.get(key) }))
      .filter(
        (candidate): candidate is { nodeId: string; entry: StoredKvEntry } =>
          candidate.entry !== undefined && this.health.get(candidate.nodeId) === true
      );
    if (entries.length < quorumRequired) {
      this.quorumFailures += 1;
      return {
        key,
        found: false,
        value: null,
        replicas,
        acknowledgements: entries.length,
        quorumRequired,
        quorumMet: false,
        source: null,
      };
    }
    const winner = [...entries].sort(
      (a, b) =>
        b.entry.version - a.entry.version ||
        b.entry.updatedAt - a.entry.updatedAt ||
        b.nodeId.localeCompare(a.nodeId)
    )[0];
    if (!winner || winner.entry.tombstone) {
      return {
        key,
        found: false,
        value: null,
        replicas,
        acknowledgements: entries.length,
        quorumRequired,
        quorumMet: true,
        source: winner?.nodeId ?? null,
      };
    }
    return {
      key,
      found: true,
      value: structuredClone(winner.entry.value),
      replicas,
      acknowledgements: entries.length,
      quorumRequired,
      quorumMet: true,
      source: winner.nodeId,
    };
  }

  setNodeHealth(nodeId: string, healthy: boolean): boolean {
    if (!this.health.has(nodeId)) return false;
    this.health.set(nodeId, healthy);
    return true;
  }

  replicasFor(key: string): string[] {
    if (this.ring.length === 0) return [];
    const target = ringPosition(key);
    const selected: string[] = [];
    let index = this.ring.findIndex((point) => point.position >= target);
    if (index === -1) index = 0;
    for (
      let step = 0;
      step < this.ring.length && selected.length < this.replicationFactor;
      step += 1
    ) {
      const point = this.ring[(index + step) % this.ring.length];
      if (point && !selected.includes(point.nodeId)) selected.push(point.nodeId);
    }
    return selected;
  }

  quorumRequired(): number {
    return Math.floor(this.replicationFactor / 2) + 1;
  }

  snapshot(): {
    readonly nodes: readonly {
      readonly id: string;
      readonly healthy: boolean;
      readonly keys: number;
      readonly ringPoints: number;
    }[];
    readonly replicationFactor: number;
    readonly quorumRequired: number;
    readonly keys: number;
    readonly writes: number;
    readonly reads: number;
    readonly quorumFailures: number;
  } {
    return {
      nodes: this.nodes.map((id) => ({
        id,
        healthy: this.health.get(id) === true,
        keys: this.stores.get(id)?.size ?? 0,
        ringPoints: this.virtualNodes,
      })),
      replicationFactor: this.replicationFactor,
      quorumRequired: this.quorumRequired(),
      keys: this.keyRecency.size,
      writes: this.writes,
      reads: this.reads,
      quorumFailures: this.quorumFailures,
    };
  }

  private writeToReplicas(key: string, entry: StoredKvEntry): KvWriteResult {
    const replicas = this.replicasFor(key);
    let acknowledgements = 0;
    for (const nodeId of replicas) {
      if (this.health.get(nodeId) !== true) continue;
      this.stores.get(nodeId)?.set(key, entry);
      acknowledgements += 1;
    }
    this.writes += 1;
    this.keyRecency.set(key, entry.updatedAt);
    this.enforceCapacity();
    const quorumRequired = this.quorumRequired();
    const ok = acknowledgements >= quorumRequired;
    if (!ok) this.quorumFailures += 1;
    return { ok, key, version: entry.version, replicas, acknowledgements, quorumRequired };
  }

  private enforceCapacity(): void {
    while (this.keyRecency.size > this.maxKeys) {
      const oldest = [...this.keyRecency].sort((a, b) => a[1] - b[1])[0];
      if (!oldest) break;
      this.keyRecency.delete(oldest[0]);
      for (const store of this.stores.values()) store.delete(oldest[0]);
    }
  }

  private assertKey(key: string): void {
    if (typeof key !== 'string' || !key.trim() || key.length > 256)
      throw new RangeError('KV: key must be 1..256 chars');
  }

  private buildRing(
    nodes: readonly string[],
    virtualNodes: number
  ): ReadonlyArray<{ position: number; nodeId: string }> {
    const points: Array<{ position: number; nodeId: string }> = [];
    for (const nodeId of nodes) {
      for (let replica = 0; replica < virtualNodes; replica += 1) {
        points.push({ position: ringPosition(`${nodeId}#${replica}`), nodeId });
      }
    }
    return points.sort((a, b) => a.position - b.position || a.nodeId.localeCompare(b.nodeId));
  }
}
