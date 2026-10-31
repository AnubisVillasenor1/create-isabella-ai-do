import { describe, expect, it } from "vitest";
import { decodeShards, encodeShards } from "../../src/terminus/erasure-code";

function combinations(values: number[], size: number): number[][] {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  const [head, ...tail] = values;
  if (head === undefined) return [];
  return [...combinations(tail, size - 1).map((rest) => [head, ...rest]), ...combinations(tail, size)];
}
describe("Terminus Reed-Solomon 6-of-9", () => {
  it("reconstructs the original bytes from every one of the 84 six-shard subsets", () => {
    const original = Uint8Array.from({ length: 1027 }, (_, index) => (index * 37 + 19) % 256);
    const encoded = encodeShards(original);
    const subsets = combinations(Array.from({ length: 9 }, (_, index) => index), 6);
    expect(subsets).toHaveLength(84);
    for (const indexes of subsets) {
      expect(decodeShards(indexes.map((index) => ({ index, bytes: encoded.shards[index]! })), original.length)).toEqual(original);
    }
  });
  it("fails closed with fewer than six unique valid shards", () => {
    const encoded = encodeShards(Uint8Array.from([1, 2, 3, 4, 5]));
    expect(() => decodeShards(encoded.shards.slice(0, 5).map((bytes, index) => ({ index, bytes })), 5))
      .toThrow("TERMINUS_RS_INSUFFICIENT_SHARDS");
  });
  it("rejects inconsistent shard lengths", () => {
    const encoded = encodeShards(new Uint8Array(32).fill(7));
    const pieces = encoded.shards.slice(0, 6).map((bytes, index) => ({ index, bytes }));
    pieces[5] = { index: 5, bytes: new Uint8Array(1) };
    expect(() => decodeShards(pieces, 32)).toThrow("TERMINUS_RS_SHARD_LENGTH_MISMATCH");
  });
});
