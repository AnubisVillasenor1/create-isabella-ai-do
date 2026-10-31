/**
 * Salt and watermark-key material. Values are derived from env secrets when
 * present; otherwise a random value is persisted inside the IVCC data directory
 * with owner-only permissions. Without a data directory the runtime stays
 * ephemeral and reports that honestly.
 */
import { randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePrivateDirectory } from './store';

export interface SecretSource {
  readonly subjectSalt: 'env' | 'store' | 'ephemeral';
  readonly watermarkKey: 'env' | 'store' | 'ephemeral';
}

export interface IvccSecrets {
  readonly subjectSalt: Buffer;
  readonly watermarkKey: Buffer;
  readonly source: SecretSource;
}

const MIN_SECRET_CHARS = 16;

function derive(secret: string, label: string): Buffer {
  return createHash('sha256').update(`${label}:${secret}`).digest();
}

function readOrCreate(filePath: string): { value: Buffer; source: 'store' | 'ephemeral' } {
  ensurePrivateDirectory(path.dirname(filePath));
  try {
    const encoded = fs.readFileSync(filePath, 'utf8').trim();
    const value = Buffer.from(encoded, 'base64');
    if (value.length >= 32) return { value, source: 'store' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const generated = randomBytes(32);
  fs.writeFileSync(filePath, generated.toString('base64'), { encoding: 'utf8', mode: 0o600 });
  return { value: generated, source: 'store' };
}

export function resolveIvccDataDir(env: NodeJS.ProcessEnv): string | null {
  const raw = env.IVCC_DATA_DIR?.trim();
  if (!raw) return null;
  return path.resolve(raw);
}

/**
 * Loads IVCC secrets. `dataDir === null` means there is nowhere durable to store
 * generated material, so random per-process values are used and the caller must
 * report ephemerality.
 */
export function loadIvccSecrets(env: NodeJS.ProcessEnv, dataDir: string | null): IvccSecrets {
  let subjectSalt: Buffer;
  let watermarkKey: Buffer;
  let saltSource: SecretSource['subjectSalt'];
  let watermarkSource: SecretSource['watermarkKey'];

  const envSalt = env.IVCC_SUBJECT_SALT?.trim();
  if (envSalt && envSalt.length >= MIN_SECRET_CHARS) {
    subjectSalt = derive(envSalt, 'ivcc-subject-salt');
    saltSource = 'env';
  } else if (dataDir) {
    ensurePrivateDirectory(dataDir);
    const loaded = readOrCreate(path.join(dataDir, 'subject-salt.bin'));
    subjectSalt = loaded.value;
    saltSource = loaded.source;
  } else {
    subjectSalt = randomBytes(32);
    saltSource = 'ephemeral';
  }

  const envWatermark = env.IVCC_WATERMARK_SECRET?.trim();
  if (envWatermark && envWatermark.length >= MIN_SECRET_CHARS) {
    watermarkKey = derive(envWatermark, 'ivcc-watermark-secret');
    watermarkSource = 'env';
  } else if (dataDir) {
    ensurePrivateDirectory(dataDir);
    const loaded = readOrCreate(path.join(dataDir, 'watermark-key.bin'));
    watermarkKey = loaded.value;
    watermarkSource = loaded.source;
  } else {
    watermarkKey = randomBytes(32);
    watermarkSource = 'ephemeral';
  }

  return {
    subjectSalt,
    watermarkKey,
    source: { subjectSalt: saltSource, watermarkKey: watermarkSource },
  };
}
