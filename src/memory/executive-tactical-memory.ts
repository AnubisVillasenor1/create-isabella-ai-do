/**
 * Executive Tactical Memory (ETM) — memoria táctica ejecutiva (state: implemented | tested).
 *
 * Conserva metas, planes, decisiones y prioridades de una sesión con capacidad acotada,
 * TTL y cadena de hashes verificable. No muta la memoria canónica, no concede autoridad
 * y no ejecuta acciones.
 *
 * SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ PRODUCTION.
 */
import { createHash, randomBytes } from 'node:crypto';

export const TACTICAL_RECORD_KINDS = ['goal', 'plan', 'decision', 'priority'] as const;
export type TacticalRecordKind = (typeof TACTICAL_RECORD_KINDS)[number];

export interface TacticalRecord {
  readonly id: string;
  readonly kind: TacticalRecordKind;
  readonly title: string;
  readonly payload: unknown;
  readonly priority: number;
  readonly createdAt: number;
  readonly expiresAt: number | null;
  readonly previousHash: string | null;
  readonly hash: string;
}

export interface TacticalRecordInput {
  readonly priority?: number;
  readonly ttlMs?: number | null;
}

export interface ExecutiveTacticalMemoryOptions {
  readonly capacity?: number;
  readonly defaultTtlMs?: number | null;
  readonly now?: () => number;
  readonly idFactory?: () => string;
}

export interface TacticalMemorySnapshot {
  readonly records: readonly TacticalRecord[];
  readonly retainedRecords: number;
  readonly expiredRecords: number;
  readonly headHash: string | null;
  readonly evictedHead: string | null;
  readonly integrity: boolean;
  readonly capacity: number;
  readonly authority: 'NONE';
  readonly canonicalMemoryMutation: false;
}

export interface TacticalMemoryStats {
  readonly activeRecords: number;
  readonly retainedRecords: number;
  readonly expiredRecords: number;
  readonly evictedRecords: number;
  readonly capacity: number;
  readonly byKind: Readonly<Record<TacticalRecordKind, number>>;
  readonly integrity: boolean;
}

const DEFAULT_CAPACITY = 64;
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_CAPACITY = 1024;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TITLE_LENGTH = 160;
const MAX_ID_LENGTH = 128;

type RecordCore = Omit<TacticalRecord, 'hash'>;

function recordHash(core: RecordCore): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: core.id,
        kind: core.kind,
        title: core.title,
        payload: core.payload,
        priority: core.priority,
        createdAt: core.createdAt,
        expiresAt: core.expiresAt,
        previousHash: core.previousHash,
      })
    )
    .digest('hex');
}

function clonePayload<T>(payload: T): T {
  try {
    return structuredClone(payload);
  } catch {
    throw new Error('ETM_PAYLOAD_NOT_CLONEABLE');
  }
}

function cloneRecord(record: TacticalRecord): TacticalRecord {
  return { ...record, payload: clonePayload(record.payload) };
}

function assertPriority(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('ETM_INVALID_PRIORITY');
  }
}

export class ExecutiveTacticalMemory {
  private readonly capacity: number;
  private readonly defaultTtlMs: number | null;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly records: TacticalRecord[] = [];
  private evictedHead: string | null = null;
  private evictedCount = 0;

  constructor(options: ExecutiveTacticalMemoryOptions = {}) {
    const capacity = options.capacity ?? DEFAULT_CAPACITY;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
      throw new Error('ETM_INVALID_CAPACITY');
    }
    const defaultTtlMs = options.defaultTtlMs === undefined ? DEFAULT_TTL_MS : options.defaultTtlMs;
    if (
      defaultTtlMs !== null &&
      (!Number.isFinite(defaultTtlMs) || defaultTtlMs <= 0 || defaultTtlMs > MAX_TTL_MS)
    ) {
      throw new Error('ETM_INVALID_TTL');
    }
    this.capacity = capacity;
    this.defaultTtlMs = defaultTtlMs;
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? (() => `etm_${randomBytes(12).toString('hex')}`);
  }

  get size(): number {
    return this.records.length;
  }

  record(
    kind: TacticalRecordKind,
    title: string,
    payload: unknown,
    input: TacticalRecordInput = {}
  ): TacticalRecord {
    if (!TACTICAL_RECORD_KINDS.includes(kind)) throw new Error('ETM_INVALID_KIND');
    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    if (!normalizedTitle || normalizedTitle.length > MAX_TITLE_LENGTH) {
      throw new Error('ETM_INVALID_TITLE');
    }

    const priority = input.priority ?? 0.5;
    assertPriority(priority);

    const ttlMs = input.ttlMs === undefined ? this.defaultTtlMs : input.ttlMs;
    if (ttlMs !== null && (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS)) {
      throw new Error('ETM_INVALID_TTL');
    }

    const id = this.idFactory();
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) {
      throw new Error('ETM_INVALID_ID');
    }
    if (this.records.some((record) => record.id === id)) throw new Error('ETM_DUPLICATE_ID');

    const createdAt = this.now();
    const core: RecordCore = {
      id,
      kind,
      title: normalizedTitle,
      payload: clonePayload(payload),
      priority,
      createdAt,
      expiresAt: ttlMs === null ? null : createdAt + ttlMs,
      previousHash: this.records.at(-1)?.hash ?? this.evictedHead,
    };

    let hash: string;
    try {
      hash = recordHash(core);
    } catch {
      throw new Error('ETM_PAYLOAD_NOT_SERIALIZABLE');
    }
    const record: TacticalRecord = { ...core, hash };

    while (this.records.length >= this.capacity) {
      const evicted = this.records.shift();
      if (evicted) {
        this.evictedHead = evicted.hash;
        this.evictedCount += 1;
      }
    }
    this.records.push(record);
    return cloneRecord(record);
  }

  read(id: string): TacticalRecord | undefined {
    const record = this.records.find((candidate) => candidate.id === id);
    if (!record || this.isExpired(record)) return undefined;
    return cloneRecord(record);
  }

  list(kind?: TacticalRecordKind): readonly TacticalRecord[] {
    const at = this.now();
    return this.records
      .filter(
        (record) => !this.isExpired(record, at) && (kind === undefined || record.kind === kind)
      )
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
      .map(cloneRecord);
  }

  verifyIntegrity(): boolean {
    let previous = this.evictedHead;
    for (const record of this.records) {
      const core: RecordCore = {
        id: record.id,
        kind: record.kind,
        title: record.title,
        payload: record.payload,
        priority: record.priority,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        previousHash: record.previousHash,
      };
      if (record.previousHash !== previous) return false;
      if (recordHash(core) !== record.hash) return false;
      previous = record.hash;
    }
    return true;
  }

  stats(): TacticalMemoryStats {
    const at = this.now();
    const active = this.records.filter((record) => !this.isExpired(record, at));
    const byKind: Record<TacticalRecordKind, number> = {
      goal: 0,
      plan: 0,
      decision: 0,
      priority: 0,
    };
    for (const record of active) byKind[record.kind] += 1;
    return {
      activeRecords: active.length,
      retainedRecords: this.records.length,
      expiredRecords: this.records.length - active.length,
      evictedRecords: this.evictedCount,
      capacity: this.capacity,
      byKind,
      integrity: this.verifyIntegrity(),
    };
  }

  snapshot(): TacticalMemorySnapshot {
    const at = this.now();
    return {
      records: this.list(),
      retainedRecords: this.records.length,
      expiredRecords: this.records.filter((record) => this.isExpired(record, at)).length,
      headHash: this.records.at(-1)?.hash ?? null,
      evictedHead: this.evictedHead,
      integrity: this.verifyIntegrity(),
      capacity: this.capacity,
      authority: 'NONE',
      canonicalMemoryMutation: false,
    };
  }

  clear(): void {
    this.records.length = 0;
    this.evictedHead = null;
    this.evictedCount = 0;
  }

  private isExpired(record: TacticalRecord, at = this.now()): boolean {
    return record.expiresAt !== null && record.expiresAt <= at;
  }
}
