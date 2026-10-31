import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { TransparencyLog, emptyTreeHash, verifyConsistency, verifyInclusion, verifySignedTreeHead } from "../../src/bookpi/transparency";

/** state: draft | engine-generated */
const RFC6962_LEAVES = ["", "00", "10", "2021", "3031", "40414243", "5051525354555657", "606162636465666768696a6b6c6d6e6f"];
const RFC6962_ROOTS = [
  "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
  "fac54203e7cc696cf0dfcb42c92a1d9dbaf70ad9e621f4bd8d98662f00e3c125",
  "aeb6bcfe274b70a14fb067a5e5578264db0fa9b51af5e0ba159158f329e06e77",
  "d37ee418976dd95753c1c73862b9398fa2a2cf9b4ff0fdfe8b30cd95209614b7",
  "4e3bbb1f7b478dcfe71fb631631519a3bca12c9aefca1612bfce4c13a86264d4",
  "76e67dadbcdf1e10e1b74ddc608abd2f98dfb16fbce75277b5232a127f2087ef",
  "ddb89be403809e325750d3d263cd78929c2942b7942a34b77e122c9594a74c8c",
  "5dc9da79a70659a9ad559cb701ded9a2ab9d823aad2f4960cfe370eff4604328",
];

function build(n: number): TransparencyLog {
  const log = new TransparencyLog();
  for (let i = 0; i < n; i += 1) log.append(`entry-${i}`);
  return log;
}

describe("TransparencyLog (RFC 6962/9162)", () => {
  it("empty tree hash is SHA-256 of the empty string", () => {
    expect(emptyTreeHash().toString("hex")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(new TransparencyLog().rootHash()).toBe(emptyTreeHash().toString("hex"));
  });

  it("matches the RFC 6962 reference test vectors", () => {
    const log = new TransparencyLog();
    RFC6962_LEAVES.forEach((hex, i) => {
      log.append(Buffer.from(hex, "hex"));
      expect(log.rootHash()).toBe(RFC6962_ROOTS[i]);
    });
  });

  it("every inclusion proof verifies for every (index,size) up to 33 leaves", () => {
    const log = build(33);
    for (let size = 1; size <= 33; size += 1) {
      const root = log.rootHash(size);
      for (let index = 0; index < size; index += 1) {
        const proof = log.inclusionProof(index, size);
        expect(verifyInclusion({ leafHash: log.leafHash(index), index, treeSize: size, proof, rootHash: root })).toBe(true);
      }
    }
  });

  it("rejects tampered inclusion proofs, wrong index, wrong size and wrong root", () => {
    const log = build(13);
    const root = log.rootHash();
    const proof = log.inclusionProof(5);
    const ok = { leafHash: log.leafHash(5), index: 5, treeSize: 13, proof, rootHash: root };
    expect(verifyInclusion(ok)).toBe(true);
    expect(verifyInclusion({ ...ok, leafHash: log.leafHash(6) })).toBe(false);
    expect(verifyInclusion({ ...ok, index: 4 })).toBe(false);
    // treeSize se autentica vía el STH firmado (size+root), no vía la prueba: ver verifySignedTreeHead.
    expect(verifyInclusion({ ...ok, treeSize: 3 })).toBe(false);
    expect(verifyInclusion({ ...ok, rootHash: log.rootHash(12) })).toBe(false);
    expect(verifyInclusion({ ...ok, proof: proof.slice(1) })).toBe(false);
    expect(verifyInclusion({ ...ok, proof: [...proof, proof[0] ?? ""] })).toBe(false);
    expect(verifyInclusion({ ...ok, proof: ["zz", ...proof.slice(1)] })).toBe(false);
    expect(verifyInclusion({ ...ok, index: -1 })).toBe(false);
  });

  it("every consistency proof verifies for every (m,n) up to 33 leaves", () => {
    const log = build(33);
    for (let n = 1; n <= 33; n += 1) {
      for (let m = 1; m <= n; m += 1) {
        const proof = log.consistencyProof(m, n);
        expect(verifyConsistency({ firstSize: m, secondSize: n, firstRoot: log.rootHash(m), secondRoot: log.rootHash(n), proof })).toBe(true);
      }
    }
  });

  it("rejects consistency proofs between divergent histories", () => {
    const a = build(10);
    const b = new TransparencyLog();
    for (let i = 0; i < 10; i += 1) b.append(i === 3 ? "forked" : `entry-${i}`);
    const proof = b.consistencyProof(6, 10);
    expect(verifyConsistency({ firstSize: 6, secondSize: 10, firstRoot: a.rootHash(6), secondRoot: b.rootHash(10), proof })).toBe(false);
    expect(verifyConsistency({ firstSize: 6, secondSize: 10, firstRoot: b.rootHash(6), secondRoot: b.rootHash(10), proof })).toBe(true);
    expect(verifyConsistency({ firstSize: 0, secondSize: 10, firstRoot: b.rootHash(6), secondRoot: b.rootHash(10), proof })).toBe(false);
  });

  it("prevents the second-preimage / duplicate-leaf ambiguity (domain separation)", () => {
    const three = build(3);
    const four = new TransparencyLog();
    four.append("entry-0");
    four.append("entry-1");
    four.append("entry-2");
    four.append("entry-2");
    expect(three.rootHash()).not.toBe(four.rootHash());
  });

  it("signs and verifies tree heads; detects tampering and wrong key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const other = generateKeyPairSync("ed25519");
    const log = build(7);
    const sth = log.signTreeHead(privateKey, new Date("2026-10-13T00:00:00.000Z"));
    expect(sth.treeSize).toBe(7);
    expect(verifySignedTreeHead(sth, publicKey)).toBe(true);
    expect(verifySignedTreeHead(sth, other.publicKey)).toBe(false);
    expect(verifySignedTreeHead({ ...sth, treeSize: 8 }, publicKey)).toBe(false);
    expect(verifySignedTreeHead({ ...sth, rootHash: log.rootHash(6) }, publicKey)).toBe(false);
    expect(verifySignedTreeHead({ ...sth, signature: "!!!" }, publicKey)).toBe(false);
  });

  it("validates ranges", () => {
    const log = build(4);
    expect(() => log.inclusionProof(4)).toThrow();
    expect(() => log.inclusionProof(0, 5)).toThrow();
    expect(() => log.consistencyProof(0, 4)).toThrow();
    expect(() => log.consistencyProof(5, 4)).toThrow();
    expect(() => log.rootHash(5)).toThrow();
    expect(() => log.leafHash(9)).toThrow();
  });
});

import { chunkBuffer, merkleRootV2, generateChunkProofV2, verifyChunkProofV2, buildMerkleTree } from "../../src/bookpi/merkle";

describe("merkle v2 (anti duplicate-leaf ambiguity)", () => {
  const h = (s: string) => chunkBuffer(Buffer.from(s)).hashes[0] as string;
  it("v1 collides on duplicated odd leaf, v2 does not", () => {
    const [a, b, c] = [h("a"), h("b"), h("c")] as [string, string, string];
    expect(buildMerkleTree([a, b, c]).root).toBe(buildMerkleTree([a, b, c, c]).root);
    expect(merkleRootV2([a, b, c])).not.toBe(merkleRootV2([a, b, c, c]));
  });
  it("proofs verify and reject tampering", () => {
    const leaves = ["a", "b", "c", "d", "e"].map(h);
    for (let i = 0; i < leaves.length; i += 1) expect(verifyChunkProofV2(generateChunkProofV2(leaves, i))).toBe(true);
    const p = generateChunkProofV2(leaves, 2);
    expect(verifyChunkProofV2({ ...p, leafHash: h("zzz") })).toBe(false);
    expect(() => generateChunkProofV2([], 0)).toThrow();
    expect(() => generateChunkProofV2(leaves, 9)).toThrow();
    expect(() => merkleRootV2(["nothex"])).toThrow();
  });
});
