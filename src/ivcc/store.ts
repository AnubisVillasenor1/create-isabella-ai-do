/**
 * IVCC persistence. Consent records, profiles, prosody memory and the audit
 * chain are stored in one JSON document that is replaced atomically on every
 * transaction. The in-memory store exists for tests and explicitly ephemeral
 * development runs; production mutations require the file store.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { IvccState } from './types';

export class IvccStoreError extends Error {
  constructor(
    readonly code: 'IVCC_STORE_CORRUPT' | 'IVCC_STORE_WRITE_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'IvccStoreError';
  }
}

export interface IvccStore {
  readonly kind: 'file' | 'memory';
  readonly durable: boolean;
  read(): Promise<IvccState>;
  write(state: IvccState): Promise<void>;
}

export function emptyIvccState(): IvccState {
  return { version: 1, consents: [], usageTokens: [], profiles: [], memory: {}, audit: [] };
}

export function cloneState(state: IvccState): IvccState {
  return structuredClone(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Fail closed on shapes this runtime cannot trust; a corrupt store is never partially used. */
export function assertIvccState(value: unknown): IvccState {
  if (!isRecord(value) || value.version !== 1) {
    throw new IvccStoreError('IVCC_STORE_CORRUPT', 'IVCC state version missing or unsupported');
  }
  if (
    !Array.isArray(value.consents) ||
    !Array.isArray(value.usageTokens) ||
    !Array.isArray(value.profiles) ||
    !Array.isArray(value.audit) ||
    !isRecord(value.memory)
  ) {
    throw new IvccStoreError('IVCC_STORE_CORRUPT', 'IVCC state collections are malformed');
  }
  for (const record of value.consents) {
    if (
      !isRecord(record) ||
      typeof record.consentId !== 'string' ||
      typeof record.subjectHash !== 'string' ||
      !Array.isArray(record.scopes)
    ) {
      throw new IvccStoreError('IVCC_STORE_CORRUPT', 'consent record is malformed');
    }
  }
  for (const profile of value.profiles) {
    if (
      !isRecord(profile) ||
      typeof profile.id !== 'string' ||
      typeof profile.subjectHash !== 'string' ||
      !isRecord(profile.traits)
    ) {
      throw new IvccStoreError('IVCC_STORE_CORRUPT', 'voice profile is malformed');
    }
  }
  return value as unknown as IvccState;
}

export class MemoryIvccStore implements IvccStore {
  readonly kind = 'memory' as const;
  readonly durable = false;
  private state: IvccState;

  constructor(initial: IvccState = emptyIvccState()) {
    this.state = cloneState(initial);
  }

  async read(): Promise<IvccState> {
    return cloneState(this.state);
  }

  async write(state: IvccState): Promise<void> {
    this.state = cloneState(state);
  }
}

export class JsonFileIvccStore implements IvccStore {
  readonly kind = 'file' as const;
  readonly durable = true;

  constructor(readonly filePath: string) {
    ensurePrivateDirectory(path.dirname(filePath));
  }

  static at(dataDir: string): JsonFileIvccStore {
    return new JsonFileIvccStore(path.join(dataDir, 'state.json'));
  }

  async read(): Promise<IvccState> {
    try {
      const raw = await fsp.readFile(this.filePath, 'utf8');
      if (!raw.trim()) return emptyIvccState();
      return assertIvccState(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyIvccState();
      if (error instanceof IvccStoreError) throw error;
      throw new IvccStoreError(
        'IVCC_STORE_CORRUPT',
        `IVCC state could not be parsed: ${(error as Error).message}`
      );
    }
  }

  async write(state: IvccState): Promise<void> {
    const directory = path.dirname(this.filePath);
    ensurePrivateDirectory(directory);
    const temp = path.join(
      directory,
      `.state-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`
    );
    let handle: fsp.FileHandle | null = null;
    try {
      handle = await fsp.open(temp, 'w', 0o600);
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fsp.rename(temp, this.filePath);
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await fsp.rm(temp, { force: true }).catch(() => undefined);
      throw new IvccStoreError(
        'IVCC_STORE_WRITE_FAILED',
        `IVCC state could not be persisted: ${(error as Error).message}`
      );
    }
  }
}

export function ensurePrivateDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}
