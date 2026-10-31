import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { RetentionPlan } from './retention';

function syncDirectory(path: string): void {
  if (process.platform === 'win32') return;
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeAll(fd: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset, null);
    if (written <= 0) throw new Error('BOOKPI_WRITE_ZERO_PROGRESS');
    offset += written;
  }
}

/** Atomic same-directory replacement with file fsync, rename, and directory fsync. */
function atomicDurableWrite(path: string, content: string | Uint8Array): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const tempPath = path + '.tmp-' + randomUUID();
  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  let fd: number | null = null;
  try {
    fd = openSync(tempPath, 'wx', 0o600);
    writeAll(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    renameSync(tempPath, path);
    syncDirectory(directory);
  } catch (error) {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* preserve the original failure */
      }
    }
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      /* fail closed on next open */
    }
    throw error;
  } finally {
    bytes.fill(0);
  }
}

/** Append one JSONL row and fsync it before the event is published in memory. */
function appendDurableLine(path: string, line: string): void {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const existed = existsSync(path);
  const fd = openSync(path, 'a', 0o600);
  const bytes = Buffer.from(line, 'utf8');
  try {
    writeAll(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
    bytes.fill(0);
  }
  if (!existed) syncDirectory(directory);
}

export interface BookPiEventInput {
  id: string;
  timestamp: string;
  type: string;
  methodId: string;
  principal: string;
  riskTier: string;
  status: string;
}

export interface BookPiEvent extends BookPiEventInput {
  previousHash: string;
  hash: string;
  sequence: number;
}

export type BookPiStorageKind = 'VOLATILE_IN_MEMORY' | 'DURABLE_APPEND_ONLY_JSONL';

export interface BookPiVerification {
  status:
    'EMPTY_CHAIN' | 'VERIFIED_IN_MEMORY_CHAIN' | 'VERIFIED_DURABLE_CHAIN' | 'INTEGRITY_FAILURE';
  valid: boolean;
  blocksValidated: number;
  chainHead: string | null;
  storage: BookPiStorageKind;
  wormEnforced: false;
  durable: boolean;
  verifiedAt?: string;
  brokenIndex?: number | null;
  diagnostics?: readonly string[];
}

export interface BookPiSummary {
  totalEvents: number;
  genesisHash: string;
  chainHead: string | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  typeCounts: Record<string, number>;
  riskCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

export interface BookPiSnapshot extends BookPiVerification {
  count: number;
  events: readonly BookPiEvent[];
  summary: BookPiSummary;
  ledgerType: 'VOLATILE_IN_MEMORY_HASH_CHAIN' | 'DURABLE_APPEND_ONLY_JSONL';
  merkleRoot: null;
}

/** Shared read/append contract implemented by the in-memory and durable ledgers. */
export interface BookPiLedgerPort {
  append(input: BookPiEventInput): BookPiEvent;
  list(limit?: number): readonly BookPiEvent[];
  getEventById(id: string): BookPiEvent | null;
  verify(): BookPiVerification;
  getSummary(): BookPiSummary;
  snapshot(): BookPiSnapshot;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function eventPayload(input: BookPiEventInput, previousHash: string) {
  return {
    id: input.id,
    timestamp: input.timestamp,
    type: input.type,
    methodId: input.methodId,
    principal: input.principal,
    riskTier: input.riskTier,
    status: input.status,
    previousHash,
  };
}

function hashPayload(payload: ReturnType<typeof eventPayload>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function assertAppendInput(input: BookPiEventInput): void {
  if (
    ![
      input.id,
      input.timestamp,
      input.type,
      input.methodId,
      input.principal,
      input.riskTier,
      input.status,
    ].every((value) => value.trim())
  ) {
    throw new Error('BOOKPI_EVENT_FIELDS_REQUIRED');
  }
  if (!Number.isFinite(Date.parse(input.timestamp)))
    throw new Error('BOOKPI_EVENT_TIMESTAMP_INVALID');
}

function seal(input: BookPiEventInput, sequence: number, previousHash: string): BookPiEvent {
  const payload = eventPayload(input, previousHash);
  return Object.freeze({ ...payload, sequence, hash: hashPayload(payload) });
}

function summarize(events: readonly BookPiEvent[]): BookPiSummary {
  const typeCounts: Record<string, number> = {};
  const riskCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  for (const ev of events) {
    typeCounts[ev.type] = (typeCounts[ev.type] ?? 0) + 1;
    riskCounts[ev.riskTier] = (riskCounts[ev.riskTier] ?? 0) + 1;
    statusCounts[ev.status] = (statusCounts[ev.status] ?? 0) + 1;
  }
  return {
    totalEvents: events.length,
    genesisHash: GENESIS_HASH,
    chainHead: events.at(-1)?.hash ?? null,
    firstTimestamp: events.at(0)?.timestamp ?? null,
    lastTimestamp: events.at(-1)?.timestamp ?? null,
    typeCounts,
    riskCounts,
    statusCounts,
  };
}

function verifyEvents(
  events: readonly BookPiEvent[],
  startPrevHash: string,
  storage: BookPiStorageKind,
  durable: boolean
): BookPiVerification {
  const verifiedAt = new Date().toISOString();
  const diagnostics: string[] = [];
  let previousHash = startPrevHash;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event) continue;
    const expectedHash = hashPayload(eventPayload(event, event.previousHash));
    if (event.previousHash !== previousHash) {
      diagnostics.push(`Chain broken at block #${index + 1} (${event.id}): previousHash mismatch`);
      return {
        status: 'INTEGRITY_FAILURE',
        valid: false,
        blocksValidated: index,
        chainHead: events.at(-1)?.hash ?? null,
        storage,
        wormEnforced: false,
        durable,
        verifiedAt,
        brokenIndex: index,
        diagnostics: Object.freeze(diagnostics),
      };
    }
    if (event.hash !== expectedHash) {
      diagnostics.push(`Integrity failure at block #${index + 1} (${event.id}): hash mismatch`);
      return {
        status: 'INTEGRITY_FAILURE',
        valid: false,
        blocksValidated: index,
        chainHead: events.at(-1)?.hash ?? null,
        storage,
        wormEnforced: false,
        durable,
        verifiedAt,
        brokenIndex: index,
        diagnostics: Object.freeze(diagnostics),
      };
    }
    previousHash = event.hash;
  }

  diagnostics.push(`Chain intact: ${events.length} block(s) validated sequentially`);
  return {
    status:
      events.length === 0
        ? 'EMPTY_CHAIN'
        : durable
          ? 'VERIFIED_DURABLE_CHAIN'
          : 'VERIFIED_IN_MEMORY_CHAIN',
    valid: true,
    blocksValidated: events.length,
    chainHead: events.at(-1)?.hash ?? null,
    storage,
    wormEnforced: false,
    durable,
    verifiedAt,
    brokenIndex: null,
    diagnostics: Object.freeze(diagnostics),
  };
}

/** In-memory append-only hash chain. Volatile by design. */
export class InMemoryBookPiLedger {
  private readonly events: BookPiEvent[] = [];

  constructor(initialEvents: readonly BookPiEvent[] = []) {
    for (const event of initialEvents) this.events.push(Object.freeze({ ...event }));
  }

  append(input: BookPiEventInput): BookPiEvent {
    assertAppendInput(input);
    const previousHash = this.events.at(-1)?.hash ?? GENESIS_HASH;
    const entry = seal(input, this.events.length + 1, previousHash);
    this.events.push(entry);
    return { ...entry };
  }

  list(limit?: number): readonly BookPiEvent[] {
    const list = limit && limit > 0 ? this.events.slice(-limit) : this.events;
    return list.map((event) => Object.freeze({ ...event }));
  }

  getEventById(id: string): BookPiEvent | null {
    const found = this.events.find((e) => e.id === id);
    return found ? Object.freeze({ ...found }) : null;
  }

  verify(): BookPiVerification {
    return verifyEvents(this.events, GENESIS_HASH, 'VOLATILE_IN_MEMORY', false);
  }

  getSummary(): BookPiSummary {
    return summarize(this.events);
  }

  snapshot(): BookPiSnapshot {
    return {
      count: this.events.length,
      events: this.list(),
      ...this.verify(),
      summary: this.getSummary(),
      ledgerType: 'VOLATILE_IN_MEMORY_HASH_CHAIN',
      merkleRoot: null,
    };
  }
}

export interface DurableLedgerCheckpoint {
  archivedCount: number;
  lastArchivedHash: string | null;
  updatedAt: string;
}

function isRecordLine(value: unknown): value is BookPiEvent {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.timestamp === 'string' &&
    typeof rec.type === 'string' &&
    typeof rec.hash === 'string' &&
    typeof rec.previousHash === 'string' &&
    typeof rec.sequence === 'number'
  );
}

/**
 * Durable append-only JSONL audit ledger.
 *
 * Persists every event to a JSONL file (fsync-ordered, one JSON object per
 * line) and rebuilds the chain on startup. It preserves append-only semantics:
 * retention never silently drops live data — archival writes a separate archive
 * file plus a checkpoint, and physical pruning is an explicit, human-approved
 * operation (`pruneArchived`) that advances the checkpoint so verification
 * remains anchored. It is NOT a WORM device and does NOT provide hardware
 * immutability. state: draft | engine-generated.
 */
export class DurableBookPiLedger {
  private readonly filePath: string;
  private readonly checkpointPath: string;
  private readonly maintenancePath: string;
  private poisoned = false;
  private events: BookPiEvent[] = [];
  private checkpoint: DurableLedgerCheckpoint | null = null;

  constructor(filePath: string) {
    if (!filePath.trim()) throw new Error('BOOKPI_LEDGER_PATH_REQUIRED');
    this.filePath = filePath;
    this.checkpointPath = `${filePath}.checkpoint.json`;
    this.maintenancePath = `${filePath}.maintenance.pending.json`;
    // Own the durable directory from construction so readiness at boot reflects a
    // writable volume instead of reporting unavailable until the first append.
    mkdirSync(dirname(filePath), { recursive: true });
    this.load();
  }

  private assertHealthy(): void {
    if (this.poisoned || existsSync(this.maintenancePath))
      throw new Error('BOOKPI_MAINTENANCE_RECOVERY_REQUIRED');
  }

  private load(): void {
    if (existsSync(this.maintenancePath)) throw new Error('BOOKPI_MAINTENANCE_RECOVERY_REQUIRED');
    if (existsSync(this.checkpointPath)) {
      const raw = readFileSync(this.checkpointPath, 'utf8');
      const parsed = JSON.parse(raw) as DurableLedgerCheckpoint;
      if (
        !Number.isSafeInteger(parsed.archivedCount) ||
        parsed.archivedCount < 0 ||
        (parsed.archivedCount === 0 && parsed.lastArchivedHash !== null) ||
        (parsed.archivedCount > 0 &&
          (typeof parsed.lastArchivedHash !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(parsed.lastArchivedHash))) ||
        !Number.isFinite(Date.parse(parsed.updatedAt))
      ) {
        throw new Error('BOOKPI_CHECKPOINT_INVALID');
      }
      this.checkpoint = parsed;
    }
    this.events = this.readFile();
  }

  private readFile(): BookPiEvent[] {
    if (!existsSync(this.filePath)) return [];
    const raw = readFileSync(this.filePath, 'utf8');
    const events: BookPiEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const parsed: unknown = JSON.parse(line);
      if (!isRecordLine(parsed)) throw new Error('BOOKPI_LEDGER_CORRUPT');
      events.push(Object.freeze(parsed));
    }
    return events;
  }

  private persist(entry: BookPiEvent): void {
    try {
      appendDurableLine(this.filePath, JSON.stringify(entry) + '\n');
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
  }

  append(input: BookPiEventInput): BookPiEvent {
    this.assertHealthy();
    assertAppendInput(input);
    const previousHash =
      this.events.at(-1)?.hash ?? this.checkpoint?.lastArchivedHash ?? GENESIS_HASH;
    const sequence = (this.checkpoint?.archivedCount ?? 0) + this.events.length + 1;
    const entry = seal(input, sequence, previousHash);
    this.persist(entry);
    this.events.push(entry);
    return { ...entry };
  }

  list(limit?: number): readonly BookPiEvent[] {
    this.assertHealthy();
    const list = limit && limit > 0 ? this.events.slice(-limit) : this.events;
    return list.map((event) => Object.freeze({ ...event }));
  }

  getEventById(id: string): BookPiEvent | null {
    this.assertHealthy();
    const found = this.events.find((e) => e.id === id);
    return found ? Object.freeze({ ...found }) : null;
  }

  verify(): BookPiVerification {
    this.assertHealthy();
    const startPrevHash = this.checkpoint?.lastArchivedHash ?? GENESIS_HASH;
    const result = verifyEvents(this.events, startPrevHash, 'DURABLE_APPEND_ONLY_JSONL', true);
    if (!result.valid) return result;
    const baseSequence = this.checkpoint?.archivedCount ?? 0;
    for (let index = 0; index < this.events.length; index += 1) {
      if (this.events[index]?.sequence !== baseSequence + index + 1) {
        return {
          ...result,
          status: 'INTEGRITY_FAILURE',
          valid: false,
          blocksValidated: index,
          brokenIndex: index,
          diagnostics: Object.freeze(['Sequence discontinuity at retained block #' + (index + 1)]),
        };
      }
    }
    return result;
  }

  getSummary(): BookPiSummary {
    this.assertHealthy();
    return summarize(this.events);
  }

  snapshot(): BookPiSnapshot {
    this.assertHealthy();
    return {
      count: this.events.length,
      events: this.list(),
      ...this.verify(),
      summary: this.getSummary(),
      ledgerType: 'DURABLE_APPEND_ONLY_JSONL',
      merkleRoot: null,
    };
  }

  /** Copy the current ledger file to `destPath`. Returns bytes and event count. */
  backup(destPath: string): { path: string; bytes: number; events: number } {
    this.assertHealthy();
    if (!this.verify().valid) throw new Error('BOOKPI_BACKUP_SOURCE_CORRUPT');
    const ledgerContents = existsSync(this.filePath)
      ? readFileSync(this.filePath)
      : Buffer.alloc(0);
    try {
      atomicDurableWrite(destPath, ledgerContents);
    } finally {
      ledgerContents.fill(0);
    }
    const checkpointBackup = destPath + '.checkpoint.json';
    if (existsSync(this.checkpointPath)) {
      const checkpointContents = readFileSync(this.checkpointPath);
      try {
        atomicDurableWrite(checkpointBackup, checkpointContents);
      } finally {
        checkpointContents.fill(0);
      }
    } else if (existsSync(checkpointBackup)) {
      unlinkSync(checkpointBackup);
      syncDirectory(dirname(checkpointBackup));
    }
    const bytes =
      readFileSync(destPath).byteLength +
      (existsSync(checkpointBackup) ? readFileSync(checkpointBackup).byteLength : 0);
    return { path: destPath, bytes, events: this.events.length };
  }

  /**
   * Restore a verified backup and its checkpoint. A maintenance marker prevents
   * an interrupted two-file replacement from being mistaken for a valid ledger.
   */
  restore(srcPath: string): { restored: number; valid: boolean } {
    this.assertHealthy();
    if (!existsSync(srcPath)) throw new Error('BOOKPI_RESTORE_SOURCE_MISSING');
    const raw = readFileSync(srcPath, 'utf8');
    const incoming: BookPiEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const parsed: unknown = JSON.parse(line);
      if (!isRecordLine(parsed)) throw new Error('BOOKPI_RESTORE_SOURCE_INVALID');
      incoming.push(parsed);
    }

    let incomingCheckpoint: DurableLedgerCheckpoint | null = null;
    const sourceCheckpointPath = srcPath + '.checkpoint.json';
    const checkpointRaw = existsSync(sourceCheckpointPath)
      ? readFileSync(sourceCheckpointPath, 'utf8')
      : null;
    if (checkpointRaw !== null) {
      const parsed = JSON.parse(checkpointRaw) as DurableLedgerCheckpoint;
      if (
        !Number.isSafeInteger(parsed.archivedCount) ||
        parsed.archivedCount < 0 ||
        (parsed.archivedCount === 0 && parsed.lastArchivedHash !== null) ||
        (parsed.archivedCount > 0 &&
          (typeof parsed.lastArchivedHash !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(parsed.lastArchivedHash))) ||
        !Number.isFinite(Date.parse(parsed.updatedAt))
      )
        throw new Error('BOOKPI_RESTORE_CHECKPOINT_INVALID');
      incomingCheckpoint = parsed;
    }
    const startHash = incomingCheckpoint?.lastArchivedHash ?? GENESIS_HASH;
    const verdict = verifyEvents(incoming, startHash, 'DURABLE_APPEND_ONLY_JSONL', true);
    if (!verdict.valid) throw new Error('BOOKPI_RESTORE_SOURCE_CORRUPT');
    const baseSequence = incomingCheckpoint?.archivedCount ?? 0;
    if (incoming.some((event, index) => event.sequence !== baseSequence + index + 1)) {
      throw new Error('BOOKPI_RESTORE_SEQUENCE_INVALID');
    }

    const transaction = {
      operation: 'restore',
      startedAt: new Date().toISOString(),
      sourceDigest: createHash('sha256').update(raw).digest('hex'),
      sourceCheckpointDigest:
        checkpointRaw === null ? null : createHash('sha256').update(checkpointRaw).digest('hex'),
      targetLedger: this.filePath,
      targetCheckpoint: this.checkpointPath,
    };
    this.poisoned = true;
    atomicDurableWrite(this.maintenancePath, JSON.stringify(transaction));
    try {
      atomicDurableWrite(this.filePath, raw);
      if (checkpointRaw !== null) atomicDurableWrite(this.checkpointPath, checkpointRaw);
      else if (existsSync(this.checkpointPath)) {
        unlinkSync(this.checkpointPath);
        syncDirectory(dirname(this.checkpointPath));
      }
      unlinkSync(this.maintenancePath);
      syncDirectory(dirname(this.maintenancePath));
      this.load();
      this.poisoned = false;
      return { restored: incoming.length, valid: true };
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
  }

  prune(plan: RetentionPlan): { pruned: number; remaining: number } {
    this.assertHealthy();
    if (!this.verify().valid) throw new Error('BOOKPI_PRUNE_SOURCE_CORRUPT');
    if (plan.archived.length === 0) return { pruned: 0, remaining: this.events.length };
    if (plan.archived.length + plan.kept.length !== this.events.length)
      throw new Error('BOOKPI_PRUNE_PLAN_MISMATCH');

    const planned = [...plan.archived, ...plan.kept];
    for (let index = 0; index < this.events.length; index += 1) {
      const actual = this.events[index]!;
      const proposed = planned[index]!;
      if (
        !proposed ||
        proposed.id !== actual.id ||
        proposed.sequence !== actual.sequence ||
        proposed.hash !== actual.hash
      ) {
        throw new Error('BOOKPI_PRUNE_PLAN_MISMATCH');
      }
    }
    const headArchived = plan.archived.at(-1);
    if (!headArchived) throw new Error('BOOKPI_PRUNE_PLAN_MISMATCH');
    const firstKept = plan.kept.at(0);
    if (firstKept && firstKept.previousHash !== headArchived.hash)
      throw new Error('BOOKPI_PRUNE_PLAN_MISMATCH');

    const body = plan.kept.map((event) => JSON.stringify(event)).join('\n');
    const checkpoint: DurableLedgerCheckpoint = {
      archivedCount: (this.checkpoint?.archivedCount ?? 0) + plan.archived.length,
      lastArchivedHash: headArchived.hash,
      updatedAt: new Date().toISOString(),
    };
    const transaction = {
      operation: 'prune',
      startedAt: new Date().toISOString(),
      previousCheckpoint: this.checkpoint,
      nextCheckpoint: checkpoint,
      archivedCount: plan.archived.length,
      lastArchivedHash: headArchived.hash,
      retainedHead: firstKept?.hash ?? null,
      targetLedger: this.filePath,
      targetCheckpoint: this.checkpointPath,
    };

    this.poisoned = true;
    atomicDurableWrite(this.maintenancePath, JSON.stringify(transaction));
    try {
      atomicDurableWrite(this.filePath, body ? body + '\n' : '');
      atomicDurableWrite(this.checkpointPath, JSON.stringify(checkpoint));
      unlinkSync(this.maintenancePath);
      syncDirectory(dirname(this.maintenancePath));
      this.events = [...plan.kept];
      this.checkpoint = checkpoint;
      this.poisoned = false;
      return { pruned: plan.archived.length, remaining: this.events.length };
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
  }

  /** Return the current checkpoint (archived count + anchor hash), if any. */
  getCheckpoint(): DurableLedgerCheckpoint | null {
    this.assertHealthy();
    return this.checkpoint ? { ...this.checkpoint } : null;
  }
}

/**
 * Selects the audit ledger implementation. A non-empty `BOOKPI_LEDGER_PATH`
 * enables the durable JSONL ledger; otherwise the process falls back to the
 * volatile in-memory chain (documented, not silent).
 */
export function createAuditLedger(ledgerPath?: string): InMemoryBookPiLedger | DurableBookPiLedger {
  const path = (ledgerPath ?? process.env.BOOKPI_LEDGER_PATH ?? '').trim();
  if (path) return new DurableBookPiLedger(path);
  return new InMemoryBookPiLedger();
}

export const bookPiLedger = createAuditLedger();
