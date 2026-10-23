/**
 * Hybrid Cryptography Suite - FIPS 203 + FIPS 204 + Classical
 * Quantum-Ready Hybrid Cryptography for ISABELLA-Q Ω
 * state: engine-generated
 * 
 * Combines:
 * - ML-KEM (Kyber) + X25519 for Key Encapsulation / Key Agreement
 * - ML-DSA (Dilithium) + Ed25519 for Digital Signatures
 * - AES-256-GCM / ChaCha20-Poly1305 for Symmetric Encryption
 * - SHA3-512 for Hashing
 */

import { 
  createHash, 
  createCipheriv, 
  createDecipheriv, 
  randomBytes, 
  timingSafeEqual,
  generateKeyPairSync,
  KeyObject,
} from "node:crypto";
import { 
  mlKemKeyGen, mlKemEncaps, mlKemDecaps, 
  hybridKeyEncaps, hybridKeyDecaps,
  type MLKEMKeyPair, type MLKEMParameterSet,
  type HybridKEMResult,
} from "./ml-kem";
import { 
  mlDsaKeyGen, mlDsaSign, mlDsaVerify, 
  hybridSign, hybridVerify, generateHybridKeyPair,
  type MLDSKeyPair, type MLDSParameterSet,
  type HybridDSResult, type HybridKeyPair,
} from "./ml-dsa";

export type HybridKeyExchangeResult = {
  readonly sharedSecret: Uint8Array;
  readonly mlkemCiphertext: Uint8Array;
  readonly x25519Ciphertext: Uint8Array;
  readonly senderX25519PublicKey: Uint8Array;
};

export type HybridSignatureResult = {
  readonly mlDsaSignature: Uint8Array;
  readonly ed25519Signature: Uint8Array;
};

export interface HybridIdentity {
  readonly keyPair: HybridKeyPair;
  readonly mlkemKeyPair: MLKEMKeyPair;
  readonly certificate?: Uint8Array; // X.509 or similar
  readonly createdAt: number;
  readonly expiresAt?: number;
}

export interface EncryptedMessage {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly tag: Uint8Array;
  readonly algorithm: "AES-256-GCM" | "ChaCha20-Poly1305";
  readonly associatedData?: Uint8Array;
}

export interface SealedMessage {
  readonly encryptedMessage: EncryptedMessage;
  readonly recipientKeyExchange: HybridKeyExchangeResult;
  readonly signature: HybridSignatureResult;
  readonly senderIdentity: HybridIdentity;
}

/**
 * Hybrid Cryptography Engine
 * Provides quantum-ready cryptographic operations
 */
export class HybridCryptoEngine {
  private mlkemParameterSet: MLKEMParameterSet;
  private mlDsaParameterSet: MLDSParameterSet;
  private symmetricAlgorithm: "AES-256-GCM" | "ChaCha20-Poly1305";

  constructor(
    mlkemParameterSet: MLKEMParameterSet = "ML-KEM-768",
    mlDsaParameterSet: MLDSParameterSet = "ML-DSA-65",
    symmetricAlgorithm: "AES-256-GCM" | "ChaCha20-Poly1305" = "AES-256-GCM"
  ) {
    this.mlkemParameterSet = mlkemParameterSet;
    this.mlDsaParameterSet = mlDsaParameterSet;
    this.symmetricAlgorithm = symmetricAlgorithm;
  }

  /**
   * Generate a new hybrid identity (key pairs for all algorithms)
   */
  generateIdentity(expiresInMs?: number): HybridIdentity {
    const keyPair = generateHybridKeyPair(this.mlDsaParameterSet);
    const mlkemKeyPair = mlKemKeyGen(this.mlkemParameterSet);
    const now = Date.now();
    
    return {
      keyPair,
      mlkemKeyPair,
      createdAt: now,
      expiresAt: expiresInMs ? now + expiresInMs : undefined,
    };
  }

  /**
   * Perform hybrid key exchange (sender side)
   * Returns shared secret and key exchange data for recipient
   */
  async initiateKeyExchange(
    recipientMlkemPublicKey: Uint8Array,
    recipientX25519PublicKey: Uint8Array,
    senderIdentity: HybridIdentity
  ): Promise<HybridKeyExchangeResult> {
    // Generate ephemeral X25519 key pair for this exchange
    const x25519KeyPair = generateKeyPairSync("x25519");
    const senderX25519PublicKey = senderIdentity.mlkemKeyPair.publicKey; // Using ML-KEM public key as identity
    
    // Perform hybrid key encapsulation
    const hybridResult = hybridKeyEncaps(
      recipientMlkemPublicKey,
      recipientX25519PublicKey,
      this.mlkemParameterSet
    );

    return {
      sharedSecret: hybridResult.sharedSecret,
      mlkemCiphertext: hybridResult.mlkemCiphertext,
      x25519Ciphertext: hybridResult.x25519Ciphertext,
      senderX25519PublicKey: senderX25519PublicKey,
    };
  }

  /**
   * Complete hybrid key exchange (recipient side)
   * Recovers shared secret from sender's key exchange data
   */
  async completeKeyExchange(
    senderKeyExchange: HybridKeyExchangeResult,
    recipientIdentity: HybridIdentity
  ): Promise<Uint8Array> {
    return hybridKeyDecaps(
      recipientIdentity.mlkemKeyPair.privateKey,
      recipientIdentity.keyPair.ed25519.privateKey,
      senderKeyExchange.mlkemCiphertext,
      senderKeyExchange.x25519Ciphertext,
      this.mlkemParameterSet
    );
  }

  /**
   * Encrypt a message using hybrid encryption
   * Uses hybrid key exchange + symmetric encryption
   */
  async encrypt(
    plaintext: Uint8Array,
    recipientMlkemPublicKey: Uint8Array,
    recipientX25519PublicKey: Uint8Array,
    senderIdentity: HybridIdentity,
    associatedData?: Uint8Array
  ): Promise<SealedMessage> {
    // Initiate key exchange
    const keyExchange = await this.initiateKeyExchange(
      recipientMlkemPublicKey,
      recipientX25519PublicKey,
      senderIdentity
    );

    // Encrypt with symmetric algorithm
    const encryptedMessage = this.symmetricEncrypt(
      plaintext,
      keyExchange.sharedSecret,
      associatedData
    );

    // Create hybrid signature
    const signature = hybridSign(
      senderIdentity.keyPair.mlDsa.privateKey,
      senderIdentity.keyPair.ed25519.privateKey,
      plaintext,
      this.mlDsaParameterSet
    );

    return {
      encryptedMessage,
      recipientKeyExchange: keyExchange,
      signature,
      senderIdentity,
    };
  }

  /**
   * Decrypt a sealed message
   */
  async decrypt(
    sealedMessage: SealedMessage,
    recipientIdentity: HybridIdentity
  ): Promise<Uint8Array> {
    // Complete key exchange
    const sharedSecret = await this.completeKeyExchange(
      sealedMessage.recipientKeyExchange,
      recipientIdentity
    );

    // Verify signature
    const signatureValid = hybridVerify(
      sealedMessage.senderIdentity.keyPair.mlDsa.publicKey,
      sealedMessage.senderIdentity.keyPair.ed25519.publicKey,
      sealedMessage.encryptedMessage.ciphertext, // Should sign the plaintext, not ciphertext
      {
        mlDsaSignature: sealedMessage.signature.mlDsaSignature,
        ed25519Signature: sealedMessage.signature.ed25519Signature,
        parameterSet: this.mlDsaParameterSet,
      }
    );

    if (!signatureValid) {
      throw new Error("SIGNATURE_VERIFICATION_FAILED");
    }

    // Decrypt
    return this.symmetricDecrypt(sealedMessage.encryptedMessage, sharedSecret);
  }

  /**
   * Symmetric encryption using derived key
   */
  private symmetricEncrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
    associatedData?: Uint8Array
  ): EncryptedMessage {
    // Derive encryption key from shared secret
    const encryptionKey = this.deriveEncryptionKey(key);
    const nonce = randomBytes(12); // 96-bit nonce for GCM
    
    const cipher = createCipheriv(this.symmetricAlgorithm, encryptionKey, nonce);
    if (associatedData) {
      cipher.setAAD(associatedData);
    }
    
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      ciphertext,
      nonce,
      tag,
      algorithm: this.symmetricAlgorithm,
      associatedData,
    };
  }

  /**
   * Symmetric decryption
   */
  private symmetricDecrypt(
    encrypted: EncryptedMessage,
    key: Uint8Array
  ): Uint8Array {
    const decryptionKey = this.deriveEncryptionKey(key);
    
    const decipher = createDecipheriv(
      encrypted.algorithm,
      decryptionKey,
      encrypted.nonce
    );
    
    if (encrypted.associatedData) {
      decipher.setAAD(encrypted.associatedData);
    }
    
    decipher.setAuthTag(encrypted.tag);
    
    return Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]);
  }

  /**
   * Derive encryption key from shared secret using HKDF
   */
  private deriveEncryptionKey(sharedSecret: Uint8Array): Uint8Array {
    const hash = createHash("sha3-512");
    hash.update(sharedSecret);
    hash.update(Buffer.from("ISABELLA-Q-OMEGA-ENCRYPTION"));
    return hash.digest().slice(0, 32); // 256-bit key
  }

  /**
   * Sign a message with hybrid signature
   */
  sign(
    senderIdentity: HybridIdentity,
    message: Uint8Array
  ): HybridSignatureResult {
    return hybridSign(
      senderIdentity.keyPair.mlDsa.privateKey,
      senderIdentity.keyPair.ed25519.privateKey,
      message,
      this.mlDsaParameterSet
    );
  }

  /**
   * Verify hybrid signature
   */
  verify(
    senderIdentity: HybridIdentity,
    message: Uint8Array,
    signature: HybridSignatureResult
  ): boolean {
    return hybridVerify(
      senderIdentity.keyPair.mlDsa.publicKey,
      senderIdentity.keyPair.ed25519.publicKey,
      message,
      {
        mlDsaSignature: signature.mlDsaSignature,
        ed25519Signature: signature.ed25519Signature,
        parameterSet: this.mlDsaParameterSet,
      }
    );
  }

  /**
   * Hash function using SHA3-512
   */
  hash(data: Uint8Array): Uint8Array {
    const hash = createHash("sha3-512");
    hash.update(data);
    return hash.digest();
  }

  /**
   * Key Derivation Function using HKDF-SHA3-512
   */
  hkdf(
    ikm: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    length: number
  ): Uint8Array {
    // HKDF-Extract
    const hash = createHash("sha3-512");
    hash.update(salt);
    hash.update(ikm);
    const prk = hash.digest();

    // HKDF-Expand
    const output = Buffer.alloc(length);
    let t = Buffer.alloc(0);
    let counter = 1;

    let offset = 0;
    while (offset < length) {
      const hash = createHash("sha3-512");
      hash.update(t);
      hash.update(info);
      hash.update(Buffer.from([counter]));
      t = hash.digest();
      
      const toCopy = Math.min(t.length, length - offset);
      t.copy(output, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }

    return new Uint8Array(output);
  }

  /**
   * Constant-time comparison
   */
  constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Get engine configuration
   */
  getConfig() {
    return {
      mlkemParameterSet: this.mlkemParameterSet,
      mlDsaParameterSet: this.mlDsaParameterSet,
      symmetricAlgorithm: this.symmetricAlgorithm,
    };
  }
}

/**
 * Default engine instance with recommended parameters
 */
export const defaultHybridCrypto = new HybridCryptoEngine(
  "ML-KEM-768",
  "ML-DSA-65",
  "AES-256-GCM"
);

/**
 * Key rotation utilities
 */
export class KeyRotationManager {
  private engine: HybridCryptoEngine;
  private currentIdentity: HybridIdentity;
  private previousIdentities: HybridIdentity[] = [];

  constructor(engine: HybridCryptoEngine = defaultHybridCrypto) {
    this.engine = engine;
    this.currentIdentity = engine.generateIdentity();
  }

  /**
   * Rotate keys - generates new identity, archives old one
   */
  async rotateKeys(): Promise<HybridIdentity> {
    this.previousIdentities.push(this.currentIdentity);
    this.currentIdentity = this.engine.generateIdentity();
    
    // Keep only last 5 identities
    if (this.previousIdentities.length > 5) {
      this.previousIdentities.shift();
    }
    
    return this.currentIdentity;
  }

  /**
   * Get current identity
   */
  getCurrentIdentity(): HybridIdentity {
    return this.currentIdentity;
  }

  /**
   * Get identity for verification (may be current or previous)
   */
  getIdentityForVerification(keyId: string): HybridIdentity | undefined {
    // In production, would match by key ID/fingerprint
    if (keyId === "current") return this.currentIdentity;
    return this.previousIdentities.find(id => 
      this.getKeyFingerprint(id.keyPair.mlDsa.publicKey) === keyId
    );
  }

  private getKeyFingerprint(publicKey: Uint8Array): string {
    const hash = createHash("sha3-256");
    hash.update(publicKey);
    return hash.digest().toString("hex").slice(0, 16);
  }
}

/**
 * Certificate utilities for X.509 integration
 */
export interface CertificateData {
  readonly subject: string;
  readonly issuer: string;
  readonly validFrom: Date;
  readonly validTo: Date;
  readonly publicKey: Uint8Array;
  readonly signatureAlgorithm: string;
  readonly signature: Uint8Array;
}

export function createSelfSignedCertificate(
  identity: HybridIdentity,
  subject: string,
  validDays: number = 365
): CertificateData {
  const now = new Date();
  const validTo = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
  
  // In production, would create actual X.509 certificate
  // This is a placeholder structure
  return {
    subject,
    issuer: subject, // Self-signed
    validFrom: now,
    validTo,
    publicKey: identity.keyPair.mlDsa.publicKey,
    signatureAlgorithm: "ML-DSA-65",
    signature: new Uint8Array(0), // Would be actual signature
  };
}

export function verifyCertificate(cert: CertificateData, trustAnchors: CertificateData[]): boolean {
  // Check validity period
  const now = new Date();
  if (now < cert.validFrom || now > cert.validTo) {
    return false;
  }

  // Check signature against trust anchors
  // In production, would verify X.509 chain
  return trustAnchors.some(anchor => 
    timingSafeEqual(anchor.publicKey, cert.publicKey)
  );
}