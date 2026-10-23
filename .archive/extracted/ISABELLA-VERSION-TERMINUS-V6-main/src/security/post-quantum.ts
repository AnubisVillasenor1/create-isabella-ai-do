/**
 * Post-quantum signing facade — HONEST STATE.
 *
 * state: draft | engine-generated (pending human review).
 * environment: REAL Ed25519 signatures are implemented here via node:crypto
 * (FIPS 186-5, classical, NOT post-quantum). ML-KEM (FIPS 203), ML-DSA
 * (FIPS 204) and SLH-DSA (FIPS 205) are BLOCKED_ENVIRONMENT: this repo does
 * NOT implement them and no backend is faked. They require an external
 * HSM/KMS/provider, injectable through `PqcExternalProvider`. Until such a
 * provider is wired and human-verified, requesting a PQC signature throws
 * `PqcBackendUnavailable` with code `PQC_BACKEND_UNAVAILABLE`.
 */
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import type { KeyObject } from "node:crypto";

export const PQC_ALGORITHM_IDS = ["Ed25519", "ML-KEM-768", "ML-DSA-65", "SLH-DSA-SHA2-128s"] as const;
export type PqcAlgorithmId = (typeof PQC_ALGORITHM_IDS)[number];
export type PqcFamily = "classical" | "post-quantum";
export type PqcEnvironment = "AVAILABLE" | "BLOCKED_ENVIRONMENT" | "EXTERNAL_PROVIDER";

/** Contract every signer must satisfy. Async so an external HSM/KMS can back it. */
export interface PostQuantumSigner {
  readonly algorithm: PqcAlgorithmId;
  readonly keyId: string;
  sign(payload: Uint8Array): Promise<Uint8Array>;
  verify(payload: Uint8Array, signature: Uint8Array): Promise<boolean>;
  publicKeyPem(): string;
}

/**
 * Contract for ML-KEM/ML-DSA/SLH-DSA algorithms. No implementation exists in
 * this repo; providers are injected through `PqcProviderConfig`.
 */
export interface PqcSignatureAlgorithm {
  readonly algorithm: PqcAlgorithmId;
  readonly state: "draft";
  readonly environment: PqcEnvironment;
  sign(payload: Uint8Array): Promise<Uint8Array>;
  verify(payload: Uint8Array, signature: Uint8Array): Promise<boolean>;
}

/** Raised when a PQC algorithm is requested without a configured backend. */
export class PqcBackendUnavailable extends Error {
  readonly code = "PQC_BACKEND_UNAVAILABLE";
  readonly algorithm: PqcAlgorithmId;
  constructor(algorithm: PqcAlgorithmId) {
    super(
      `PQC_BACKEND_UNAVAILABLE: ${algorithm} requires an external HSM/KMS provider; ` +
        "no post-quantum backend is configured and none is simulated.",
    );
    this.name = "PqcBackendUnavailable";
    this.algorithm = algorithm;
  }
}

/** External provider contract (HSM, KMS or vetted software PQC library). */
export interface PqcExternalProvider {
  readonly kind: "hsm" | "kms" | "software-pqc";
  readonly keyId: string;
  sign(algorithm: PqcAlgorithmId, payload: Uint8Array): Promise<Uint8Array>;
  verify(algorithm: PqcAlgorithmId, payload: Uint8Array, signature: Uint8Array): Promise<boolean>;
}

export interface PqcProviderConfig {
  readonly provider: PqcExternalProvider;
}

/** Real Ed25519 signer (classical, verifiable). Used as the replacement API. */
export class Ed25519Signer implements PostQuantumSigner {
  readonly algorithm = "Ed25519" as const;
  readonly keyId: string;
  readonly #privateKey: KeyObject;
  readonly #publicKey: KeyObject;

  private constructor(keyId: string, privateKey: KeyObject, publicKey: KeyObject) {
    this.keyId = keyId;
    this.#privateKey = privateKey;
    this.#publicKey = publicKey;
  }

  /** Generates a fresh Ed25519 key pair. */
  static generate(keyId: string = randomUUID()): Ed25519Signer {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    return new Ed25519Signer(keyId, privateKey, publicKey);
  }

  /** Loads an Ed25519 private key from PKCS#8 PEM and derives its public key. */
  static fromPem(privateKeyPem: string, keyId?: string): Ed25519Signer {
    const privateKey = createPrivateKey(privateKeyPem);
    if (privateKey.asymmetricKeyType !== "ed25519") {
      throw new Error("PQC: expected an Ed25519 private key.");
    }
    const publicKey = createPublicKey(privateKey);
    return new Ed25519Signer(keyId ?? publicKeyFingerprint(publicKey), privateKey, publicKey);
  }

  async sign(payload: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(sign(null, Buffer.from(payload), this.#privateKey));
  }

  async verify(payload: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return verify(null, Buffer.from(payload), this.#publicKey, Buffer.from(signature));
  }

  publicKeyPem(): string {
    return this.#publicKey.export({ format: "pem", type: "spki" }).toString();
  }
}

/** Verifies an Ed25519 signature against an SPKI PEM public key. */
export async function verifyEd25519(
  publicKeyPem: string,
  payload: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const publicKey = createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== "ed25519") return false;
  return verify(null, Buffer.from(payload), publicKey, Buffer.from(signature));
}

function publicKeyFingerprint(publicKey: KeyObject): string {
  return publicKey.export({ format: "der", type: "spki" }).toString("base64url").slice(0, 16);
}

function externalProviderAlgorithm(
  algorithm: PqcAlgorithmId,
  config: PqcProviderConfig,
): PqcSignatureAlgorithm {
  const { provider } = config;
  return {
    algorithm,
    state: "draft",
    environment: "EXTERNAL_PROVIDER",
    sign: (payload) => provider.sign(algorithm, payload),
    verify: (payload, signature) => provider.verify(algorithm, payload, signature),
  };
}

/**
 * Resolves a PQC signature algorithm. Throws `PqcBackendUnavailable` unless an
 * external provider is configured; this repo never simulates ML-KEM/ML-DSA/SLH-DSA.
 */
export function createPqcSignatureAlgorithm(
  algorithm: Exclude<PqcAlgorithmId, "Ed25519">,
  config?: PqcProviderConfig,
): PqcSignatureAlgorithm {
  if (config) return externalProviderAlgorithm(algorithm, config);
  throw new PqcBackendUnavailable(algorithm);
}

/** Honest capability snapshot. Ed25519 is real; the rest are pending a provider. */
export interface AlgorithmCapability {
  algorithm: PqcAlgorithmId;
  family: PqcFamily;
  status: "implemented" | "pending_provider";
  state: "draft";
  environment: PqcEnvironment;
  detail: string;
}

export interface AlgorithmCapabilityReport {
  state: "draft";
  generatedAt: string;
  implemented: PqcAlgorithmId[];
  blockedEnvironment: PqcAlgorithmId[];
  algorithms: AlgorithmCapability[];
}

export function algorithmCapabilityReport(): AlgorithmCapabilityReport {
  const algorithms: AlgorithmCapability[] = [
    {
      algorithm: "Ed25519",
      family: "classical",
      status: "implemented",
      state: "draft",
      environment: "AVAILABLE",
      detail:
        "Real signature via node:crypto (FIPS 186-5). Not post-quantum; provided as the replacement API contract.",
    },
    {
      algorithm: "ML-KEM-768",
      family: "post-quantum",
      status: "pending_provider",
      state: "draft",
      environment: "BLOCKED_ENVIRONMENT",
      detail: "FIPS 203 key encapsulation requires an external HSM/KMS provider; not implemented in this repo.",
    },
    {
      algorithm: "ML-DSA-65",
      family: "post-quantum",
      status: "pending_provider",
      state: "draft",
      environment: "BLOCKED_ENVIRONMENT",
      detail: "FIPS 204 lattice signatures require an external HSM/KMS provider; not implemented in this repo.",
    },
    {
      algorithm: "SLH-DSA-SHA2-128s",
      family: "post-quantum",
      status: "pending_provider",
      state: "draft",
      environment: "BLOCKED_ENVIRONMENT",
      detail: "FIPS 205 hash-based signatures require an external HSM/KMS provider; not implemented in this repo.",
    },
  ];
  return {
    state: "draft",
    generatedAt: new Date().toISOString(),
    implemented: algorithms.filter((a) => a.status === "implemented").map((a) => a.algorithm),
    blockedEnvironment: algorithms
      .filter((a) => a.environment === "BLOCKED_ENVIRONMENT")
      .map((a) => a.algorithm),
    algorithms,
  };
}
