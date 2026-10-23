/**
 * Triangulated crypto — endurecimiento doble con triangulación de integridad.
 *
 * "Triangulación" significa tres rutas criptográficas independientes (SHA3-512,
 * SHA-256 y BLAKE2b-512) cuyos resultados deben coincidir y combinarse en un
 * único sello. La verificación es fail-closed: si cualquiera de las tres rutas no
 * cuadra, el sello es inválido.
 *
 * Honestidad técnica: esta capa usa primitivas clásicas de Node (AES-256-GCM,
 * scrypt, SHA-3/2, BLAKE2b). NO implementa ML-KEM/ML-DSA/SLH-DSA reales; la
 * firma post-cuántica requiere un HSM/proveedor externo y no se simula aquí.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export interface TriangulatedDigest {
  sha3_512: string;
  sha256: string;
  blake2b512: string;
  /** Sello combinado: SHA3-512 de las tres rutas normalizadas. */
  triangulated: string;
  /** HMAC opcional sobre el sello combinado. */
  hmac?: string;
}

export const TRIANGULATED_ALGORITHMS = ["sha3-512", "sha256", "blake2b512"] as const;

function digestHex(algorithm: string, data: string | Uint8Array): string {
  return createHash(algorithm).update(data).digest("hex");
}

/** Calcula las tres rutas y su sello combinado. Determinista. */
export function triangulateDigest(data: string | Uint8Array, hmacKey?: string): TriangulatedDigest {
  const sha3 = digestHex("sha3-512", data);
  const sha256 = digestHex("sha256", data);
  const blake2b = digestHex("blake2b512", data);
  const triangulated = digestHex("sha3-512", `${sha3}:${sha256}:${blake2b}`);
  const result: TriangulatedDigest = { sha3_512: sha3, sha256, blake2b512: blake2b, triangulated };
  if (hmacKey) result.hmac = createHmac("sha256", hmacKey).update(triangulated).digest("hex");
  return result;
}

/** Verifica un sello triangulado recomputándolo por completo (fail-closed). */
export function verifyTriangulatedDigest(data: string | Uint8Array, expected: TriangulatedDigest, hmacKey?: string): boolean {
  const recomputed = triangulateDigest(data, hmacKey);
  return (
    safeEqualHex(recomputed.sha3_512, expected.sha3_512) &&
    safeEqualHex(recomputed.sha256, expected.sha256) &&
    safeEqualHex(recomputed.blake2b512, expected.blake2b512) &&
    safeEqualHex(recomputed.triangulated, expected.triangulated) &&
    (hmacKey === undefined || safeEqualHex(recomputed.hmac ?? "", expected.hmac ?? ""))
  );
}

/** Comparación de hex en tiempo constante. */
export function safeEqualHex(a: string, b: string): boolean {
  const aa = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (aa.length === 0 || aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export interface DerivedKey {
  key: Buffer;
  salt: string;
  algorithm: "scrypt";
  keyLength: number;
}

/** Deriva una clave con scrypt (KDF clásica). El salt debe ser único por uso. */
export function deriveKey(passphrase: string, opts: { salt?: string; keyLength?: number; cost?: number } = {}): DerivedKey {
  if (passphrase.length < 12) throw new Error("CRYPTO: passphrase must be at least 12 characters");
  const salt = opts.salt ?? randomBytes(16).toString("hex");
  const keyLength = opts.keyLength ?? 32;
  const key = scryptSync(passphrase, salt, keyLength, { N: opts.cost ?? 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { key, salt, algorithm: "scrypt", keyLength };
}

export interface SealedEnvelope {
  version: "tri-seal-v1";
  algorithm: "aes-256-gcm";
  iv: string;
  ciphertext: string;
  authTag: string;
  aad: string;
  digest: TriangulatedDigest;
  createdAt: string;
}

/**
 * Sella un contenido con AES-256-GCM y lo triangula: el sello incluye el digest
 * triple sobre (iv || ciphertext || authTag || aad). Abrir exige tag válido y
 * sello triangulado válido.
 */
export function sealEnvelope(plaintext: string, key: Buffer, aad = ""): SealedEnvelope {
  if (key.length !== 32) throw new Error("CRYPTO: AES-256-GCM requires a 32-byte key");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const digest = triangulateDigest(`${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}:${aad}`);
  return {
    version: "tri-seal-v1",
    algorithm: "aes-256-gcm",
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    authTag: authTag.toString("hex"),
    aad,
    digest,
    createdAt: new Date().toISOString(),
  };
}

/** Abre un sobre sellado; fail-closed ante tag o sello inválidos. */
export function openEnvelope(envelope: SealedEnvelope, key: Buffer, aad = ""): string {
  if (envelope.version !== "tri-seal-v1" || envelope.algorithm !== "aes-256-gcm") {
    throw new Error("CRYPTO: unsupported envelope version/algorithm");
  }
  if (key.length !== 32) throw new Error("CRYPTO: AES-256-GCM requires a 32-byte key");
  if (envelope.aad !== aad) throw new Error("CRYPTO: additional authenticated data mismatch");
  const digestInput = `${envelope.iv}:${envelope.ciphertext}:${envelope.authTag}:${envelope.aad}`;
  if (!verifyTriangulatedDigest(digestInput, envelope.digest)) {
    throw new Error("CRYPTO: triangulated seal verification failed");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "hex"));
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "hex"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "hex")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("CRYPTO: authentication tag verification failed");
  }
}

/**
 * Huella de clave pública/identidad. No es una firma: solo un identificador
 * estable y triangulado para key_id (evita confundir fingerprint con firma).
 */
export function keyFingerprint(material: string): string {
  return triangulateDigest(material).triangulated.slice(0, 32);
}