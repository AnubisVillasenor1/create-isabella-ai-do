/**
 * ML-KEM (Kyber) — FIPS 203 superficie declarada, proveedor pendiente.
 * state: draft | engine-generated.
 *
 * Ninguna operación de este módulo calcula Kyber: `pqcProviderRequired` corta
 * cada entrada hasta que un proveedor externo (liboqs, HSM o KMS) esté cableado
 * y verificado por una persona. Ver `./provider-gate.ts`.
 *
 * Security Levels:
 * - ML-KEM-512: NIST Security Level 1 (AES-128 equivalent)
 * - ML-KEM-768: NIST Security Level 3 (AES-192 equivalent)
 * - ML-KEM-1024: NIST Security Level 5 (AES-256 equivalent)
 */

import { pqcProviderRequired } from './provider-gate';

export type MLKEMParameterSet = 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024';

export interface MLKEMKeyPair {
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
  readonly parameterSet: MLKEMParameterSet;
}

export interface MLKEMCiphertext {
  readonly ciphertext: Uint8Array;
  readonly sharedSecret: Uint8Array;
  readonly parameterSet: MLKEMParameterSet;
}

export interface MLKEMParameters {
  readonly n: number; // Polynomial degree (256)
  readonly k: number; // Module rank (2, 3, 4)
  readonly q: number; // Modulus (3329)
  readonly eta1: number; // Noise parameter 1
  readonly eta2: number; // Noise parameter 2
  readonly du: number; // Compression parameter for u
  readonly dv: number; // Compression parameter for v
  readonly publicKeyBytes: number;
  readonly privateKeyBytes: number;
  readonly ciphertextBytes: number;
  readonly sharedSecretBytes: number;
}

const ML_KEM_PARAMETERS: Record<MLKEMParameterSet, MLKEMParameters> = {
  'ML-KEM-512': {
    n: 256,
    k: 2,
    q: 3329,
    eta1: 3,
    eta2: 2,
    du: 10,
    dv: 4,
    publicKeyBytes: 800,
    privateKeyBytes: 1632,
    ciphertextBytes: 768,
    sharedSecretBytes: 32,
  },
  'ML-KEM-768': {
    n: 256,
    k: 3,
    q: 3329,
    eta1: 2,
    eta2: 2,
    du: 10,
    dv: 4,
    publicKeyBytes: 1184,
    privateKeyBytes: 2400,
    ciphertextBytes: 1088,
    sharedSecretBytes: 32,
  },
  'ML-KEM-1024': {
    n: 256,
    k: 4,
    q: 3329,
    eta1: 2,
    eta2: 2,
    du: 11,
    dv: 5,
    publicKeyBytes: 1568,
    privateKeyBytes: 3168,
    ciphertextBytes: 1568,
    sharedSecretBytes: 32,
  },
};

/**
 * ML-KEM Key Generation — bloqueada sin proveedor.
 */
export function mlKemKeyGen(parameterSet: MLKEMParameterSet = 'ML-KEM-768'): MLKEMKeyPair {
  return pqcProviderRequired(parameterSet, 'generación de claves');
}

/**
 * ML-KEM Encapsulation — bloqueada sin proveedor.
 */
export function mlKemEncaps(
  publicKey: Uint8Array,
  parameterSet: MLKEMParameterSet = 'ML-KEM-768'
): MLKEMCiphertext {
  return pqcProviderRequired(parameterSet, 'encapsulación');
}

/**
 * ML-KEM Decapsulation — bloqueada sin proveedor.
 */
export function mlKemDecaps(
  privateKey: Uint8Array,
  ciphertext: Uint8Array,
  parameterSet: MLKEMParameterSet = 'ML-KEM-768'
): Uint8Array {
  return pqcProviderRequired(parameterSet, 'desencapsulación');
}

/**
 * Resultado de un intercambio ML-KEM + X25519. Mientras no exista proveedor,
 * `hybridKeyEncaps`/`hybridKeyDecaps` no lo construyen: lanzan `PqcProviderRequired`.
 */
export interface HybridKEMResult {
  readonly mlkemCiphertext: Uint8Array;
  readonly x25519PublicKey: Uint8Array;
  readonly x25519Ciphertext: Uint8Array;
  readonly sharedSecret: Uint8Array;
}

export function hybridKeyEncaps(
  mlkemPublicKey: Uint8Array,
  x25519PublicKey: Uint8Array,
  mlkemParameterSet: MLKEMParameterSet = 'ML-KEM-768'
): HybridKEMResult {
  return pqcProviderRequired(mlkemParameterSet, 'intercambio híbrido (encapsulación)');
}

export function hybridKeyDecaps(
  mlkemPrivateKey: Uint8Array,
  x25519PrivateKey: Uint8Array,
  mlkemCiphertext: Uint8Array,
  x25519Ciphertext: Uint8Array,
  mlkemParameterSet: MLKEMParameterSet = 'ML-KEM-768'
): Uint8Array {
  return pqcProviderRequired(mlkemParameterSet, 'intercambio híbrido (desencapsulación)');
}

/**
 * Validates ML-KEM key pair sizes
 */
export function validateMLKEMKeyPair(keyPair: MLKEMKeyPair): boolean {
  const params = ML_KEM_PARAMETERS[keyPair.parameterSet];
  return (
    keyPair.publicKey.length === params.publicKeyBytes &&
    keyPair.privateKey.length === params.privateKeyBytes + params.publicKeyBytes
  );
}

/**
 * Validates ML-KEM ciphertext size
 */
export function validateMLKEMCiphertext(
  ciphertext: Uint8Array,
  parameterSet: MLKEMParameterSet
): boolean {
  const params = ML_KEM_PARAMETERS[parameterSet];
  return ciphertext.length === params.ciphertextBytes;
}
