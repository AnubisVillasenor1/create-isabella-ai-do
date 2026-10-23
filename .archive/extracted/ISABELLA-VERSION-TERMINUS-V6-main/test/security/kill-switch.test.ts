import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { HaltedError, KillSwitch, signKillCommand, type KillCommand } from "../../src/security/kill-switch";

/** state: draft | engine-generated */
const NOW = Date.parse("2026-10-13T12:00:00Z");
function make(envFlag = false) {
  const a = generateKeyPairSync("ed25519");
  const b = generateKeyPairSync("ed25519");
  const rogue = generateKeyPairSync("ed25519");
  const ks = new KillSwitch({ authorizedKeys: new Map([["alice", a.publicKey], ["bob", b.publicKey]]), envFlag, maxDurationMs: 10_000 });
  let n = 0;
  const cmd = (priv: typeof a.privateKey, issuer: string, action: "ENGAGE" | "RELEASE", scope: string, at = NOW): KillCommand =>
    signKillCommand(priv, { action, scope, issuer, issuedAt: new Date(at).toISOString(), nonce: `nonce-${(n += 1)}-abcdefgh`, reason: "test" });
  return { ks, a, b, rogue, cmd };
}

describe("KillSwitch", () => {
  it("engages a scope, halts it and GLOBAL covers everything", () => {
    const { ks, a, cmd } = make();
    expect(ks.isHalted("federation:ECONOMY", NOW)).toBe(false);
    ks.engage(cmd(a.privateKey, "alice", "ENGAGE", "federation:ECONOMY"), NOW);
    expect(ks.isHalted("federation:ECONOMY", NOW)).toBe(true);
    expect(ks.isHalted("federation:TWINS", NOW)).toBe(false);
    expect(() => ks.assertNotHalted("federation:ECONOMY", NOW)).toThrow(HaltedError);
    ks.engage(cmd(a.privateKey, "alice", "ENGAGE", "GLOBAL"), NOW);
    expect(ks.isHalted("federation:TWINS", NOW)).toBe(true);
  });

  it("auto-expires so a forgotten halt cannot last forever", () => {
    const { ks, a, cmd } = make();
    ks.engage(cmd(a.privateKey, "alice", "ENGAGE", "GLOBAL"), NOW);
    expect(ks.isHalted("x", NOW + 9_999)).toBe(true);
    expect(ks.isHalted("x", NOW + 10_000)).toBe(false);
  });

  it("rejects unauthorized, forged, stale, replayed and malformed commands", () => {
    const { ks, a, rogue, cmd } = make();
    expect(() => ks.engage(cmd(rogue.privateKey, "mallory", "ENGAGE", "GLOBAL"), NOW)).toThrow("not authorized");
    expect(() => ks.engage(cmd(rogue.privateKey, "alice", "ENGAGE", "GLOBAL"), NOW)).toThrow("invalid signature");
    expect(() => ks.engage(cmd(a.privateKey, "alice", "ENGAGE", "GLOBAL", NOW - 3_600_000), NOW)).toThrow("not fresh");
    const ok = cmd(a.privateKey, "alice", "ENGAGE", "federation:X");
    ks.engage(ok, NOW);
    expect(() => ks.engage(ok, NOW)).toThrow("replay");
    expect(() => ks.engage({ ...cmd(a.privateKey, "alice", "ENGAGE", "federation:Y"), scope: "federation:Z" }, NOW)).toThrow("invalid signature");
    expect(() => ks.engage(cmd(a.privateKey, "alice", "ENGAGE", "bad scope!"), NOW)).toThrow("invalid scope");
    expect(() => ks.engage(cmd(a.privateKey, "alice", "RELEASE", "GLOBAL"), NOW)).toThrow("expected ENGAGE");
  });

  it("GLOBAL release needs two distinct issuers; scoped release needs one", () => {
    const { ks, a, b, cmd } = make();
    ks.engage(cmd(a.privateKey, "alice", "ENGAGE", "GLOBAL"), NOW);
    expect(() => ks.release([cmd(a.privateKey, "alice", "RELEASE", "GLOBAL")], NOW)).toThrow("2 distinct issuers");
    expect(() => ks.release([cmd(a.privateKey, "alice", "RELEASE", "GLOBAL"), cmd(a.privateKey, "alice", "RELEASE", "GLOBAL")], NOW)).toThrow("2 distinct issuers");
    expect(ks.isHalted("x", NOW)).toBe(true);
    ks.release([cmd(a.privateKey, "alice", "RELEASE", "GLOBAL"), cmd(b.privateKey, "bob", "RELEASE", "GLOBAL")], NOW);
    expect(ks.isHalted("x", NOW)).toBe(false);
    ks.engage(cmd(a.privateKey, "alice", "ENGAGE", "federation:X"), NOW);
    ks.release([cmd(b.privateKey, "bob", "RELEASE", "federation:X")], NOW);
    expect(ks.isHalted("federation:X", NOW)).toBe(false);
    expect(() => ks.release([], NOW)).toThrow();
  });

  it("environment flag halts everything and cannot be released by command", () => {
    const { ks, a, b, cmd } = make(true);
    expect(ks.isHalted("anything", NOW)).toBe(true);
    expect(() => ks.release([cmd(a.privateKey, "alice", "RELEASE", "GLOBAL"), cmd(b.privateKey, "bob", "RELEASE", "GLOBAL")], NOW)).toThrow("environment flag");
    expect(ks.status(NOW).envFlag).toBe(true);
  });
});
