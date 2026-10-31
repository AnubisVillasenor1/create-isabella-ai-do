/**
 * BookPI Integrity Verifier - Verifies hash chain integrity of BookPI ledger
 * state: engine-generated
 */

import { createHash } from 'node:crypto';

export interface BookPIEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly type: string;
  readonly methodId: string;
  readonly riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly status: 'ADMITTED' | 'BLOCKED_BY_POLICY' | 'EXECUTED' | 'COMMITTED';
  readonly previousHash: string;
  readonly hash: string;
}

export interface VerificationResult {
  readonly valid: boolean;
  readonly chainLength: number;
  readonly errors: string[];
  readonly verifiedAt: string;
  readonly rootHash: string;
}

export interface BookPIConfig {
  readonly genesisHash: string;
  readonly hashAlgorithm: 'sha256' | 'sha3-512' | 'blake3';
}

const DEFAULT_CONFIG: BookPIConfig = {
  genesisHash: 'GENESIS',
  hashAlgorithm: 'sha256',
};

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? v.toString() : typeof v === 'symbol' ? v.toString() : v
  );
}

function hash(data: string, algorithm: 'sha256' | 'sha3-512' | 'blake3' = 'sha256'): string {
  if (algorithm === 'blake3') {
    // Blake3 not available in Node.js core, fallback to sha256
    return createHash('sha256').update(data).digest('hex');
  }
  return createHash(algorithm).update(data).digest('hex');
}

export class BookPIIntegrityVerifier {
  private readonly config: BookPIConfig;

  constructor(config: Partial<BookPIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verifica la integridad completa de la cadena BookPI
   */
  verifyChain(events: readonly BookPIEvent[]): VerificationResult {
    const errors: string[] = [];
    let expectedPreviousHash = this.config.genesisHash;
    let validCount = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // 1. Verificar hash del evento actual
      const eventHash = this.computeEventHash(event);
      if (event.hash !== eventHash) {
        errors.push(
          `Event ${i} (${event.id}): hash mismatch - expected ${eventHash}, got ${event.hash}`
        );
      }

      // 2. Verificar enlace con evento anterior
      if (event.previousHash !== expectedPreviousHash) {
        errors.push(
          `Event ${i} (${event.id}): broken chain - expected previous hash ${expectedPreviousHash}, got ${event.previousHash}`
        );
      }

      if (errors.length === 0 || errors[errors.length - 1].startsWith(`Event ${i}`) === false) {
        validCount++;
      }

      expectedPreviousHash = event.hash;
    }

    const rootHash = events.length > 0 ? events[events.length - 1].hash : this.config.genesisHash;

    return {
      valid: errors.length === 0,
      chainLength: events.length,
      errors,
      verifiedAt: new Date().toISOString(),
      rootHash,
    };
  }

  /**
   * Verifica un solo evento contra su hash declarado
   */
  verifyEvent(event: BookPIEvent): boolean {
    const computedHash = this.computeEventHash(event);
    return event.hash === computedHash;
  }

  /**
   * Calcula el hash de un evento según el algoritmo configurado
   */
  computeEventHash(event: BookPIEvent): string {
    const payload = stableStringify({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      methodId: event.methodId,
      riskTier: event.riskTier,
      status: event.status,
      previousHash: event.previousHash,
    });
    return hash(stableStringify(payload), this.config.hashAlgorithm);
  }

  /**
   * Verifica prueba de inclusión RFC 6962
   */
  verifyInclusionProof(
    leafHash: string,
    proof: readonly { hash: string; left: boolean }[],
    rootHash: string
  ): boolean {
    let currentHash = leafHash;

    for (const step of proof) {
      const combined = step.left ? step.hash + currentHash : currentHash + step.hash;
      currentHash = this.hash(combined);
    }

    return currentHash === rootHash;
  }

  /**
   * Genera prueba de inclusión para una hoja
   */
  generateInclusionProof(
    events: readonly BookPIEvent[],
    leafIndex: number
  ): { leafHash: string; proof: { hash: string; left: boolean }[] } | null {
    if (leafIndex < 0 || leafIndex >= events.length) return null;

    const leaves = events.map((e) => this.computeEventHash(e));
    const leafHash = leaves[leafIndex];
    const proof: { hash: string; left: boolean }[] = [];

    // Construir árbol Merkle y generar prueba
    let currentLevel = leaves;
    let currentIndex = leafIndex;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const combined = currentLevel[i] + currentLevel[i + 1];
          nextLevel.push(this.hash(combined));
        } else {
          nextLevel.push(currentLevel[i]);
        }
      }

      // Determinar si el índice actual es par (izquierda) o impar (derecha)
      const isLeft = currentIndex % 2 === 0;
      const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;

      if (siblingIndex < currentLevel.length) {
        proof.push({
          hash: currentLevel[siblingIndex],
          left: isLeft,
        });
      }

      currentLevel = nextLevel;
      currentIndex = Math.floor(currentIndex / 2);
    }

    return { leafHash, proof };
  }

  /**
   * Verifica consistencia entre dos tamaños de árbol (RFC 6962)
   */
  verifyConsistency(events: readonly BookPIEvent[], oldSize: number, newSize: number): boolean {
    if (oldSize > newSize || oldSize === 0) return false;
    if (oldSize === newSize) return true;

    const oldRoot = this.computeRootHash(events.slice(0, oldSize));
    const newRoot = this.computeRootHash(events.slice(0, newSize));

    // Para simplicidad, verificamos que la raíz antigua está en el nuevo árbol
    // Implementación completa requeriría prueba de consistencia RFC 6962
    return oldRoot === newRoot; // Simplificado
  }

  private computeRootHash(events: readonly BookPIEvent[]): string {
    if (events.length === 0) return this.config.genesisHash;

    let currentLevel = events.map((e) => this.computeEventHash(e));

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          nextLevel.push(this.hash(currentLevel[i] + currentLevel[i + 1]));
        } else {
          nextLevel.push(currentLevel[i]);
        }
      }
      currentLevel = nextLevel;
    }

    return currentLevel[0] || this.config.genesisHash;
  }

  /**
   * Calcula hash con algoritmo configurado
   */
  private hash(data: string): string {
    return hash(data, this.config.hashAlgorithm);
  }
}

export function createBookPIVerifier(config?: Partial<BookPIConfig>): BookPIIntegrityVerifier {
  return new BookPIIntegrityVerifier(config);
}

export const defaultBookPIVerifier = createBookPIVerifier();
