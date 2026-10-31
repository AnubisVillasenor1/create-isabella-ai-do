import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { HybridCryptoEngine } from "../../src/security/pqc/hybrid-crypto";

const enc = (e: HybridCryptoEngine, pt: Uint8Array, key: Uint8Array, aad?: Uint8Array) =>
  e["symmetricEncrypt"](pt, key, aad);
const dec = (e: HybridCryptoEngine, m: ReturnType<typeof enc>, key: Uint8Array) => e["symmetricDecrypt"](m, key);

describe("hybrid symmetric layer (AEAD)", () => {
  for (const alg of ["AES-256-GCM", "ChaCha20-Poly1305"] as const) {
    it(`${alg} round-trips with AAD and a 16-byte tag`, () => {
      const e = new HybridCryptoEngine("ML-KEM-768", "ML-DSA-65", alg);
      const key = randomBytes(32);
      const pt = new TextEncoder().encode("isabella ∴ mensaje");
      const aad = new TextEncoder().encode("ctx");
      const m = enc(e, pt, key, aad);
      expect(m.tag.length).toBe(16);
      expect(m.algorithm).toBe(alg);
      expect(Buffer.from(dec(e, m, key)).toString("utf8")).toBe("isabella ∴ mensaje");
    });

    it(`${alg} rejects tampering and a wrong key`, () => {
      const e = new HybridCryptoEngine("ML-KEM-768", "ML-DSA-65", alg);
      const key = randomBytes(32);
      const m = enc(e, new Uint8Array([1, 2, 3, 4]), key);
      const bad = Uint8Array.from(m.ciphertext);
      bad[0] = (bad[0] ?? 0) ^ 0xff;
      expect(() => dec(e, { ...m, ciphertext: bad }, key)).toThrow();
      expect(() => dec(e, m, randomBytes(32))).toThrow();
    });
  }
});
