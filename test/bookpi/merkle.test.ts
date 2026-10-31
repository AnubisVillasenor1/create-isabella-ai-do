import { describe, expect, it } from "vitest";
import {
  BOOKPI_CHUNK_SIZE,
  chunkBuffer,
  buildMerkleTree,
  generateMerkleProof,
  verifyChunkProof,
  generateZkCommitment,
  registerManuscript,
} from "../../src/bookpi";

describe("BookPI merkle engine", () => {
  it("chunks a buffer into 64 KiB pieces with SHA-256 hashes", () => {
    const buffer = Buffer.alloc(BOOKPI_CHUNK_SIZE * 2 + 5, 1);
    const { hashes, rawChunks } = chunkBuffer(buffer);
    expect(hashes).toHaveLength(3);
    expect(rawChunks[0]?.length).toBe(BOOKPI_CHUNK_SIZE);
    expect(hashes[0]).toHaveLength(64);
  });

  it("rejects empty buffers and empty leaves", () => {
    expect(() => chunkBuffer(Buffer.alloc(0))).toThrow();
    expect(() => buildMerkleTree([])).toThrow();
  });

  it("builds a deterministic merkle root and verifies inclusion proofs", () => {
    const leaves = ["a", "b", "c", "d", "e"].map((s) => Buffer.from(s).toString("hex"));
    const { root, tree } = buildMerkleTree(leaves);
    expect(root).toHaveLength(64);
    expect(tree[0]).toEqual(leaves);

    for (let i = 0; i < leaves.length; i += 1) {
      const proof = generateMerkleProof(leaves, i);
      expect(verifyChunkProof(proof)).toBe(true);
    }
  });

  it("detects tampered proofs", () => {
    const leaves = ["a", "b", "c"].map((s) => Buffer.from(s).toString("hex"));
    const proof = generateMerkleProof(leaves, 1);
    expect(verifyChunkProof({ ...proof, chunkHash: "0".repeat(64) })).toBe(false);
  });

  it("generates a ZK commitment bound to root, author and salt", () => {
    const a = generateZkCommitment("root", "author", "salt");
    const b = generateZkCommitment("root", "author", "salt");
    const c = generateZkCommitment("root", "other", "salt");
    expect(a.commitment).toBe(b.commitment);
    expect(a.commitment).not.toBe(c.commitment);
  });

  it("registers a manuscript deterministically", () => {
    const result = registerManuscript(
      { authorId: "au-1", title: "Obra", category: "MANUSCRIPT", fileBuffer: Buffer.from("hola mundo") },
      "ms-1",
    );
    expect(result.manuscriptId).toBe("ms-1");
    expect(result.totalChunks).toBe(1);
    expect(result.merkleRoot).toHaveLength(64);
  });
});
