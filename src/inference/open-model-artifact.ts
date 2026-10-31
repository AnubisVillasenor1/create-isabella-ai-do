/**
 * state: draft | engine-generated
 * Local open-model artifact inspection (GGUF + optional manifest).
 *
 * This module only inspects files. It never loads weights, never executes a model,
 * never downloads anything and never approves a model for production. A clean
 * report means "structurally coherent and hash-matching", not "safe", "verified",
 * "licensed for your use" or "authorized".
 *
 * GGUF reference: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, open, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export type ArtifactSeverity = 'error' | 'warning' | 'info';

export interface ArtifactFinding {
  readonly code: string;
  readonly severity: ArtifactSeverity;
  readonly message: string;
}

export interface GgufMetadataEntry {
  readonly key: string;
  readonly type: string;
  readonly value: string | number | boolean | null;
}

export interface GgufHeaderReport {
  readonly magicOk: boolean;
  readonly version?: number;
  readonly tensorCount?: number;
  readonly kvCount?: number;
  readonly architecture?: string;
  readonly name?: string;
  readonly license?: string;
  readonly fileType?: number;
  readonly splitCount?: number;
  readonly splitIndex?: number;
  readonly tokenizerModel?: string;
  readonly metadata: readonly GgufMetadataEntry[];
  readonly metadataComplete: boolean;
}

export interface GgufInspection {
  readonly header: GgufHeaderReport;
  readonly findings: readonly ArtifactFinding[];
}

export type LicenseClass = 'permissive' | 'copyleft' | 'community' | 'proprietary' | 'unknown';
export type CommercialUse = 'allowed' | 'conditional' | 'not-established';

export interface ModelManifestFile {
  readonly path: string;
  readonly sha256?: string;
  readonly bytes?: number;
}

export interface ModelManifest {
  readonly id: string;
  readonly version?: string;
  readonly license?: string;
  readonly architecture?: string;
  readonly contextWindow?: number;
  readonly files: readonly ModelManifestFile[];
  readonly provenance?: {
    readonly sourceUrl?: string;
    readonly retrievedAt?: string;
    readonly publisher?: string;
  };
}

export interface ModelArtifactOptions {
  /** Directory that bounds every path read by this inspection. */
  readonly rootDir: string;
  /** Artifact path relative to rootDir; absolute paths and `..` escapes are rejected. */
  readonly relativePath: string;
  /** Optional manifest relative to rootDir. */
  readonly manifestPath?: string;
  /** Hard file-size ceiling. Default 32 GiB. */
  readonly maxBytes?: number;
  /** Full SHA-256. Default true; disable only for very large files with an explicit decision. */
  readonly hash?: boolean;
  /** Header window parsed for GGUF metadata. Default 4 MiB. */
  readonly headerBytes?: number;
}

export interface ModelArtifactReport {
  readonly ok: boolean;
  readonly authority: 'NONE';
  readonly productionApproved: false;
  readonly artifact: {
    readonly path: string;
    readonly sizeBytes: number;
    readonly sha256: string | null;
    readonly sha256Computed: boolean;
  };
  readonly gguf: GgufHeaderReport | null;
  readonly license: {
    readonly declared: string | null;
    readonly spdx: string | null;
    readonly class: LicenseClass;
    readonly commercialUse: CommercialUse;
    readonly source: 'manifest' | 'license-file' | 'gguf' | 'none';
  };
  readonly manifest: {
    readonly path: string;
    readonly valid: boolean;
    readonly id?: string;
    readonly version?: string;
  } | null;
  readonly findings: readonly ArtifactFinding[];
}

const GGUF_MAGIC = 0x46554747; // "GGUF" little-endian.
const VALUE_TYPE_NAMES = [
  'uint8',
  'int8',
  'uint16',
  'int16',
  'uint32',
  'int32',
  'float32',
  'bool',
  'string',
  'array',
  'uint64',
  'int64',
  'float64',
] as const;
const MAX_TENSORS = 50_000_000;
const MAX_KV = 1_000_000;
const MAX_STRING_BYTES = 8 * 1024 * 1024;
const MAX_ARRAY_ITEMS = 1_000_000;
const MAX_METADATA_ENTRIES = 4_096;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024 * 1024;
const DEFAULT_HEADER_BYTES = 4 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 512 * 1024;
const SHA256_RE = /^[a-f0-9]{64}$/;

const LICENSE_RULES: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly spdx: string | null;
  readonly class: LicenseClass;
  readonly commercialUse: CommercialUse;
}> = [
  {
    pattern: /\bmit license\b|\bpermission is hereby granted, free of charge\b/i,
    spdx: 'MIT',
    class: 'permissive',
    commercialUse: 'allowed',
  },
  {
    pattern: /\bapache license\b.*\b2\.0\b|\bapache-2\.0\b/i,
    spdx: 'Apache-2.0',
    class: 'permissive',
    commercialUse: 'allowed',
  },
  {
    pattern:
      /\bbsd 2-clause\b|\bredistribution and use in source and binary forms\b.*\bwithout modification\b/i,
    spdx: 'BSD-2-Clause',
    class: 'permissive',
    commercialUse: 'allowed',
  },
  {
    pattern: /\bbsd 3-clause\b|\bneither the name of\b.*\bmay be used to endorse\b/i,
    spdx: 'BSD-3-Clause',
    class: 'permissive',
    commercialUse: 'allowed',
  },
  {
    pattern: /\bisc license\b|\bpermission to use, copy, modify, and\/or distribute\b/i,
    spdx: 'ISC',
    class: 'permissive',
    commercialUse: 'allowed',
  },
  {
    pattern: /\bcc0 1\.0\b|\bcreative commons zero\b/i,
    spdx: 'CC0-1.0',
    class: 'permissive',
    commercialUse: 'allowed',
  },
  {
    pattern: /\bcc by 4\.0\b|\bcreative commons attribution 4\.0\b/i,
    spdx: 'CC-BY-4.0',
    class: 'permissive',
    commercialUse: 'allowed',
  },
  {
    pattern: /\bcc by-sa 4\.0\b|\bcreative commons attribution-sharealike 4\.0\b/i,
    spdx: 'CC-BY-SA-4.0',
    class: 'copyleft',
    commercialUse: 'conditional',
  },
  {
    pattern: /\bgnu affero general public license\b|\bagpl-?3\b/i,
    spdx: 'AGPL-3.0',
    class: 'copyleft',
    commercialUse: 'conditional',
  },
  {
    pattern: /\bgnu general public license\b|\bgpl-?3\b|\bgpl-?2\b/i,
    spdx: 'GPL-3.0',
    class: 'copyleft',
    commercialUse: 'conditional',
  },
  {
    pattern: /\bgnu lesser general public license\b|\blgpl\b/i,
    spdx: 'LGPL-3.0',
    class: 'copyleft',
    commercialUse: 'conditional',
  },
  {
    pattern: /\bmozilla public license\b|\bmpl-?2\.0\b/i,
    spdx: 'MPL-2.0',
    class: 'copyleft',
    commercialUse: 'conditional',
  },
  {
    pattern: /\bllama\s*\d*(\.\d+)?\s*community license\b/i,
    spdx: 'Llama-Community',
    class: 'community',
    commercialUse: 'conditional',
  },
  {
    pattern: /\bgemma terms of use\b|\bgemma\b.*\bterms\b/i,
    spdx: 'Gemma-Terms',
    class: 'community',
    commercialUse: 'conditional',
  },
  { pattern: /\bopenrail\b/i, spdx: 'OpenRAIL', class: 'community', commercialUse: 'conditional' },
  {
    pattern: /\ball rights reserved\b|\bproprietary\b|\bconfidential\b/i,
    spdx: null,
    class: 'proprietary',
    commercialUse: 'not-established',
  },
];

class GgufReader {
  private offset = 0;
  constructor(
    private readonly bytes: Uint8Array,
    private readonly view: DataView,
    private readonly version: number
  ) {}

  get remaining(): number {
    return this.bytes.byteLength - this.offset;
  }

  private require(size: number): void {
    if (size < 0 || this.offset + size > this.bytes.byteLength) throw new Error('GGUF_TRUNCATED');
  }

  u8(): number {
    this.require(1);
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }
  u16(): number {
    this.require(2);
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }
  u32(): number {
    this.require(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }
  i8(): number {
    this.require(1);
    const v = this.view.getInt8(this.offset);
    this.offset += 1;
    return v;
  }
  i16(): number {
    this.require(2);
    const v = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return v;
  }
  i32(): number {
    this.require(4);
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }
  f32(): number {
    this.require(4);
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }
  f64(): number {
    this.require(8);
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }

  u64(): number {
    this.require(8);
    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('GGUF_INTEGER_UNSAFE');
    return Number(value);
  }

  i64(): number {
    this.require(8);
    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))
      throw new Error('GGUF_INTEGER_UNSAFE');
    return Number(value);
  }

  length(): number {
    return this.version === 1 ? this.u32() : this.u64();
  }

  string(): string {
    const length = this.length();
    if (length < 0 || length > MAX_STRING_BYTES) throw new Error('GGUF_STRING_TOO_LARGE');
    this.require(length);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(
      this.bytes.subarray(this.offset, this.offset + length)
    );
    this.offset += length;
    return text;
  }

  scalar(type: number): string | number | boolean {
    switch (type) {
      case 0:
        return this.u8();
      case 1:
        return this.i8();
      case 2:
        return this.u16();
      case 3:
        return this.i16();
      case 4:
        return this.u32();
      case 5:
        return this.i32();
      case 6:
        return this.f32();
      case 7:
        return this.u8() !== 0;
      case 8:
        return this.string();
      case 10:
        return this.u64();
      case 11:
        return this.i64();
      case 12:
        return this.f64();
      default:
        throw new Error('GGUF_VALUE_TYPE_UNKNOWN');
    }
  }

  /** Parses one value to advance the cursor; arrays are validated but not retained. */
  value(type: number, depth = 0): string | number | boolean | null {
    if (type !== 9) return this.scalar(type);
    if (depth > 0) throw new Error('GGUF_NESTED_ARRAY_REJECTED');
    const elementType = this.u32();
    if (elementType > 12 || elementType === 9) throw new Error('GGUF_ARRAY_ELEMENT_INVALID');
    const length = this.length();
    if (length < 0 || length > MAX_ARRAY_ITEMS) throw new Error('GGUF_ARRAY_TOO_LARGE');
    // Tokenizer vocabularies are the common large array. Stop before walking
    // millions of entries; the header window is reported as partial instead.
    if (length > 4_096) throw new Error('GGUF_ARRAY_FAST_STOP');
    for (let i = 0; i < length; i += 1) this.scalar(elementType);
    return null;
  }
}

/**
 * Parses the GGUF header and as much metadata as fits in `bytes`. Truncated
 * metadata is reported as incomplete, not as a corrupt model, because callers may
 * deliberately pass a bounded header window.
 */
export function inspectGgufHeader(bytes: Uint8Array): GgufInspection {
  const findings: ArtifactFinding[] = [];
  const empty: GgufHeaderReport = { magicOk: false, metadata: [], metadataComplete: false };
  if (bytes.byteLength < 8) {
    findings.push({
      code: 'GGUF_TOO_SHORT',
      severity: 'error',
      message: 'El archivo es demasiado pequeño para contener una cabecera GGUF.',
    });
    return { header: empty, findings };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== GGUF_MAGIC) {
    findings.push({
      code: 'GGUF_MAGIC_INVALID',
      severity: 'error',
      message: 'La firma no es GGUF; no se inspeccionan pesos ni metadatos.',
    });
    return { header: empty, findings };
  }
  let offset = 4;
  if (bytes.byteLength < offset + 4) {
    findings.push({
      code: 'GGUF_VERSION_TRUNCATED',
      severity: 'error',
      message: 'Falta la versión GGUF.',
    });
    return { header: { ...empty, magicOk: true }, findings };
  }
  const version = view.getUint32(offset, true);
  offset += 4;
  if (version !== 1 && version !== 2 && version !== 3) {
    findings.push({
      code: 'GGUF_VERSION_UNSUPPORTED',
      severity: 'error',
      message: `Versión GGUF ${version} no soportada (1, 2 o 3).`,
    });
    return { header: { ...empty, magicOk: true, version }, findings };
  }
  const readerBytes = bytes.subarray(offset);
  const readerView = new DataView(
    readerBytes.buffer,
    readerBytes.byteOffset,
    readerBytes.byteLength
  );
  const reader = new GgufReader(readerBytes, readerView, version);
  let tensorCount: number;
  let kvCount: number;
  try {
    tensorCount = version === 1 ? reader.u32() : reader.u64();
    kvCount = version === 1 ? reader.u32() : reader.u64();
  } catch {
    findings.push({
      code: 'GGUF_HEADER_TRUNCATED',
      severity: 'error',
      message: 'La cabecera termina antes de los contadores de tensores/metadatos.',
    });
    return { header: { ...empty, magicOk: true, version }, findings };
  }
  if (tensorCount > MAX_TENSORS || kvCount > MAX_KV) {
    findings.push({
      code: 'GGUF_COUNTS_IMPLAUSIBLE',
      severity: 'error',
      message: 'Los contadores declaran más tensores o entradas de las permitidas.',
    });
  }
  const metadata: GgufMetadataEntry[] = [];
  const known: Record<string, string | number | boolean> = {};
  let metadataComplete = true;
  let index = 0;
  try {
    for (; index < kvCount; index += 1) {
      if (reader.remaining < 16) {
        metadataComplete = false;
        break;
      }
      if (metadata.length >= MAX_METADATA_ENTRIES) {
        metadataComplete = false;
        findings.push({
          code: 'GGUF_METADATA_LIMIT',
          severity: 'warning',
          message: 'Se alcanzó el límite de metadatos retenidos.',
        });
        break;
      }
      const key = reader.string();
      const type = reader.u32();
      if (type > 12) throw new Error('GGUF_VALUE_TYPE_UNKNOWN');
      const typeName = VALUE_TYPE_NAMES[type] ?? 'unknown';
      const value = reader.value(type);
      metadata.push({ key, type: typeName, value });
      if (
        key === 'general.architecture' ||
        key === 'general.name' ||
        key === 'general.license' ||
        key === 'tokenizer.ggml.model'
      ) {
        if (typeof value === 'string') known[key] = value;
      }
      if (key === 'general.file_type' || key === 'split.count' || key === 'split.no') {
        if (typeof value === 'number') known[key] = value;
      }
    }
  } catch {
    metadataComplete = false;
  }
  if (!metadataComplete && findings.every((finding) => finding.code !== 'GGUF_METADATA_LIMIT')) {
    findings.push({
      code: 'GGUF_HEADER_WINDOW_TRUNCATED',
      severity: 'warning',
      message:
        'La ventana de cabecera no contiene todos los metadatos; el archivo no se declara corrupto por ello.',
    });
  }
  const header: GgufHeaderReport = {
    magicOk: true,
    version,
    tensorCount,
    kvCount,
    ...(typeof known['general.architecture'] === 'string'
      ? { architecture: known['general.architecture'] }
      : {}),
    ...(typeof known['general.name'] === 'string' ? { name: known['general.name'] } : {}),
    ...(typeof known['general.license'] === 'string' ? { license: known['general.license'] } : {}),
    ...(typeof known['general.file_type'] === 'number'
      ? { fileType: known['general.file_type'] }
      : {}),
    ...(typeof known['split.count'] === 'number' ? { splitCount: known['split.count'] } : {}),
    ...(typeof known['split.no'] === 'number' ? { splitIndex: known['split.no'] } : {}),
    ...(typeof known['tokenizer.ggml.model'] === 'string'
      ? { tokenizerModel: known['tokenizer.ggml.model'] }
      : {}),
    metadata,
    metadataComplete,
  };
  return { header, findings };
}

const SPDX_IDS: Readonly<
  Record<string, { spdx: string; class: LicenseClass; commercialUse: CommercialUse }>
> = {
  mit: { spdx: 'MIT', class: 'permissive', commercialUse: 'allowed' },
  'apache-2.0': { spdx: 'Apache-2.0', class: 'permissive', commercialUse: 'allowed' },
  'bsd-2-clause': { spdx: 'BSD-2-Clause', class: 'permissive', commercialUse: 'allowed' },
  'bsd-3-clause': { spdx: 'BSD-3-Clause', class: 'permissive', commercialUse: 'allowed' },
  isc: { spdx: 'ISC', class: 'permissive', commercialUse: 'allowed' },
  'cc0-1.0': { spdx: 'CC0-1.0', class: 'permissive', commercialUse: 'allowed' },
  'cc-by-4.0': { spdx: 'CC-BY-4.0', class: 'permissive', commercialUse: 'allowed' },
  'cc-by-sa-4.0': { spdx: 'CC-BY-SA-4.0', class: 'copyleft', commercialUse: 'conditional' },
  'agpl-3.0': { spdx: 'AGPL-3.0', class: 'copyleft', commercialUse: 'conditional' },
  'gpl-3.0': { spdx: 'GPL-3.0', class: 'copyleft', commercialUse: 'conditional' },
  'gpl-2.0': { spdx: 'GPL-2.0', class: 'copyleft', commercialUse: 'conditional' },
  'lgpl-3.0': { spdx: 'LGPL-3.0', class: 'copyleft', commercialUse: 'conditional' },
  'mpl-2.0': { spdx: 'MPL-2.0', class: 'copyleft', commercialUse: 'conditional' },
  'llama-community': { spdx: 'Llama-Community', class: 'community', commercialUse: 'conditional' },
  'gemma-terms': { spdx: 'Gemma-Terms', class: 'community', commercialUse: 'conditional' },
  openrail: { spdx: 'OpenRAIL', class: 'community', commercialUse: 'conditional' },
};

function classifyLicense(text: string | null): {
  spdx: string | null;
  class: LicenseClass;
  commercialUse: CommercialUse;
} {
  if (!text) return { spdx: null, class: 'unknown', commercialUse: 'not-established' };
  const direct =
    SPDX_IDS[
      text
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
    ];
  if (direct) return direct;
  for (const rule of LICENSE_RULES) {
    if (rule.pattern.test(text))
      return { spdx: rule.spdx, class: rule.class, commercialUse: rule.commercialUse };
  }
  return { spdx: null, class: 'unknown', commercialUse: 'not-established' };
}

async function resolveInsideRoot(rootDir: string, relativePath: string): Promise<string> {
  if (
    !relativePath ||
    relativePath.includes('\u0000') ||
    path.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }
  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, relativePath);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('PATH_OUTSIDE_ROOT');
  const info = await lstat(candidate);
  if (info.isSymbolicLink()) throw new Error('SYMLINK_REJECTED');
  if (!info.isFile()) throw new Error('NOT_A_REGULAR_FILE');
  const realRoot = await realpath(root);
  const realCandidate = await realpath(candidate);
  const realRelative = path.relative(realRoot, realCandidate);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative))
    throw new Error('PATH_OUTSIDE_ROOT');
  return realCandidate;
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function readFirstBytes(file: string, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    open(file, 'r')
      .then(async (handle) => {
        try {
          const buffer = Buffer.allocUnsafe(limit);
          const { bytesRead } = await handle.read(buffer, 0, limit, 0);
          resolve(buffer.subarray(0, bytesRead));
        } finally {
          await handle.close();
        }
      })
      .catch(reject);
  });
}

function validateManifest(value: unknown): {
  manifest: ModelManifest | null;
  findings: ArtifactFinding[];
} {
  const findings: ArtifactFinding[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      manifest: null,
      findings: [
        {
          code: 'MANIFEST_INVALID',
          severity: 'error',
          message: 'El manifiesto debe ser un objeto JSON.',
        },
      ],
    };
  }
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  if (!/^[\w.-]{1,128}$/.test(id))
    findings.push({
      code: 'MANIFEST_ID_INVALID',
      severity: 'error',
      message: 'id debe ser un identificador de 1–128 caracteres [A-Za-z0-9_.-].',
    });
  const filesRaw = Array.isArray(candidate.files) ? candidate.files : [];
  if (filesRaw.length === 0 || filesRaw.length > 256)
    findings.push({
      code: 'MANIFEST_FILES_INVALID',
      severity: 'error',
      message: 'files debe contener entre 1 y 256 entradas.',
    });
  const files: ModelManifestFile[] = [];
  for (const entry of filesRaw.slice(0, 256)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const filePath = typeof record.path === 'string' ? record.path.trim() : '';
    if (!filePath || path.isAbsolute(filePath) || filePath.split(/[\\/]/).includes('..')) {
      findings.push({
        code: 'MANIFEST_FILE_PATH_INVALID',
        severity: 'error',
        message: 'Cada files[].path debe ser relativo y no puede escapar del directorio raíz.',
      });
      continue;
    }
    const sha256 = typeof record.sha256 === 'string' ? record.sha256.toLowerCase() : undefined;
    if (sha256 !== undefined && !SHA256_RE.test(sha256))
      findings.push({
        code: 'MANIFEST_HASH_INVALID',
        severity: 'error',
        message: `Hash inválido para ${filePath}.`,
      });
    const bytes =
      typeof record.bytes === 'number' && Number.isInteger(record.bytes) && record.bytes >= 0
        ? record.bytes
        : undefined;
    files.push({
      path: filePath,
      ...(sha256 ? { sha256 } : {}),
      ...(bytes !== undefined ? { bytes } : {}),
    });
  }
  const provenance =
    candidate.provenance && typeof candidate.provenance === 'object'
      ? (candidate.provenance as Record<string, unknown>)
      : {};
  const sourceUrl = typeof provenance.sourceUrl === 'string' ? provenance.sourceUrl : undefined;
  if (sourceUrl && !/^https:\/\//i.test(sourceUrl))
    findings.push({
      code: 'MANIFEST_PROVENANCE_INSECURE',
      severity: 'error',
      message: 'provenance.sourceUrl debe usar HTTPS.',
    });
  const manifest: ModelManifest = {
    id,
    ...(typeof candidate.version === 'string' ? { version: candidate.version.slice(0, 64) } : {}),
    ...(typeof candidate.license === 'string' ? { license: candidate.license.slice(0, 128) } : {}),
    ...(typeof candidate.architecture === 'string'
      ? { architecture: candidate.architecture.slice(0, 64) }
      : {}),
    ...(typeof candidate.contextWindow === 'number' &&
    Number.isInteger(candidate.contextWindow) &&
    candidate.contextWindow > 0
      ? { contextWindow: candidate.contextWindow }
      : {}),
    files,
    ...(sourceUrl
      ? {
          provenance: {
            sourceUrl,
            ...(typeof provenance.retrievedAt === 'string'
              ? { retrievedAt: provenance.retrievedAt }
              : {}),
            ...(typeof provenance.publisher === 'string'
              ? { publisher: provenance.publisher }
              : {}),
          },
        }
      : {}),
  };
  return { manifest, findings };
}

/**
 * Inspects a local artifact inside a bounded root. Never throws for a bad artifact;
 * returns findings. Programming errors (missing root) are reported the same way.
 */
export async function inspectModelArtifact(
  options: ModelArtifactOptions
): Promise<ModelArtifactReport> {
  const findings: ArtifactFinding[] = [];
  const maxBytes = Number.isFinite(options.maxBytes)
    ? Math.max(
        1,
        Math.min(DEFAULT_MAX_BYTES * 4, Math.trunc(options.maxBytes ?? DEFAULT_MAX_BYTES))
      )
    : DEFAULT_MAX_BYTES;
  const headerBytes = Number.isFinite(options.headerBytes)
    ? Math.max(
        4_096,
        Math.min(64 * 1024 * 1024, Math.trunc(options.headerBytes ?? DEFAULT_HEADER_BYTES))
      )
    : DEFAULT_HEADER_BYTES;
  const emptyReport = (size = 0): ModelArtifactReport => ({
    ok: false,
    authority: 'NONE',
    productionApproved: false,
    artifact: { path: options.relativePath, sizeBytes: size, sha256: null, sha256Computed: false },
    gguf: null,
    license: {
      declared: null,
      spdx: null,
      class: 'unknown',
      commercialUse: 'not-established',
      source: 'none',
    },
    manifest: null,
    findings,
  });

  let artifactPath: string;
  try {
    artifactPath = await resolveInsideRoot(options.rootDir, options.relativePath);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ARTIFACT_PATH_INVALID';
    findings.push({
      code,
      severity: 'error',
      message: 'El artefacto no es un archivo regular dentro del directorio raíz permitido.',
    });
    return emptyReport();
  }

  let sizeBytes = 0;
  try {
    const info = await stat(artifactPath);
    sizeBytes = info.size;
    if (sizeBytes <= 0)
      findings.push({
        code: 'ARTIFACT_EMPTY',
        severity: 'error',
        message: 'El archivo está vacío.',
      });
    if (sizeBytes > maxBytes)
      findings.push({
        code: 'ARTIFACT_TOO_LARGE',
        severity: 'error',
        message: `El archivo excede el límite de ${maxBytes} bytes.`,
      });
  } catch {
    findings.push({
      code: 'ARTIFACT_STAT_FAILED',
      severity: 'error',
      message: 'No se pudo leer el tamaño del artefacto.',
    });
    return emptyReport();
  }

  let headerBytesBuffer: Buffer = Buffer.alloc(0);
  try {
    headerBytesBuffer = await readFirstBytes(
      artifactPath,
      Math.min(headerBytes, Math.max(1, sizeBytes))
    );
  } catch {
    findings.push({
      code: 'ARTIFACT_READ_FAILED',
      severity: 'error',
      message: 'No se pudo leer la cabecera del artefacto.',
    });
  }
  const ggufInspection =
    headerBytesBuffer.byteLength > 0 ? inspectGgufHeader(headerBytesBuffer) : null;
  if (ggufInspection) findings.push(...ggufInspection.findings);
  if (!ggufInspection?.header.magicOk) {
    findings.push({
      code: 'UNSUPPORTED_ARTIFACT_FORMAT',
      severity: 'error',
      message: 'Solo se valida el contenedor GGUF; otros formatos requieren su propio inspector.',
    });
  }

  let sha256: string | null = null;
  let sha256Computed = false;
  if (options.hash !== false) {
    try {
      sha256 = await sha256File(artifactPath);
      sha256Computed = true;
    } catch {
      findings.push({
        code: 'ARTIFACT_HASH_FAILED',
        severity: 'error',
        message: 'No se pudo calcular SHA-256.',
      });
    }
  } else {
    findings.push({
      code: 'ARTIFACT_HASH_SKIPPED',
      severity: 'warning',
      message: 'Hash omitido por decisión explícita; el artefacto no está verificado.',
    });
  }

  let manifest: ModelArtifactReport['manifest'] = null;
  let manifestLicense: string | null = null;
  if (options.manifestPath) {
    try {
      const manifestPath = await resolveInsideRoot(options.rootDir, options.manifestPath);
      const manifestInfo = await stat(manifestPath);
      if (manifestInfo.size > MAX_MANIFEST_BYTES) {
        findings.push({
          code: 'MANIFEST_TOO_LARGE',
          severity: 'error',
          message: 'El manifiesto excede 512 KiB.',
        });
        manifest = { path: options.manifestPath, valid: false };
      } else {
        const raw = await readFile(manifestPath, 'utf8');
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          findings.push({
            code: 'MANIFEST_JSON_INVALID',
            severity: 'error',
            message: 'El manifiesto no es JSON válido.',
          });
          parsed = null;
        }
        const validated = validateManifest(parsed);
        findings.push(...validated.findings);
        const valid =
          validated.manifest !== null &&
          validated.findings.every((finding) => finding.severity !== 'error');
        manifest = {
          path: options.manifestPath,
          valid,
          ...(validated.manifest?.id ? { id: validated.manifest.id } : {}),
          ...(validated.manifest?.version ? { version: validated.manifest.version } : {}),
        };
        manifestLicense = validated.manifest?.license ?? null;
        const matching = validated.manifest?.files.find(
          (file) => file.path.replace(/\\/g, '/') === options.relativePath.replace(/\\/g, '/')
        );
        if (matching?.sha256 && sha256 && matching.sha256 !== sha256) {
          findings.push({
            code: 'MANIFEST_HASH_MISMATCH',
            severity: 'error',
            message: 'El SHA-256 no coincide con el declarado en el manifiesto.',
          });
        }
        if (matching?.bytes !== undefined && matching.bytes !== sizeBytes) {
          findings.push({
            code: 'MANIFEST_SIZE_MISMATCH',
            severity: 'error',
            message: 'El tamaño no coincide con el declarado en el manifiesto.',
          });
        }
        if (matching?.sha256 && !sha256Computed) {
          findings.push({
            code: 'MANIFEST_HASH_UNVERIFIED',
            severity: 'warning',
            message: 'El manifiesto declara un hash que no se calculó en esta inspección.',
          });
        }
      }
    } catch {
      findings.push({
        code: 'MANIFEST_READ_FAILED',
        severity: 'error',
        message: 'No se pudo leer el manifiesto dentro de la raíz.',
      });
      manifest = { path: options.manifestPath, valid: false };
    }
  }

  let declared = manifestLicense ?? ggufInspection?.header.license ?? null;
  let licenseSource: ModelArtifactReport['license']['source'] = manifestLicense
    ? 'manifest'
    : ggufInspection?.header.license
      ? 'gguf'
      : 'none';
  if (!declared) {
    for (const name of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING']) {
      try {
        const licensePath = await resolveInsideRoot(
          options.rootDir,
          path.join(path.dirname(options.relativePath), name)
        );
        const text = (await readFile(licensePath, 'utf8')).slice(0, 16_384);
        if (text.trim()) {
          declared = text;
          licenseSource = 'license-file';
          break;
        }
      } catch {
        // A missing neighbor license is normal; try the next conventional name.
      }
    }
  }
  const license = classifyLicense(declared);
  if (license.class === 'unknown') {
    findings.push({
      code: 'LICENSE_UNKNOWN',
      severity: 'warning',
      message:
        'No se pudo establecer una licencia compatible; el uso comercial queda como no establecido.',
    });
  } else if (license.commercialUse !== 'allowed') {
    findings.push({
      code: 'LICENSE_REVIEW_REQUIRED',
      severity: 'warning',
      message: `Licencia ${license.spdx ?? license.class}: revisión humana requerida antes de uso comercial.`,
    });
  }

  const hasError = findings.some((finding) => finding.severity === 'error');
  return {
    ok: !hasError && Boolean(ggufInspection?.header.magicOk),
    authority: 'NONE',
    productionApproved: false,
    artifact: { path: options.relativePath, sizeBytes, sha256, sha256Computed },
    gguf: ggufInspection?.header ?? null,
    license: {
      declared: declared && declared.length > 200 ? declared.slice(0, 200) : declared,
      ...license,
      source: licenseSource,
    },
    manifest,
    findings,
  };
}
