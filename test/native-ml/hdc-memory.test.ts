// state: draft | engine-generated
import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { IsabellaMemoryCore } from '../../src/lib/native-ml/memory-core';
import {
  HierarchicalMemoryCore,
  type MemoryChunk,
} from '../../src/lib/native-ml/memory-hierarchical';
import { deserialize, serializeToText } from '../../src/lib/native-ml/serde';
import type { MemoryCoreSnapshot } from '../../src/lib/native-ml/memory-hierarchical';

const seed = 'test-territory-hdc';

function core(): IsabellaMemoryCore {
  return new IsabellaMemoryCore({ dimension: 512, seed });
}

function chunk(over: Partial<MemoryChunk> = {}): MemoryChunk {
  return {
    chunkId: over.chunkId ?? 'chunk-1',
    documentId: over.documentId ?? 'doc-1',
    territoryId: over.territoryId ?? 'rdm-real-del-monte',
    text: over.text ?? 'patrimonio minero real del monte túneles de adit',
    authority: over.authority ?? 'institutional',
    sensitivity: over.sensitivity ?? 'public',
    language: over.language ?? 'es-MX',
    level: over.level ?? 'semantic',
    sourceUri: over.sourceUri,
    validFrom: over.validFrom,
    validUntil: over.validUntil,
  };
}

describe('native-ml · HDC/VSA memory core determinism', () => {
  it('encodes identical text to an identical, reproducible hypervector', () => {
    const a = core().encode('turismo cultura real del monte');
    const b = core().encode('turismo cultura real del monte');
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(core().hashVector(a)).toBe(core().hashVector(b));
  });

  it('produces unit-length vectors and rejects bad dimensions / non-finite input', () => {
    const m = core();
    const v = m.encode('clustering edge memoria');
    const norm = Math.sqrt(Array.from(v).reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 4);
    expect(() => new IsabellaMemoryCore({ dimension: 3, seed })).toThrow(/invalid_hyper_dimension/);
    const bad = new Float64Array(512);
    bad[0] = Number.NaN;
    expect(() => m.similarity(bad, v)).toThrow(/non_finite_hypervector/);
    expect(() => m.bind(new Float64Array(64), v)).toThrow(/hyper_dimension_mismatch/);
  });

  it('bind/unbind is an inverse pair (associative recall recovers the subject)', () => {
    const m = core();
    const query = m.encode('mineria');
    const subject = m.encode('tuneles de adit patrimonio');
    const composite = m.bind(query, subject);
    const recovered = m.unbind(query, composite);
    expect(m.similarity(recovered, subject)).toBeGreaterThan(0.5);
    expect(m.similarity(recovered, query)).toBeLessThan(0.5);
  });

  it('bundle raises similarity to constituents', () => {
    const m = core();
    const v1 = m.encode('comercio local');
    const v2 = m.encode('mercado artesanal');
    const bundled = m.bundle([v1, v2]);
    expect(m.similarity(bundled, v1)).toBeGreaterThan(0.3);
    expect(m.similarity(bundled, v2)).toBeGreaterThan(0.3);
  });
});

describe('native-ml · encrypted memory state', () => {
  it('round-trips a state through AES-256-GCM with an authenticated envelope', () => {
    const secret = randomBytes(32);
    const m = new IsabellaMemoryCore({ dimension: 512, seed, masterSecret: secret });
    const vector = m.encode('memoria cifrada territorial');
    const envelope = m.encryptState(vector);
    const back = m.decryptState(envelope);
    expect(m.similarity(back, vector)).toBeCloseTo(1, 6);
    expect(m.keyRef()).toMatch(/^sha256:/);
  });

  it('refuses tampered ciphertext, iv, auth tag or a mismatched key', () => {
    const secret = randomBytes(32);
    const m = new IsabellaMemoryCore({ dimension: 512, seed, masterSecret: secret });
    const envelope = m.encryptState(m.encode('integridad'));
    const tamper = (patch: Partial<typeof envelope>) =>
      expect(() => m.decryptState({ ...envelope, ...patch })).toThrow();
    tamper({ ciphertext: Buffer.from('00'.repeat(64)).toString('base64') });
    tamper({ hmacSignature: '0'.repeat(64) });
    const other = new IsabellaMemoryCore({ dimension: 512, seed, masterSecret: randomBytes(32) });
    expect(() => other.decryptState(envelope)).toThrow();
  });

  it('requires a strong master secret and fails closed without keys', () => {
    expect(
      () => new IsabellaMemoryCore({ dimension: 512, seed, masterSecret: randomBytes(4) })
    ).toThrow(/weak_master_secret/);
    expect(() => core().encryptState(core().encode('x'))).toThrow(/memory_keys_unavailable/);
  });
});

describe('native-ml · governed hierarchical memory', () => {
  it('writes a chunk, seals provenance, and recalls by HDC similarity', async () => {
    const mem = new HierarchicalMemoryCore(core(), 'rdm-real-del-monte');
    const rec = mem.write(chunk());
    expect(rec.vectorHash).toMatch(/^[0-9a-f]{64}$/);
    expect(mem.size()).toBe(1);
    const hits = await mem.read('patrimonio minero tuneles');
    expect(hits[0]?.chunkId).toBe('chunk-1');
    expect(hits[0]?.score).toBeGreaterThan(0.05);
    expect(mem.ledger.verifyChain()).toBe(true);
    expect(mem.ledger.size()).toBeGreaterThanOrEqual(1);
  });

  it('never discloses sensitive source URIs on recall', async () => {
    const mem = new HierarchicalMemoryCore(core(), 'rdm-real-del-monte');
    mem.write(chunk({ sensitivity: 'sensitive', sourceUri: 'https://internal/secret' }));
    const hits = await mem.read('patrimonio minero');
    expect(hits[0]?.sensitivity).toBe('sensitive');
    expect(hits[0]?.sourceUri).toBeUndefined();
  });

  it('fails closed when the policy hook denies a read', async () => {
    const mem = new HierarchicalMemoryCore(core(), 'rdm-real-del-monte', {
      authorize: () => ({
        decision: 'DENY',
        riskScore: 0.9,
        policyIds: ['tamv-sovereign-v1'],
        reasons: ['territory lock'],
      }),
    });
    mem.write(chunk());
    await expect(mem.read('patrimonio')).rejects.toThrow(/memory_read_deny/);
  });

  it('rejects foreign-territory, duplicate, oversized and invalid chunks', () => {
    const mem = new HierarchicalMemoryCore(core(), 'rdm-real-del-monte');
    expect(() => mem.write(chunk({ territoryId: 'other' }))).toThrow(/memory_territory_mismatch/);
    mem.write(chunk());
    expect(() => mem.write(chunk())).toThrow(/memory_chunk_exists/);
    expect(() => mem.write(chunk({ chunkId: 'c2', text: 'x'.repeat(5000) }))).toThrow(
      /memory_chunk_too_large/
    );
    expect(() => mem.write(chunk({ chunkId: 'c3', authority: 'bogus' as never }))).toThrow(
      /memory_authority_invalid/
    );
  });

  it('skips expired chunks during recall', async () => {
    const mem = new HierarchicalMemoryCore(core(), 'rdm-real-del-monte');
    mem.write(chunk({ validUntil: '2000-01-01T00:00:00.000Z' }));
    expect(await mem.read('patrimonio minero')).toHaveLength(0);
  });

  it('supports auditable associate/dissociate and state round-trip', async () => {
    const mem = new HierarchicalMemoryCore(core(), 'rdm-real-del-monte');
    mem.write(chunk());
    const { composite, hash } = mem.associate('mineria', 'chunk-1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const recovered = mem.dissociate('mineria', composite);
    const original = core().encode(chunk().text);
    expect(core().similarity(recovered, original)).toBeGreaterThan(0.5);

    const snapshot = mem.exportState();
    const parsed = deserialize<MemoryCoreSnapshot>(snapshot);
    expect(parsed.format).toBe('isabella.native-memory.v1');
    const { memory: reloaded } = HierarchicalMemoryCore.importState(snapshot, {
      seed,
      dimension: 512,
    });
    expect(reloaded.size()).toBe(1);
    const hits = await reloaded.read('patrimonio minero tuneles');
    expect(hits[0]?.chunkId).toBe('chunk-1');
  });

  it('refuses a tampered imported vector', () => {
    const mem = new HierarchicalMemoryCore(core(), 'rdm-real-del-monte');
    mem.write(chunk());
    const body = deserialize<MemoryCoreSnapshot>(mem.exportState());
    // Flip the last byte of one vector; the re-serialized envelope is a valid
    // checksum, so import must fail on the vector-hash binding, not the envelope.
    const records = body.records.map((r) => ({
      ...r,
      vectorHex: r.vectorHex.slice(0, -2) + 'ff',
    }));
    const tampered = serializeToText({ ...body, records });
    expect(() =>
      HierarchicalMemoryCore.importState(tampered, { seed, dimension: 512 })
    ).toThrow(/memory_vector_tampered/);
  });
});
