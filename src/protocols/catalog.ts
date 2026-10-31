/**
 * Protocolos canónicos del ecosistema (BookPI, Atlas, seguridad de eventos).
 *
 * Un protocolo es un contrato ejecutable gobernado. Aquí solo se exponen
 * operaciones deterministas de cálculo/registro interno; la publicación externa,
 * la firma PQC y el anclaje en federaciones pertenecen a capas con autoridad.
 */
import type { ProtocolDescriptor } from './registry';
import { createHash, randomUUID } from 'node:crypto';
import { equalSecret } from '../security/secrets';
import { canonicalJson } from '../bookpi/crypto';
import type { JsonValue } from '../bookpi/types';
import {
  chunkBuffer,
  buildMerkleTree,
  generateMerkleProof,
  verifyChunkProof,
  generateZkCommitment,
  merkleRootV2,
  generateChunkProofV2,
  verifyChunkProofV2,
} from '../bookpi/merkle';
import { settleRoyalties, sharesAreBalanced, type FederationShare } from '../bookpi/royalties';
import {
  createCanonicalDocument,
  changeDocumentState,
  type DocumentInput,
  type DocumentState,
} from '../atlas/documents';
import {
  buildAtlasEvent,
  isKnownAtlasEventType,
  type AtlasEventName,
  type AtlasEventPayloads,
} from '../atlas/events';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Hash canónico (claves ordenadas): el orden de claves del payload ya no altera la firma. */
function payloadDigest(payload: unknown): string {
  try {
    return sha256(canonicalJson((payload ?? null) as JsonValue));
  } catch {
    return sha256(JSON.stringify(payload ?? null));
  }
}

export const PROTOCOL_CATALOG: readonly ProtocolDescriptor[] = [
  {
    id: 'isabella.bookpi.register',
    version: '1.0.0',
    description: 'Registra una obra en BookPI: chunking + Merkle + compromiso ZK (sin firma PQC).',
    execute: async (context) => {
      const input = (context.input ?? {}) as { content?: string; authorId?: string; salt?: string };
      if (!input.content) throw new Error('BOOKPI: content is required');
      const { hashes } = chunkBuffer(Buffer.from(input.content, 'utf8'));
      const { root } = buildMerkleTree(hashes);
      const { commitment, salt } = generateZkCommitment(
        root,
        input.authorId ?? 'unknown',
        input.salt
      );
      return {
        manuscriptId: randomUUID(),
        merkleRoot: root,
        merkleRootV2: merkleRootV2(hashes),
        rootScheme: 'v1 legacy (duplica hoja impar) + v2 RFC6962 recomendado',
        totalChunks: hashes.length,
        zkCommitment: commitment,
        salt,
      };
    },
  },
  {
    id: 'isabella.bookpi.verify',
    version: '1.0.0',
    description: 'Verifica la inclusión de un chunk en la raíz de Merkle de un manuscrito.',
    execute: async (context) => {
      const input = (context.input ?? {}) as { content?: string; index?: number };
      const { hashes } = chunkBuffer(Buffer.from(input.content ?? '', 'utf8'));
      const proof = generateMerkleProof(hashes, input.index ?? 0);
      const proofV2 = generateChunkProofV2(hashes, input.index ?? 0);
      return {
        proof,
        valid: verifyChunkProof(proof),
        proofV2,
        validV2: verifyChunkProofV2(proofV2),
      };
    },
  },
  {
    id: 'isabella.bookpi.royalty.settle',
    version: '1.0.0',
    description: 'Liquida regalías exactas (BigInt) hacia las federaciones TAMV.',
    execute: async (context) => {
      const input = (context.input ?? {}) as {
        totalRevenueWei?: string | number;
        shares?: FederationShare[];
      };
      const shares = Array.isArray(input.shares) ? input.shares : [];
      if (!sharesAreBalanced(shares))
        throw new Error('BOOKPI: federation shares must sum to 10000 basis points');
      return settleRoyalties(BigInt(input.totalRevenueWei ?? 0), shares);
    },
  },
  {
    id: 'isabella.atlas.documents.create',
    version: '1.0.0',
    description: 'Crea un documento canónico Atlas (document_uid + hash canónico + draft).',
    execute: async (context) => createCanonicalDocument(context.input as DocumentInput),
  },
  {
    id: 'isabella.atlas.documents.state',
    version: '1.0.0',
    description: 'Cambia el estado de un documento Atlas respetando las transiciones permitidas.',
    execute: async (context) => {
      const input = (context.input ?? {}) as {
        record?: Parameters<typeof changeDocumentState>[0];
        newState?: DocumentState;
        reason?: string;
      };
      if (!input.record || !input.newState)
        throw new Error('ATLAS: record and newState are required');
      return changeDocumentState(input.record, input.newState, input.reason ?? '');
    },
  },
  {
    id: 'isabella.atlas.events.build',
    version: '1.0.0',
    description: 'Construye y valida un evento canónico Atlas (15 tipos) con idempotencia.',
    execute: async (context) => {
      const input = (context.input ?? {}) as { eventType?: string; payload?: unknown };
      if (!input.eventType || !isKnownAtlasEventType(input.eventType))
        throw new Error('ATLAS_EVENTS: unknown event type');
      return buildAtlasEvent(
        input.eventType as AtlasEventName,
        (input.payload ?? {}) as AtlasEventPayloads[AtlasEventName]
      );
    },
  },
  {
    id: 'isabella.security.sign_event',
    version: '1.0.0',
    description:
      'Firma determinista de un evento (HMAC-like interno) sobre su hash canónico. No es firma PQC real.',
    execute: async (context) => {
      const input = (context.input ?? {}) as { payload?: unknown; actorId?: string };
      const payloadHash = payloadDigest(input.payload);
      const signature = sha256(`${input.actorId ?? 'unknown'}:${payloadHash}`);
      return {
        payloadHash,
        signature,
        algorithm: 'SHA-256(internal-binding)',
        note: 'No sustituye firma PQC/HSM.',
      };
    },
  },
  {
    id: 'isabella.security.verify_event',
    version: '1.0.0',
    description: 'Verifica la firma determinista interna de un evento.',
    execute: async (context) => {
      const input = (context.input ?? {}) as {
        payload?: unknown;
        actorId?: string;
        signature?: string;
      };
      const payloadHash = payloadDigest(input.payload);
      const expected = sha256(`${input.actorId ?? 'unknown'}:${payloadHash}`);
      // Comparación en tiempo constante; una firma ausente o no-string es inválida (fail-closed).
      const valid = typeof input.signature === 'string' && equalSecret(input.signature, expected);
      return { valid, payloadHash, algorithm: 'SHA-256(internal-binding)' };
    },
  },
];
