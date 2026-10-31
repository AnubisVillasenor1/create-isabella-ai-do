import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { InMemoryBookPiLedger } from "../../src/bookpi/ledger";
import { createEvidenceBundle, verifyEvidenceBundle, type EvidenceBundle } from "../../src/bookpi/evidence-bundle";

/** state: draft | engine-generated */
function ledger(n: number): InMemoryBookPiLedger {
  const l = new InMemoryBookPiLedger();
  for (let i = 0; i < n; i += 1) l.append({ id: `e${i}`, timestamp: `2026-10-16T12:00:0${i}.000Z`, type: "t", methodId: "N.IDENTITY.E03_GOVERNANCE.x.v1.0.0.LOW.OPERATIONAL", principal: "p", riskTier: "LOW", status: "OK" });
  return l;
}
const clone = (b: EvidenceBundle): EvidenceBundle => JSON.parse(JSON.stringify(b)) as EvidenceBundle;

describe("evidence bundle", () => {
  it("a bundle exported from the real ledger verifies offline", () => {
    const l = ledger(6);
    const b = createEvidenceBundle(l.list(100));
    const v = verifyEvidenceBundle(b, { expectedHead: l.verify().chainHead ?? "" });
    expect(v).toEqual({ valid: true, signatureChecked: false, reasons: [] });
  });
  it("verifies a mid-chain slice via the anchor", () => {
    const events = ledger(8).list(100);
    const slice = createEvidenceBundle(events.slice(3, 7));
    expect(slice.anchorPreviousHash).toBe(events[2]?.hash);
    expect(verifyEvidenceBundle(slice).valid).toBe(true);
  });
  it("detects tampering, reordering, deletion, and head swaps", () => {
    const b = createEvidenceBundle(ledger(5).list(100));
    const edited = clone(b);
    (edited.events[2] as { status: string }).status = "FORGED";
    expect(verifyEvidenceBundle(edited).reasons).toContain("HASH_MISMATCH@2");
    const dropped = clone(b);
    (dropped.events as unknown as unknown[]).splice(2, 1);
    expect(verifyEvidenceBundle(dropped).valid).toBe(false);
    const swapped = clone(b);
    const evs = swapped.events as unknown as unknown[];
    [evs[1], evs[2]] = [evs[2], evs[1]];
    expect(verifyEvidenceBundle(swapped).valid).toBe(false);
    expect(verifyEvidenceBundle(b, { expectedHead: "f".repeat(64) }).reasons).toContain("UNEXPECTED_HEAD");
    expect(verifyEvidenceBundle({ ...clone(b), version: "9" }).reasons).toContain("UNSUPPORTED_VERSION");
  });
  it("signed tree heads: valid, wrong key, forged merkle, required-but-missing", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const other = generateKeyPairSync("ed25519");
    const b = createEvidenceBundle(ledger(4).list(100), { signingKey: privateKey });
    expect(verifyEvidenceBundle(b, { publicKey, requireSignature: true })).toMatchObject({ valid: true, signatureChecked: true });
    expect(verifyEvidenceBundle(b, { publicKey: other.publicKey }).reasons).toContain("STH_SIGNATURE_INVALID");
    const forged = clone(b);
    (forged as { merkle: { root: string } }).merkle.root = "0".repeat(64);
    expect(verifyEvidenceBundle(forged, { publicKey }).valid).toBe(false);
    const unsigned = createEvidenceBundle(ledger(2).list(100));
    expect(verifyEvidenceBundle(unsigned, { publicKey, requireSignature: true }).reasons).toContain("SIGNATURE_REQUIRED");
    expect(verifyEvidenceBundle(b, { requireSignature: true }).reasons).toContain("PUBLIC_KEY_REQUIRED");
  });
  it("rejects empty input", () => {
    expect(() => createEvidenceBundle([])).toThrow();
  });
});
