/**
 * Preparación post-cuántica Ω∞ (state: implemented | tested | partial capability).
 *
 * ΩX-20 Post-Quantum Readiness Layer — inventario honesto de algoritmos y sobre
 * híbrido verificable: firma clásica Ed25519 sobre un compromiso SHA3-512 del
 * payload. El sobre detecta alteraciones y enlaza el contenido, pero NO es
 * ML-KEM/ML-DSA/SLH-DSA ni ofrece resistencia post-cuántica real. Esas primitivas
 * siguen bloqueadas hasta contar con un HSM/KMS o una librería PQC auditada.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  Ed25519Signer,
  algorithmCapabilityReport,
  verifyEd25519,
  type AlgorithmCapabilityReport,
  type PostQuantumSigner,
} from '../security/post-quantum';

export const HYBRID_ENVELOPE_SCHEMA = 'isabella.hybrid-envelope/1.0.0' as const;
export type HybridAlgorithm = 'Ed25519+SHA3-512';

export interface HybridEnvelope {
  readonly schema: typeof HYBRID_ENVELOPE_SCHEMA;
  readonly algorithm: HybridAlgorithm;
  readonly keyId: string;
  readonly payloadHash: string;
  readonly signature: string;
  readonly createdAt: string;
  readonly quantumResistant: false;
  readonly note: string;
}

export interface HybridReadiness {
  readonly state: 'classical-only';
  readonly classicalSignature: { readonly algorithm: 'Ed25519'; readonly available: true };
  readonly hashBinding: { readonly algorithm: 'SHA3-512'; readonly available: boolean };
  readonly postQuantum: {
    readonly algorithms: readonly string[];
    readonly available: false;
    readonly reason: string;
  };
  readonly envelopeSchema: typeof HYBRID_ENVELOPE_SCHEMA;
  readonly quantumResistant: false;
  readonly note: string;
}

const MAX_PAYLOAD_BYTES = 65_536;
const MAX_ENVELOPE_BYTES = 16_384;

function sha3Hex(value: string): string {
  return createHash('sha3-512').update(value, 'utf8').digest('hex');
}

function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 12) throw new Error('PQC: payload nesting is too deep');
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PQC: payload contains a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item, depth + 1)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], depth + 1)}`);
    return `{${entries.join(',')}}`;
  }
  throw new Error('PQC: payload type is not JSON-serializable');
}

function boundedCanonical(value: unknown): string {
  const encoded = canonicalJson(value);
  if (Buffer.byteLength(encoded, 'utf8') > MAX_PAYLOAD_BYTES)
    throw new RangeError('PQC: payload exceeds 64 KiB');
  return encoded;
}

function signatureInput(
  envelope: Pick<HybridEnvelope, 'schema' | 'algorithm' | 'keyId' | 'payloadHash' | 'createdAt'>
): string {
  return canonicalJson({
    schema: envelope.schema,
    algorithm: envelope.algorithm,
    keyId: envelope.keyId,
    payloadHash: envelope.payloadHash,
    createdAt: envelope.createdAt,
  });
}

export class PostQuantumReadiness {
  private readonly signer: PostQuantumSigner;

  constructor(signer?: PostQuantumSigner, keyId?: string) {
    this.signer = signer ?? Ed25519Signer.generate(keyId ?? `omega-runtime-${randomUUID()}`);
  }

  get keyId(): string {
    return this.signer.keyId;
  }

  publicKeyPem(): string {
    return this.signer.publicKeyPem();
  }

  async sign(
    payload: unknown,
    createdAt: string = new Date().toISOString()
  ): Promise<HybridEnvelope> {
    if (typeof createdAt !== 'string' || !createdAt.trim())
      throw new RangeError('PQC: createdAt is required');
    const payloadHash = sha3Hex(boundedCanonical(payload));
    const metadata = {
      schema: HYBRID_ENVELOPE_SCHEMA,
      algorithm: 'Ed25519+SHA3-512' as const,
      keyId: this.signer.keyId,
      payloadHash,
      createdAt: createdAt.trim(),
    };
    const signature = await this.signer.sign(Buffer.from(signatureInput(metadata), 'utf8'));
    return {
      ...metadata,
      signature: Buffer.from(signature).toString('base64url'),
      quantumResistant: false,
      note: 'Firma clásica Ed25519 con compromiso SHA3-512; no es una firma post-cuántica.',
    };
  }

  async verify(envelope: HybridEnvelope, payload: unknown): Promise<boolean> {
    if (
      !envelope ||
      envelope.schema !== HYBRID_ENVELOPE_SCHEMA ||
      envelope.algorithm !== 'Ed25519+SHA3-512'
    )
      return false;
    if (!envelope.payloadHash || !envelope.signature || !envelope.createdAt) return false;
    try {
      const expectedHash = sha3Hex(boundedCanonical(payload));
      if (expectedHash !== envelope.payloadHash) return false;
      const signature = Buffer.from(envelope.signature, 'base64url');
      if (signature.length === 0) return false;
      return await this.signer.verify(Buffer.from(signatureInput(envelope), 'utf8'), signature);
    } catch {
      return false;
    }
  }

  inventory(): HybridReadiness & { readonly baseInventory: AlgorithmCapabilityReport } {
    let hashAvailable = true;
    try {
      sha3Hex('probe');
    } catch {
      hashAvailable = false;
    }
    const base = algorithmCapabilityReport();
    return {
      state: 'classical-only',
      classicalSignature: { algorithm: 'Ed25519', available: true },
      hashBinding: { algorithm: 'SHA3-512', available: hashAvailable },
      postQuantum: {
        algorithms: base.blockedEnvironment,
        available: false,
        reason:
          'ML-KEM/ML-DSA/SLH-DSA requieren un backend HSM/KMS auditado; el repositorio no los simula.',
      },
      envelopeSchema: HYBRID_ENVELOPE_SCHEMA,
      quantumResistant: false,
      note: 'Preparación verificable, no resistencia post-cuántica: el sobre híbrido usa criptografía clásica.',
      baseInventory: base,
    };
  }
}

export async function verifyHybridEnvelope(
  publicKeyPem: string,
  envelope: HybridEnvelope,
  payload: unknown
): Promise<boolean> {
  if (!envelope || envelope.schema !== HYBRID_ENVELOPE_SCHEMA) return false;
  if (Buffer.byteLength(JSON.stringify(envelope), 'utf8') > MAX_ENVELOPE_BYTES) return false;
  try {
    const payloadHash = sha3Hex(boundedCanonical(payload));
    if (payloadHash !== envelope.payloadHash) return false;
    const signature = Buffer.from(envelope.signature, 'base64url');
    if (signature.length === 0) return false;
    return await verifyEd25519(
      publicKeyPem,
      Buffer.from(signatureInput(envelope), 'utf8'),
      signature
    );
  } catch {
    return false;
  }
}
