import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectGgufHeader, inspectModelArtifact } from '../../src/inference/open-model-artifact';

const scratch: string[] = [];

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'isabella-gguf-'));
  scratch.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function u32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function u64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function ggufString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([u64(bytes.length), bytes]);
}

function kvString(key: string, value: string): Buffer {
  return Buffer.concat([ggufString(key), u32(8), ggufString(value)]);
}

function gguf(entries: Buffer[], declaredCount = entries.length): Buffer {
  return Buffer.concat([Buffer.from('GGUF'), u32(3), u64(0), u64(declaredCount), ...entries]);
}

const VALID = gguf([
  kvString('general.architecture', 'llama'),
  kvString('general.name', 'demo-model'),
  kvString('general.license', 'MIT'),
  kvString('tokenizer.ggml.model', 'gpt2'),
]);

describe('inspectGgufHeader', () => {
  it('parses a v3 header and known metadata without loading tensors', () => {
    const result = inspectGgufHeader(VALID);
    expect(result.findings).toEqual([]);
    expect(result.header).toMatchObject({
      magicOk: true,
      version: 3,
      tensorCount: 0,
      kvCount: 4,
      architecture: 'llama',
      name: 'demo-model',
      license: 'MIT',
      tokenizerModel: 'gpt2',
      metadataComplete: true,
    });
    expect(result.header.metadata).toHaveLength(4);
  });

  it('rejects a non-GGUF signature and a truncated version', () => {
    const foreign = inspectGgufHeader(Buffer.from('not a gguf file at all'));
    expect(foreign.header.magicOk).toBe(false);
    expect(foreign.findings.map((finding) => finding.code)).toContain('GGUF_MAGIC_INVALID');

    const short = inspectGgufHeader(Buffer.from([0x47, 0x47, 0x55]));
    expect(short.findings.map((finding) => finding.code)).toContain('GGUF_TOO_SHORT');
  });

  it('rejects unsupported versions', () => {
    const bytes = Buffer.concat([Buffer.from('GGUF'), u32(99), u64(0), u64(0)]);
    expect(inspectGgufHeader(bytes).findings.map((finding) => finding.code)).toContain(
      'GGUF_VERSION_UNSUPPORTED'
    );
  });

  it('fast-stops a huge vocabulary array and reports the window as incomplete, not corrupt', () => {
    const arrayHeader = Buffer.concat([
      ggufString('tokenizer.ggml.tokens'),
      u32(9),
      u32(8),
      u64(5_000),
    ]);
    const result = inspectGgufHeader(gguf([arrayHeader]));
    expect(result.header.magicOk).toBe(true);
    expect(result.header.metadataComplete).toBe(false);
    expect(result.findings.some((finding) => finding.code === 'GGUF_HEADER_WINDOW_TRUNCATED')).toBe(
      true
    );
  });

  it('reports a bounded window as incomplete instead of corrupting the verdict', () => {
    const result = inspectGgufHeader(VALID.subarray(0, 24));
    expect(result.header.magicOk).toBe(true);
    expect(result.header.metadataComplete).toBe(false);
    expect(result.findings.every((finding) => finding.severity === 'warning')).toBe(true);
  });
});

describe('inspectModelArtifact', () => {
  it('verifies GGUF structure, SHA-256, size and manifest provenance', async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, 'model.gguf'), VALID);
    const sha256 = createHash('sha256').update(VALID).digest('hex');
    await writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        id: 'demo-model',
        version: '1.0.0',
        license: 'MIT',
        architecture: 'llama',
        files: [{ path: 'model.gguf', sha256, bytes: VALID.length }],
        provenance: { sourceUrl: 'https://huggingface.co/example/demo-model' },
      })
    );

    const report = await inspectModelArtifact({
      rootDir: dir,
      relativePath: 'model.gguf',
      manifestPath: 'manifest.json',
    });
    expect(report.ok).toBe(true);
    expect(report.authority).toBe('NONE');
    expect(report.productionApproved).toBe(false);
    expect(report.artifact.sha256).toBe(sha256);
    expect(report.artifact.sha256Computed).toBe(true);
    expect(report.gguf?.architecture).toBe('llama');
    expect(report.manifest).toMatchObject({ valid: true, id: 'demo-model', version: '1.0.0' });
    expect(report.license).toMatchObject({
      spdx: 'MIT',
      class: 'permissive',
      commercialUse: 'allowed',
      source: 'manifest',
    });
  });

  it('rejects traversal and absolute paths before reading anything', async () => {
    const dir = await makeDir();
    const traversal = await inspectModelArtifact({ rootDir: dir, relativePath: '../escape.gguf' });
    expect(traversal.ok).toBe(false);
    expect(traversal.findings.map((finding) => finding.code)).toContain('PATH_OUTSIDE_ROOT');

    const absolute = await inspectModelArtifact({
      rootDir: dir,
      relativePath: path.join(dir, 'model.gguf'),
    });
    expect(absolute.ok).toBe(false);
    expect(absolute.findings.map((finding) => finding.code)).toContain('PATH_OUTSIDE_ROOT');
  });

  it('flags a manifest hash mismatch and a size mismatch', async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, 'model.gguf'), VALID);
    await writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        id: 'demo-model',
        license: 'MIT',
        files: [{ path: 'model.gguf', sha256: '0'.repeat(64), bytes: VALID.length + 10 }],
      })
    );
    const report = await inspectModelArtifact({
      rootDir: dir,
      relativePath: 'model.gguf',
      manifestPath: 'manifest.json',
    });
    expect(report.ok).toBe(false);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('MANIFEST_HASH_MISMATCH');
    expect(codes).toContain('MANIFEST_SIZE_MISMATCH');
  });

  it('classifies a sibling LICENSE file and refuses to call commercial use established', async () => {
    const dir = await makeDir();
    const noLicense = gguf([kvString('general.architecture', 'llama')]);
    await writeFile(path.join(dir, 'model.gguf'), noLicense);
    await writeFile(
      path.join(dir, 'LICENSE'),
      'GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007'
    );

    const report = await inspectModelArtifact({
      rootDir: dir,
      relativePath: 'model.gguf',
      hash: false,
    });
    expect(report.artifact.sha256).toBeNull();
    expect(report.artifact.sha256Computed).toBe(false);
    expect(report.license).toMatchObject({
      spdx: 'AGPL-3.0',
      class: 'copyleft',
      commercialUse: 'conditional',
      source: 'license-file',
    });
    expect(report.findings.map((finding) => finding.code)).toContain('LICENSE_REVIEW_REQUIRED');
    expect(report.findings.map((finding) => finding.code)).toContain('ARTIFACT_HASH_SKIPPED');
  });

  it('refuses to treat a non-GGUF file as a validated model', async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, 'model.bin'), 'this is not a model container');
    const report = await inspectModelArtifact({ rootDir: dir, relativePath: 'model.bin' });
    expect(report.ok).toBe(false);
    expect(report.gguf?.magicOk).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain('UNSUPPORTED_ARTIFACT_FORMAT');
  });
});
