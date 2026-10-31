/**
 * ML-DSA (Dilithium) — FIPS 204 superficie declarada, proveedor pendiente.
 * state: draft | engine-generated.
 *
 * Antes de este cambio `mlDsaVerify` devolvía `true` para cualquier blob del
 * tamaño correcto y `hybridVerify` fijaba `ed25519Valid = true`, de modo que una
 * firma forjada pasaba el control. Ahora cada operación lanza
 * `PqcProviderRequired` hasta que exista proveedor auditado. Para firmar de verdad:
 * `Ed25519Signer` en `../post-quantum.ts`. Ver `./provider-gate.ts`.
 *
 * Security Levels:
 * - ML-DSA-44: NIST Security Level 2 (AES-128 equivalent)
 * - ML-DSA-65: NIST Security Level 3 (AES-192 equivalent)
 * - ML-DSA-87: NIST Security Level 5 (AES-256 equivalent)
 */

import { createHash } from 'node:crypto';
import { pqcProviderRequired } from './provider-gate';

export type MLDSParameterSet = 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87';

export interface MLDSKeyPair {
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
  readonly parameterSet: MLDSParameterSet;
}

export interface MLDSSignature {
  readonly signature: Uint8Array;
  readonly parameterSet: MLDSParameterSet;
}

export interface MLDSParameters {
  readonly n: number;
  readonly q: number;
  readonly d: number;
  readonly tau: number;
  readonly gamma1: number;
  readonly gamma2: number;
  readonly k: number;
  readonly l: number;
  readonly beta: number;
  readonly omega: number;
  readonly publicKeyBytes: number;
  readonly privateKeyBytes: number;
  readonly signatureBytes: number;
}

const ML_DSA_PARAMETERS: Record<MLDSParameterSet, MLDSParameters> = {
  'ML-DSA-44': {
    n: 256,
    q: 8380417,
    d: 13,
    tau: 39,
    gamma1: 1 << 17,
    gamma2: 95232,
    k: 4,
    l: 4,
    beta: 196,
    omega: 80,
    publicKeyBytes: 1312,
    privateKeyBytes: 2528,
    signatureBytes: 2420,
  },
  'ML-DSA-65': {
    n: 256,
    q: 8380417,
    d: 13,
    tau: 49,
    gamma1: 1 << 19,
    gamma2: 261888,
    k: 6,
    l: 5,
    beta: 196,
    omega: 55,
    publicKeyBytes: 1952,
    privateKeyBytes: 4000,
    signatureBytes: 3293,
  },
  'ML-DSA-87': {
    n: 256,
    q: 8380417,
    d: 13,
    tau: 60,
    gamma1: 1 << 19,
    gamma2: 261888,
    k: 8,
    l: 7,
    beta: 196,
    omega: 75,
    publicKeyBytes: 2592,
    privateKeyBytes: 4864,
    signatureBytes: 4595,
  },
};

/**
 * ML-DSA Key Generation — bloqueada sin proveedor.
 */
export function mlDsaKeyGen(parameterSet: MLDSParameterSet = 'ML-DSA-65'): MLDSKeyPair {
  return pqcProviderRequired(parameterSet, 'generación de claves');
}

/**
 * ML-DSA Sign — bloqueada sin proveedor.
 */
export function mlDsaSign(
  privateKey: Uint8Array,
  message: Uint8Array,
  parameterSet: MLDSParameterSet = 'ML-DSA-65',
  context: Uint8Array = new Uint8Array(0)
): MLDSSignature {
  return pqcProviderRequired(parameterSet, 'firma');
}

/**
 * ML-DSA Verify — bloqueada sin proveedor. Devolver `false` sería tan peligroso
 * como el `true` anterior: un llamador descuidado lo trataría como reintento. Sin
 * algoritmo real no hay verificación posible, así que se corta.
 */
export function mlDsaVerify(
  publicKey: Uint8Array,
  message: Uint8Array,
  sig: MLDSSignature,
  context: Uint8Array = new Uint8Array(0)
): boolean {
  return pqcProviderRequired(sig.parameterSet, 'verificación de firma');
}

/**
 * Comprueba longitud declarada. Es una revisión estructural: un `true` aquí no
 * significa que la clave o la firma sean válidas, solo que caben en el formato.
 */
export function validateMLDSKeyPair(keyPair: MLDSKeyPair): boolean {
  const params = ML_DSA_PARAMETERS[keyPair.parameterSet];
  return (
    keyPair.publicKey.length === params.publicKeyBytes &&
    keyPair.privateKey.length === params.privateKeyBytes
  );
}

/** Comprueba longitud declarada de una firma; no verifica nada criptográfico. */
export function validateMLDSSignature(sig: MLDSSignature): boolean {
  const params = ML_DSA_PARAMETERS[sig.parameterSet];
  return sig.signature.length === params.signatureBytes;
}

/**
 * Forma del par ML-DSA + Ed25519. `hybridSign`/`hybridVerify` no la producen ni la
 * validan sin proveedor: lanzan `PqcProviderRequired`.
 */
export interface HybridDSResult {
  readonly mlDsaSignature: Uint8Array;
  readonly ed25519Signature: Uint8Array;
  readonly parameterSet: MLDSParameterSet;
}

export function hybridSign(
  mlDsaPrivateKey: Uint8Array,
  ed25519PrivateKey: Uint8Array,
  message: Uint8Array,
  parameterSet: MLDSParameterSet = 'ML-DSA-65'
): HybridDSResult {
  return pqcProviderRequired(parameterSet, 'firma híbrida ML-DSA + Ed25519');
}

export function hybridVerify(
  mlDsaPublicKey: Uint8Array,
  ed25519PublicKey: Uint8Array,
  message: Uint8Array,
  sig: HybridDSResult
): boolean {
  return pqcProviderRequired(sig.parameterSet, 'verificación híbrida ML-DSA + Ed25519');
}

/**
 * Pre-hash de mensaje. Ojo: usa SHA3‑512, NO el SHAKE‑256 que especifica FIPS 204;
 * con el algoritmo bloqueado esta función no forma parte de ninguna verificación.
 */
export function prehashMessage(message: Uint8Array): Uint8Array {
  const hash = createHash('sha3-512');
  hash.update(message);
  return hash.digest();
}

/**
 * Par ML-DSA + Ed25519. `generateHybridKeyPair` devolvía antes un seudo‑Ed25519 de
 * `randomBytes`, que no es un par de claves; ahora está bloqueado.
 */
export interface HybridKeyPair {
  readonly mlDsa: MLDSKeyPair;
  readonly ed25519: {
    readonly publicKey: Uint8Array;
    readonly privateKey: Uint8Array;
  };
}

export function generateHybridKeyPair(
  mlDsaParameterSet: MLDSParameterSet = 'ML-DSA-65'
): HybridKeyPair {
  return pqcProviderRequired(mlDsaParameterSet, 'par de claves híbrido');
}

/**
 * Validates hybrid key pair
 */
export function validateHybridKeyPair(keyPair: HybridKeyPair): boolean {
  return (
    validateMLDSKeyPair(keyPair.mlDsa) &&
    keyPair.ed25519.publicKey.length === 32 &&
    keyPair.ed25519.privateKey.length === 64
  );
}
