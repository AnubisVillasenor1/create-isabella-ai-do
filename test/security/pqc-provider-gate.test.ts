import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  mlKemKeyGen,
  mlKemEncaps,
  mlKemDecaps,
  hybridKeyEncaps,
  hybridKeyDecaps,
  validateMLKEMKeyPair,
  type MLKEMKeyPair,
} from "../../src/security/pqc/ml-kem";
import {
  mlDsaKeyGen,
  mlDsaSign,
  mlDsaVerify,
  hybridSign,
  hybridVerify,
  generateHybridKeyPair,
  validateMLDSSignature,
  type HybridDSResult,
} from "../../src/security/pqc/ml-dsa";
import { PqcProviderRequired } from "../../src/security/pqc/provider-gate";
import { HybridCryptoEngine, type HybridIdentity } from "../../src/security/pqc/hybrid-crypto";
import { Ed25519Signer } from "../../src/security/post-quantum";

// Tamaños declarados por las tablas de parámetros: ML-KEM-768 y ML-DSA-65.
const MLKEM_PK = 1184;
const MLKEM_SK_WITH_PK = 2400 + MLKEM_PK;
const MLKEM_CT = 1088;
const MLDSA_PK = 1952;
const MLDSA_SIG = 3293;

function emptyIdentity(): HybridIdentity {
  const none = new Uint8Array(0);
  return {
    keyPair: {
      mlDsa: { publicKey: none, privateKey: none, parameterSet: "ML-DSA-65" },
      ed25519: { publicKey: none, privateKey: none },
    },
    mlkemKeyPair: { publicKey: none, privateKey: none, parameterSet: "ML-KEM-768" },
    createdAt: Date.now(),
  };
}

describe("puerta de proveedor PQC (fail-closed)", () => {
  it("ML-KEM no devuelve claves, ciphertext ni secreto sin proveedor", () => {
    expect(mlKemKeyGen).toThrow(PqcProviderRequired);
    expect(mlKemKeyGen).toThrow(/PQC_BACKEND_UNAVAILABLE/);
    expect(() => mlKemEncaps(randomBytes(MLKEM_PK))).toThrow(PqcProviderRequired);
    expect(() => mlKemDecaps(randomBytes(MLKEM_SK_WITH_PK), randomBytes(MLKEM_CT))).toThrow(PqcProviderRequired);
    expect(() => hybridKeyEncaps(randomBytes(MLKEM_PK), randomBytes(32))).toThrow(PqcProviderRequired);
    expect(() =>
      hybridKeyDecaps(randomBytes(MLKEM_SK_WITH_PK), randomBytes(32), randomBytes(MLKEM_CT), randomBytes(32)),
    ).toThrow(PqcProviderRequired);
  });

  it("ML-KEM simulado ya no puede entregar dos secretos distintos a las partes", () => {
    // Evidencia del fallo original: encaps derivaba de un efímero aleatorio y decaps
    // de la clave privada, así que emisor y receptor nunca coincidían (KEX_MATCH=false).
    const keyPairShape: MLKEMKeyPair = {
      publicKey: randomBytes(MLKEM_PK),
      privateKey: randomBytes(MLKEM_SK_WITH_PK),
      parameterSet: "ML-KEM-768",
    };
    expect(validateMLKEMKeyPair(keyPairShape)).toBe(true);
    let encapsSecret: Uint8Array | undefined;
    let decapsSecret: Uint8Array | undefined;
    let encapsError: unknown;
    let decapsError: unknown;
    try {
      encapsSecret = hybridKeyEncaps(keyPairShape.publicKey, randomBytes(32)).sharedSecret;
    } catch (error) {
      encapsError = error;
    }
    try {
      decapsSecret = hybridKeyDecaps(keyPairShape.privateKey, randomBytes(32), randomBytes(MLKEM_CT), randomBytes(32));
    } catch (error) {
      decapsError = error;
    }
    expect(encapsError).toBeInstanceOf(PqcProviderRequired);
    expect(decapsError).toBeInstanceOf(PqcProviderRequired);
    expect(encapsSecret).toBeUndefined();
    expect(decapsSecret).toBeUndefined();
  });

  it("ML-DSA corta firmar y verificar en lugar de degradarlos a valores falsos", () => {
    expect(mlDsaKeyGen).toThrow(PqcProviderRequired);
    expect(() => mlDsaSign(randomBytes(2528), new Uint8Array([1]))).toThrow(PqcProviderRequired);
    expect(() =>
      mlDsaVerify(randomBytes(MLDSA_PK), new Uint8Array([1]), { signature: randomBytes(MLDSA_SIG), parameterSet: "ML-DSA-65" }),
    ).toThrow(PqcProviderRequired);
    expect(generateHybridKeyPair).toThrow(PqcProviderRequired);
    expect(() => hybridSign(randomBytes(2528), randomBytes(64), new Uint8Array([1]))).toThrow(PqcProviderRequired);
  });

  it("regresión de autenticación: una firma forjada del tamaño correcto no se acepta", () => {
    // Antes bastaba con la longitud correcta: mlDsaVerify solo medía y hybridVerify
    // fijaba ed25519Valid = true, así que este objeto validaba cualquier mensaje.
    const forged: HybridDSResult = {
      mlDsaSignature: randomBytes(MLDSA_SIG),
      ed25519Signature: randomBytes(64),
      parameterSet: "ML-DSA-65",
    };
    expect(validateMLDSSignature({ signature: forged.mlDsaSignature, parameterSet: "ML-DSA-65" })).toBe(true);
    expect(() =>
      hybridVerify(randomBytes(MLDSA_PK), randomBytes(32), new TextEncoder().encode("mensaje ajeno"), forged),
    ).toThrow(PqcProviderRequired);
  });

  it("el motor híbrido falla ruidosamente en identidad, intercambio y cifrado", async () => {
    const engine = new HybridCryptoEngine("ML-KEM-768", "ML-DSA-65", "AES-256-GCM");
    expect(() => engine.generateIdentity()).toThrow(PqcProviderRequired);
    await expect(engine.initiateKeyExchange(randomBytes(MLKEM_PK), randomBytes(32), emptyIdentity())).rejects.toThrow(
      PqcProviderRequired,
    );
    await expect(
      engine.encrypt(new TextEncoder().encode("hola"), randomBytes(MLKEM_PK), randomBytes(32), emptyIdentity()),
    ).rejects.toThrow(PqcProviderRequired);
  });

  it("lo clásico sigue operativo: AEAD con clave explícita y Ed25519 real", async () => {
    const engine = new HybridCryptoEngine("ML-KEM-768", "ML-DSA-65", "AES-256-GCM");
    const key = randomBytes(32);
    const sealed = engine["symmetricEncrypt"](new TextEncoder().encode("terminus"), key);
    expect(Buffer.from(engine["symmetricDecrypt"](sealed, key)).toString("utf8")).toBe("terminus");

    const signer = Ed25519Signer.generate("pqc-gate-test");
    const payload = new TextEncoder().encode("orden de apagado");
    const signature = await signer.sign(payload);
    expect(await signer.verify(payload, signature)).toBe(true);
    expect(await signer.verify(new TextEncoder().encode("otro mensaje"), signature)).toBe(false);
  });
});
