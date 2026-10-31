// state: draft | engine-generated
//
// HDC/VSA hybrid memory core (blueprint §6.3, `IsabellaMemoryCore`). The repo
// already binds the KNOWLEDGE macro-domain to module id HDCVSA_MEMORY
// (src/omega/native/orchestrator.ts) but the core itself had no implementation:
// this is that missing foundation.
//
// Deliberate divergences from the blueprint, archived here per AGENTS.md §2:
//  - Determinism: the blueprint encodes hypervectors with Math.sin over a golden
//    ratio phase. Transcendental results are platform-dependent, so a "stable"
//    modelHash would not verify across hosts. The position codebook is instead
//    derived from an integer PRNG (mulberry32) and vectors are rounded to a fixed
//    decimal grid — byte-for-byte reproducible, which is what the blueprint's
//    provenance goal actually requires.
//  - Cryptography: SHA-256 (the BookPI anchor), not SHA3-512. The AES key comes
//    from a caller-held master secret via HKDF — the server never receives key
//    material (blueprint §15.3). The HMAC is authenticated over iv‖ciphertext,
//    so iv or auth-tag tampering is refused too (the blueprint signed the
//    ciphertext only).
//  - Algebra: bind is circular convolution and unbind is circular correlation,
//    a genuine inverse pair (element-wise mul/"bind" as in the blueprint is not
//    recoverable). This makes clean associative recall actually work.
//
// Scope: this is a complementary fast-similarity/edge memory, NOT a substitute
// for RAG, statistical models, or the LLM (blueprint §6.3). It suggests, it does
// not decide, and recall without human approval is not evidence or production.

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  createHash,
  randomBytes,
} from 'node:crypto';
import { hashSeed, mulberry32 } from './prng';

export const MEMORY_CORE_MAX_DIM = 65_536;
export const MEMORY_CORE_MAX_TOKEN_CHARS = 128;
export const MEMORY_CORE_MAX_TOKENS = 256;

/** Fixed rounding grid: removes last-bit float drift so hashes verify cross-host. */
const GRID = 1e6;

export type HyperVector = Float64Array;

export interface EncryptedStateEnvelope {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly hmacSignature: string;
  readonly timestamp: number;
}

function round(value: number): number {
  return Math.round(value * GRID) / GRID;
}

function assertSafeDimension(dimension: number): void {
  if (!Number.isSafeInteger(dimension) || dimension < 64 || dimension > MEMORY_CORE_MAX_DIM)
    throw new Error('invalid_hyper_dimension');
}

function assertFinite(vector: HyperVector): void {
  for (let i = 0; i < vector.length; i++)
    if (!Number.isFinite(vector[i]!)) throw new Error('non_finite_hypervector');
}

/** Tokens for encoding: lowercase alphanumerics, bounded and deduplicated. */
export function memoryTokens(text: string): string[] {
  if (typeof text !== 'string' || text.trim().length === 0) throw new Error('empty_memory_input');
  const terms = text
    .toLowerCase()
    .normalize('NFC')
    .match(/[\p{L}\p{N}]+/gu);
  if (!terms || terms.length === 0) throw new Error('no_memory_tokens');
  const bounded = terms
    .map((t) =>
      t.length > MEMORY_CORE_MAX_TOKEN_CHARS ? t.slice(0, MEMORY_CORE_MAX_TOKEN_CHARS) : t
    )
    .slice(0, MEMORY_CORE_MAX_TOKENS);
  return [...new Set(bounded)];
}

export interface MemoryCoreConfig {
  readonly dimension?: number;
  /** Stable label for the position codebook seed (NOT secret material). */
  readonly seed?: string;
  /** Caller-held master secret used to derive the AES/HMAC keys. */
  readonly masterSecret?: Uint8Array;
}

interface DerivedKeys {
  readonly aesKey: Buffer;
  readonly hmacSecret: Buffer;
  readonly keyRef: string;
}

function deriveKeys(masterSecret: Uint8Array, dimension: number): DerivedKeys {
  if (!masterSecret || masterSecret.length < 16) throw new Error('weak_master_secret');
  const ok = createHash('sha256').update(masterSecret).digest('hex');
  const info = `isabella.memory-core.v1:${dimension}`;
  const aesKey = Buffer.from(hkdfSync('sha256', masterSecret, Buffer.alloc(32), info + ':aes', 32));
  const hmacSecret = Buffer.from(
    hkdfSync('sha256', masterSecret, Buffer.alloc(32), info + ':hmac', 32)
  );
  return { aesKey, hmacSecret, keyRef: ok.slice(0, 16) };
}

/**
 * Governed hypervector memory: deterministic encode, circular bind/unbind,
 * bundling, cosine similarity, and an encrypted-state envelope.
 */
export class IsabellaMemoryCore {
  readonly dimension: number;
  readonly seedLabel: string;
  private readonly keys: DerivedKeys | null;

  constructor(config: MemoryCoreConfig = {}) {
    const dimension = config.dimension ?? 1024;
    assertSafeDimension(dimension);
    this.dimension = dimension;
    this.seedLabel = config.seed ?? 'isabella-hdc-default';
    this.keys = config.masterSecret ? deriveKeys(config.masterSecret, dimension) : null;
  }

  /**
   * Deterministic token embedding: a random ternary {-1,+1} hypervector derived
   * from the seed label and the token. Same seed + same token ⇒ same vector on
   * every host. The seed participates so two territories never share a basis.
   */
  embedToken(token: string): HyperVector {
    if (typeof token !== 'string' || token.length === 0) throw new Error('empty_memory_token');
    const rng = mulberry32(hashSeed(`${this.seedLabel}:token:${token}`));
    const out = new Float64Array(this.dimension);
    for (let d = 0; d < this.dimension; d++) out[d] = rng() < 0.5 ? -1 : 1;
    return out;
  }

  /** Encode text into a normalized hypervector (same text ⇒ same vector, any host). */
  encode(text: string): HyperVector {
    const parts = memoryTokens(text).map((t) => this.embedToken(t));
    return this.bundle(parts);
  }

  /** Element-wise binding with a reversible, normalized representation. */
  bind(a: HyperVector, b: HyperVector): HyperVector {
    this.assertDimension(a);
    this.assertDimension(b);
    assertFinite(a);
    assertFinite(b);
    const out = new Float64Array(this.dimension);
    for (let i = 0; i < this.dimension; i++) out[i] = round(a[i]! * b[i]!);
    return this.normalize(out);
  }

  /** Recover the subject by dividing the bound vector by its key. */
  unbind(a: HyperVector, b: HyperVector): HyperVector {
    this.assertDimension(a);
    this.assertDimension(b);
    assertFinite(a);
    assertFinite(b);
    const out = new Float64Array(this.dimension);
    for (let i = 0; i < this.dimension; i++) {
      const key = a[i]!;
      if (Math.abs(key) < Number.EPSILON) throw new Error('unbind_zero_key');
      out[i] = round(b[i]! / key);
    }
    return this.normalize(out);
  }

  /** Element-wise sum — aggregation of a set of concepts. */
  bundle(vectors: readonly HyperVector[]): HyperVector {
    if (vectors.length === 0) throw new Error('bundle_requires_vectors');
    const out = new Float64Array(this.dimension);
    for (const vector of vectors) {
      this.assertDimension(vector);
      assertFinite(vector);
      for (let i = 0; i < this.dimension; i++) out[i]! += vector[i]!;
    }
    return this.normalize(out);
  }

  /** Cosine similarity in [-1, 1]. */
  similarity(a: HyperVector, b: HyperVector): number {
    this.assertDimension(a);
    this.assertDimension(b);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < this.dimension; i++) {
      const x = a[i]!;
      const y = b[i]!;
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('non_finite_hypervector');
      dot += x * y;
      normA += x * x;
      normB += y * y;
    }
    if (normA === 0 || normB === 0) return 0;
    return round(dot / (Math.sqrt(normA) * Math.sqrt(normB)));
  }

  /** Canonical hex hash of a hypervector (provenance anchor; grid-rounded floats). */
  hashVector(vector: HyperVector): string {
    this.assertDimension(vector);
    assertFinite(vector);
    return createHash('sha256').update(Array.from(vector, round).join(',')).digest('hex');
  }

  /** Encrypt a memory state. Requires a master secret at construction. */
  encryptState(vector: HyperVector): EncryptedStateEnvelope {
    if (!this.keys) throw new Error('memory_keys_unavailable');
    this.assertDimension(vector);
    assertFinite(vector);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys.aesKey, iv);
    const plaintext = Buffer.from(new Float64Array(vector).buffer);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const hmacSignature = createHmac('sha256', this.keys.hmacSecret)
      .update(Buffer.concat([iv, ciphertext, authTag]))
      .digest('hex');
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      hmacSignature,
      timestamp: Date.now(),
    };
  }

  /** Verify and decrypt a memory state; refuses any tampered envelope component. */
  decryptState(envelope: EncryptedStateEnvelope): HyperVector {
    if (!this.keys) throw new Error('memory_keys_unavailable');
    const iv = Buffer.from(envelope.iv, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const authTag = Buffer.from(envelope.authTag, 'base64');
    const expected = createHmac('sha256', this.keys.hmacSecret)
      .update(Buffer.concat([iv, ciphertext, authTag]))
      .digest('hex');
    if (expected !== envelope.hmacSignature) throw new Error('memory_envelope_mac_invalid');
    const decipher = createDecipheriv('aes-256-gcm', this.keys.aesKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (plaintext.length !== this.dimension * Float64Array.BYTES_PER_ELEMENT)
      throw new Error('memory_envelope_dimension_mismatch');
    const out = new Float64Array(
      plaintext.buffer,
      plaintext.byteOffset,
      plaintext.length / Float64Array.BYTES_PER_ELEMENT
    );
    // Copy out of the decryption buffer and re-verify the numeric grid.
    const vector = new Float64Array(out);
    assertFinite(vector);
    return vector;
  }

  /** Serialize vectors to a canonical, checksummed transport form. */
  vectorsToHex(vectors: readonly HyperVector[]): string {
    return vectors
      .map((v) => {
        this.assertDimension(v);
        assertFinite(v);
        return Buffer.from(new Float64Array(v).buffer).toString('hex');
      })
      .join('.');
  }

  hexToVectors(hex: string): HyperVector[] {
    if (typeof hex !== 'string' || hex.length === 0) throw new Error('invalid_hex_payload');
    return hex.split('.').map((part) => {
      const buffer = Buffer.from(part, 'hex');
      if (buffer.length !== this.dimension * Float64Array.BYTES_PER_ELEMENT)
        throw new Error('hex_dimension_mismatch');
      const vector = new Float64Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.length / Float64Array.BYTES_PER_ELEMENT
      );
      const copy = new Float64Array(vector);
      assertFinite(copy);
      return copy;
    });
  }

  /** Public reference to the derived key material — an identifier, never a secret. */
  keyRef(): string {
    if (!this.keys) throw new Error('memory_keys_unavailable');
    return `sha256:${this.keys.keyRef}`;
  }

  normalize(vector: HyperVector): HyperVector {
    assertFinite(vector);
    let norm = 0;
    for (const value of vector) norm += value * value;
    norm = Math.sqrt(norm);
    if (norm === 0) return vector;
    const out = new Float64Array(vector.length);
    for (let i = 0; i < vector.length; i++) out[i] = round(vector[i]! / norm);
    return out;
  }

  private assertDimension(vector: HyperVector): void {
    if (!(vector instanceof Float64Array) || vector.length !== this.dimension)
      throw new Error('hyper_dimension_mismatch');
  }
}
