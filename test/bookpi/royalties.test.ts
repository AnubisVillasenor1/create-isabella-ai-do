import { describe, expect, it } from "vitest";
import {
  calculateBookPiRoyalties,
  settleRoyalties,
  sharesAreBalanced,
  type FederationShare,
} from "../../src/bookpi";

const shares: FederationShare[] = [
  { federationId: 1, basisPoints: 2000, walletAddress: "0x1" },
  { federationId: 2, basisPoints: 2000, walletAddress: "0x2" },
  { federationId: 3, basisPoints: 2000, walletAddress: "0x3" },
  { federationId: 4, basisPoints: 1500, walletAddress: "0x4" },
  { federationId: 5, basisPoints: 1000, walletAddress: "0x5" },
  { federationId: 6, basisPoints: 1000, walletAddress: "0x6" },
  { federationId: 7, basisPoints: 500, walletAddress: "0x7" },
];

describe("BookPI royalty settlement", () => {
  it("validates that shares sum to 10000 basis points", () => {
    expect(sharesAreBalanced(shares)).toBe(true);
    expect(sharesAreBalanced([{ federationId: 1, basisPoints: 9999, walletAddress: "0x1" }])).toBe(false);
  });

  it("settles without rounding loss (remainder assigned to last federation)", () => {
    const total = 1_000_000_000_000_000_001n; // valor que no divide exacto
    const settlement = settleRoyalties(total, shares);
    expect(settlement.remainderWei).toBe("0");
    const sum = settlement.splits.reduce((acc, s) => acc + BigInt(s.payoutAmountWei), 0n);
    expect(sum).toBe(total);
  });

  it("is deterministic and monotonic in basis points", () => {
    const splits = calculateBookPiRoyalties(1000000n, shares);
    expect(splits[0]?.payoutAmountWei).toBe("200000");
    expect(splits.at(-1)?.payoutAmountWei).toBe("50000");
  });

  it("rejects negative revenue and empty shares", () => {
    expect(() => calculateBookPiRoyalties(-1n, shares)).toThrow();
    expect(() => calculateBookPiRoyalties(100n, [])).toThrow();
  });
});
