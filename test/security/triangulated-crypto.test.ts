import { describe, expect, it } from "vitest";
import {
  triangulateDigest,
  verifyTriangulatedDigest,
  deriveKey,
  sealEnvelope,
  openEnvelope,
  safeEqualHex,
  keyFingerprint,
} from "../../src/security";

describe("triangulated crypto", () => {
  it("produces three independent digests plus a combined seal", () => {
    const digest = triangulateDigest("contenido");
    expect(digest.sha3_512).toHaveLength(128);
    expect(digest.sha256).toHaveLength(64);
    expect(digest.blake2b512).toHaveLength(128);
    expect(digest.triangulated).toHaveLength(128);
  });

  it("verifies seals fail-closed and rejects tampering", () => {
    const digest = triangulateDigest("contenido", "hmac-key");
    expect(verifyTriangulatedDigest("contenido", digest, "hmac-key")).toBe(true);
    expect(verifyTriangulatedDigest("otro", digest, "hmac-key")).toBe(false);
    expect(verifyTriangulatedDigest("contenido", { ...digest, sha256: "0".repeat(64) }, "hmac-key")).toBe(false);
    expect(verifyTriangulatedDigest("contenido", digest, "wrong-key")).toBe(false);
  });

  it("derives keys with scrypt and rejects short passphrases", () => {
    expect(() => deriveKey("short")).toThrow();
    const a = deriveKey("passphrase-long-enough", { salt: "salt" });
    const b = deriveKey("passphrase-long-enough", { salt: "salt" });
    expect(a.key.equals(b.key)).toBe(true);
    expect(a.key).toHaveLength(32);
  });

  it("seals and opens envelopes, rejecting wrong key/AAD/tamper", () => {
    const { key } = deriveKey("passphrase-long-enough", { salt: "salt" });
    const envelope = sealEnvelope("mensaje secreto", key, "aad-1");
    expect(openEnvelope(envelope, key, "aad-1")).toBe("mensaje secreto");
    expect(() => openEnvelope(envelope, key, "aad-2")).toThrow(/additional authenticated data/);
    expect(() => openEnvelope({ ...envelope, ciphertext: "00" + envelope.ciphertext }, key, "aad-1")).toThrow(/triangulated seal/);
    const { key: otherKey } = deriveKey("another-passphrase-long", { salt: "salt" });
    expect(() => openEnvelope(envelope, otherKey, "aad-1")).toThrow();
  });

  it("compares hex in constant time and fingerprints identities", () => {
    expect(safeEqualHex("aabb", "aabb")).toBe(true);
    expect(safeEqualHex("aabb", "aabc")).toBe(false);
    expect(safeEqualHex("", "aabb")).toBe(false);
    expect(keyFingerprint("did:tamv:x")).toHaveLength(32);
  });
});
