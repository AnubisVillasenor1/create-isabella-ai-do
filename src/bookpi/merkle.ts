/**
 * BookPI Merkle Engine — fragmentación, integridad criptográfica y prueba de
 * inclusión de obras/manuscritos (BookPI Blueprint v1.0).
 *
 * - Chunking fijo de 64 KiB con hash SHA-256 individual.
 * - Árbol binario de Merkle (hoja impar duplicada) y raíz criptográfica.
 * - Pruebas de inclusión en O(log N) verificables sin descargar el archivo.
 * - Compromiso ZK: C = SHA256(MerkleRoot || AuthorId || Salt).
 *
 * Determinista y sin efectos externos. El anclaje en federaciones y la firma
 * post-cuántica real (HSM/PQC) pertenecen a capas externas con autoridad.
 */
import { createHash, randomBytes } from 'node:crypto';
import { TransparencyLog, verifyInclusion } from './transparency';

export const BOOKPI_CHUNK_SIZE = 64 * 1024;

export interface ChunkProof {
  chunkIndex: number;
  chunkHash: string;
  proofPath: Array<{ hash: string; position: 'left' | 'right' }>;
  root: string;
}

export interface MerkleTree {
  root: string;
  tree: string[][];
}

export interface ChunkedBuffer {
  hashes: string[];
  rawChunks: Buffer[];
}

export interface ZkCommitment {
  commitment: string;
  salt: string;
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Divide un buffer en fragmentos homogéneos de 64 KiB y calcula su hash SHA-256. */
export function chunkBuffer(buffer: Buffer | Uint8Array): ChunkedBuffer {
  const view = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (view.length === 0) throw new Error('BOOKPI: cannot chunk an empty buffer');
  const hashes: string[] = [];
  const rawChunks: Buffer[] = [];
  let offset = 0;
  while (offset < view.length) {
    const chunk = view.subarray(offset, offset + BOOKPI_CHUNK_SIZE);
    hashes.push(sha256Hex(chunk));
    rawChunks.push(Buffer.from(chunk));
    offset += BOOKPI_CHUNK_SIZE;
  }
  return { hashes, rawChunks };
}

/** Construye el árbol binario de Merkle (hoja impar duplicada) y la raíz. */
export function buildMerkleTree(leafHashes: readonly string[]): MerkleTree {
  if (leafHashes.length === 0)
    throw new Error('BOOKPI: cannot build Merkle tree from empty leaves');
  const tree: string[][] = [[...leafHashes]];
  let currentLevel = [...leafHashes];
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i] ?? '';
      const right = i + 1 < currentLevel.length ? (currentLevel[i + 1] ?? left) : left;
      nextLevel.push(sha256Hex(left + right));
    }
    tree.push(nextLevel);
    currentLevel = nextLevel;
  }
  return { root: currentLevel[0] ?? '', tree };
}

/** Genera una prueba de inclusión de Merkle para un chunk específico. */
export function generateMerkleProof(
  leafHashes: readonly string[],
  targetIndex: number
): ChunkProof {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= leafHashes.length) {
    throw new Error('BOOKPI: target chunk index out of range');
  }
  const { root, tree } = buildMerkleTree(leafHashes);
  const proofPath: ChunkProof['proofPath'] = [];
  let index = targetIndex;
  for (let level = 0; level < tree.length - 1; level += 1) {
    const currentLevel = tree[level] ?? [];
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;
    if (siblingIndex < currentLevel.length) {
      proofPath.push({
        hash: currentLevel[siblingIndex] ?? '',
        position: isRightNode ? 'left' : 'right',
      });
    } else {
      proofPath.push({ hash: currentLevel[index] ?? '', position: 'right' });
    }
    index = Math.floor(index / 2);
  }
  return { chunkIndex: targetIndex, chunkHash: leafHashes[targetIndex] ?? '', proofPath, root };
}

/** Verifica la validez de un chunk individual contra la raíz de Merkle. */
export function verifyChunkProof(proof: ChunkProof): boolean {
  let currentHash = proof.chunkHash;
  for (const step of proof.proofPath) {
    const concatenated =
      step.position === 'left' ? step.hash + currentHash : currentHash + step.hash;
    currentHash = sha256Hex(concatenated);
  }
  return currentHash.toLowerCase() === proof.root.toLowerCase();
}

/** Compromiso de privacidad de conocimiento cero: C = SHA256(root || authorId || salt). */
export function generateZkCommitment(
  merkleRoot: string,
  authorId: string,
  secretSalt?: string
): ZkCommitment {
  if (!merkleRoot || !authorId)
    throw new Error('BOOKPI: merkleRoot and authorId are required for a ZK commitment');
  const salt = secretSalt ?? randomBytes(32).toString('hex');
  const commitment = sha256Hex(`${merkleRoot}:${authorId}:${salt}`);
  return { commitment, salt };
}

export interface ManuscriptInput {
  authorId: string;
  title: string;
  category: 'MANUSCRIPT' | 'CODE_REPOS' | 'ACADEMIC_PAPER' | 'AUDIO_SCORE';
  fileBuffer: Buffer | Uint8Array;
  secretSalt?: string;
}

export interface ManuscriptRegistration {
  manuscriptId: string;
  merkleRoot: string;
  payloadHash: string;
  zkCommitment: string;
  totalChunks: number;
  chunksHashes: string[];
}

/**
 * Procesa una obra: chunking + Merkle + payload hash + compromiso ZK.
 * No firma: la firma híbrida post-cuántica (ML-DSA/SLH-DSA vía HSM) es una capa
 * con autoridad externa y no se simula aquí.
 */
export function registerManuscript(
  input: ManuscriptInput,
  manuscriptId: string
): ManuscriptRegistration {
  const { hashes } = chunkBuffer(input.fileBuffer);
  const { root: merkleRoot } = buildMerkleTree(hashes);
  const payloadHash = sha256Hex(`${merkleRoot}:${input.authorId}:${input.title}:${input.category}`);
  const { commitment } = generateZkCommitment(merkleRoot, input.authorId, input.secretSalt);
  return {
    manuscriptId,
    merkleRoot,
    payloadHash,
    zkCommitment: commitment,
    totalChunks: hashes.length,
    chunksHashes: hashes,
  };
}

/**
 * Esquema v2 (recomendado): árbol RFC 6962 con separación de dominio y SIN duplicar hojas impares,
 * por lo que [a,b,c] y [a,b,c,c] ya no colisionan (el esquema v1 se conserva por compatibilidad).
 * state: draft | engine-generated.
 */
export interface ChunkProofV2 {
  scheme: 'RFC6962-SHA256';
  chunkIndex: number;
  treeSize: number;
  leafHash: string;
  proof: string[];
  root: string;
}

function logFromChunkHashes(chunkHashes: readonly string[]): TransparencyLog {
  if (chunkHashes.length === 0)
    throw new Error('BOOKPI: cannot build Merkle tree from empty leaves');
  const log = new TransparencyLog();
  for (const h of chunkHashes) {
    if (!/^[0-9a-f]{64}$/.test(h))
      throw new Error('BOOKPI: chunk hashes must be 64-char lowercase hex');
    log.append(Buffer.from(h, 'hex'));
  }
  return log;
}

export function merkleRootV2(chunkHashes: readonly string[]): string {
  return logFromChunkHashes(chunkHashes).rootHash();
}

export function generateChunkProofV2(chunkHashes: readonly string[], index: number): ChunkProofV2 {
  const log = logFromChunkHashes(chunkHashes);
  if (!Number.isInteger(index) || index < 0 || index >= log.size)
    throw new Error('BOOKPI: target chunk index out of range');
  return {
    scheme: 'RFC6962-SHA256',
    chunkIndex: index,
    treeSize: log.size,
    leafHash: log.leafHash(index),
    proof: log.inclusionProof(index),
    root: log.rootHash(),
  };
}

export function verifyChunkProofV2(proof: ChunkProofV2): boolean {
  return (
    proof.scheme === 'RFC6962-SHA256' &&
    verifyInclusion({
      leafHash: proof.leafHash,
      index: proof.chunkIndex,
      treeSize: proof.treeSize,
      proof: proof.proof,
      rootHash: proof.root,
    })
  );
}
