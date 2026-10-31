import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CryptoShredVault, InMemoryDekStore, SubjectShreddedError } from "../../src/privacy/crypto-shred";
import { BudgetExceededError, PrivacyBudget, laplaceNoise, secureUniform } from "../../src/privacy/differential-privacy";

/** state: draft | engine-generated */
describe("CryptoShredVault", () => {
  it("seals and opens; ciphertext is randomized and bound to subject", () => {
    const vault = new CryptoShredVault(randomBytes(32));
    const a = vault.seal("u1", "dato personal");
    const b = vault.seal("u1", "dato personal");
    expect(a.ct).not.toBe(b.ct);
    expect(vault.open(a).toString("utf8")).toBe("dato personal");
    // un registro movido a otro sujeto no abre (AAD + DEK distinta)
    vault.seal("u2", "x");
    expect(() => vault.open({ ...a, subjectId: "u2" })).toThrow();
  });

  it("detects ciphertext tampering", () => {
    const vault = new CryptoShredVault(randomBytes(32));
    const rec = vault.seal("u1", "hola");
    const ct = Buffer.from(rec.ct, "base64");
    ct[0] = (ct[0] ?? 0) ^ 1;
    expect(() => vault.open({ ...rec, ct: ct.toString("base64") })).toThrow();
  });

  it("shred makes data irrecoverable, is idempotent and blocks re-sealing", () => {
    const store = new InMemoryDekStore();
    const vault = new CryptoShredVault(randomBytes(32), store);
    const rec = vault.seal("u1", "secreto");
    const t1 = vault.shred("u1", "ARCO cancelación", new Date("2026-10-13T00:00:00Z"));
    const t2 = vault.shred("u1", "otra razón");
    expect(t2).toEqual(t1);
    expect(t1.subjectIdCommitment).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(t1)).not.toContain("u1");
    expect(store.get("u1")).toBeUndefined();
    expect(() => vault.open(rec)).toThrow(SubjectShreddedError);
    expect(() => vault.seal("u1", "nuevo")).toThrow(SubjectShreddedError);
    expect(vault.isShredded("u1")).toBe(true);
    // otro sujeto no se ve afectado
    expect(vault.open(vault.seal("u2", "ok")).toString()).toBe("ok");
  });

  it("a different master key cannot open the wrapped DEK even if the store leaks", () => {
    const store = new InMemoryDekStore();
    const a = new CryptoShredVault(randomBytes(32), store);
    const rec = a.seal("u1", "x");
    const b = new CryptoShredVault(randomBytes(32), store);
    expect(() => b.open(rec)).toThrow();
  });

  it("validates inputs", () => {
    expect(() => new CryptoShredVault(randomBytes(8))).toThrow();
    const vault = new CryptoShredVault(randomBytes(32));
    expect(() => vault.seal("", "x")).toThrow();
    expect(() => vault.shred("u1", "  ")).toThrow();
  });
});

describe("differential privacy", () => {
  it("secureUniform stays in (0,1)", () => {
    for (let i = 0; i < 2000; i += 1) {
      const u = secureUniform();
      expect(u > 0 && u < 1).toBe(true);
    }
  });

  it("laplace noise has ~zero mean and ~2b² variance", () => {
    const b = 2;
    const n = 40_000;
    let s = 0;
    let s2 = 0;
    for (let i = 0; i < n; i += 1) {
      const x = laplaceNoise(b);
      s += x;
      s2 += x * x;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.1);
    expect(Math.abs(s2 / n - 2 * b * b) / (2 * b * b)).toBeLessThan(0.1);
  });

  it("charges budget and fails closed without releasing", () => {
    const budget = new PrivacyBudget(1);
    const r = budget.count(100, 0.4, "q1");
    expect(r.epsilonRemaining).toBeCloseTo(0.6, 9);
    budget.count(100, 0.6, "q2");
    expect(budget.remaining).toBeCloseTo(0, 9);
    expect(() => budget.count(100, 0.01, "q3")).toThrow(BudgetExceededError);
    expect(budget.history().map((h) => h.label)).toEqual(["q1", "q2"]);
  });

  it("a failed release does not spend budget", () => {
    const budget = new PrivacyBudget(1);
    expect(() => budget.count(-1, 0.5)).toThrow();
    expect(() => budget.sum([1, Number.NaN], 0, 1, 0.5)).toThrow();
    expect(budget.remaining).toBe(1);
  });

  it("sum clamps contributions and scales noise by sensitivity", () => {
    const budget = new PrivacyBudget(10);
    const zero = () => 0.5; // ruido exactamente 0
    const r = budget.sum([5, 100, -100], 0, 10, 1, "sum", zero);
    expect(r.value).toBeCloseTo(15, 6);
    expect(() => budget.sum([1], 3, 1, 1)).toThrow();
    expect(() => budget.sum([1], 0, 0, 1)).toThrow();
  });

  it("rejects invalid epsilon and scale", () => {
    expect(() => new PrivacyBudget(0)).toThrow();
    const b = new PrivacyBudget(1);
    expect(() => b.charge(0, "x")).toThrow();
    expect(() => b.charge(Number.NaN, "x")).toThrow();
    expect(() => laplaceNoise(0)).toThrow();
  });
});
