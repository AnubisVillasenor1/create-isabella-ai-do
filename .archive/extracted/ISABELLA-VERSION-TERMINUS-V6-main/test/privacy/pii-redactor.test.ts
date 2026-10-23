import { describe, expect, it } from "vitest";
import { clabeCheckDigit, curpCheckDigit, detectPii, isValidClabe, isValidCurp, isValidRfc, luhnValid, redactDeep, redactText } from "../../src/privacy/pii-redactor";

/** state: draft | engine-generated */
const curpBase = "HEGG560427MVZRRL0";
const validCurp = curpBase + curpCheckDigit(curpBase);
const clabeBase = "01218000118359717";
const validClabe = clabeBase + clabeCheckDigit(clabeBase);

describe("validators", () => {
  it("CURP: accepts a structurally valid one, rejects bad check digit/date/shape", () => {
    expect(isValidCurp(validCurp)).toBe(true);
    const bad = validCurp.slice(0, 17) + String((Number(validCurp.slice(17)) + 1) % 10);
    expect(isValidCurp(bad)).toBe(false);
    expect(isValidCurp("HEGG561327MVZRRL0" + curpCheckDigit("HEGG561327MVZRRL0"))).toBe(false);
    expect(isValidCurp("abc")).toBe(false);
    expect(() => curpCheckDigit("short")).toThrow();
  });
  it("CLABE: check digit", () => {
    expect(isValidClabe(validClabe)).toBe(true);
    expect(isValidClabe(clabeBase + String((Number(validClabe.slice(17)) + 1) % 10))).toBe(false);
    expect(isValidClabe("123")).toBe(false);
    expect(() => clabeCheckDigit("12")).toThrow();
  });
  it("Luhn", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("12345")).toBe(false);
  });
  it("RFC: structure and date", () => {
    expect(isValidRfc("XAXX010101000")).toBe(true);
    expect(isValidRfc("XAXX013201000")).toBe(false);
    expect(isValidRfc("XAXX010231000")).toBe(false);
  });
});

describe("redactText", () => {
  it("redacts validated identifiers and leaves lookalikes alone", () => {
    const text = `CURP ${validCurp}, CLABE ${validClabe}, tarjeta 4111 1111 1111 1111, RFC XAXX010101000, correo a@b.mx, tel 771 123 4567`;
    const r = redactText(text);
    expect(r.text).toContain("[REDACTED:CURP]");
    expect(r.text).toContain("[REDACTED:CLABE]");
    expect(r.text).toContain("[REDACTED:CARD]");
    expect(r.text).toContain("[REDACTED:RFC]");
    expect(r.text).toContain("[REDACTED:EMAIL]");
    expect(r.text).toContain("[REDACTED:PHONE_MX]");
    expect(r.text).not.toContain(validCurp);
    expect(redactText("pedido 1234567890123456789 y 4111111111111112").matches).toHaveLength(0);
  });
  it("redacts secrets (bearer, stripe, long hex) and prefers higher-priority overlaps", () => {
    const r = redactText("Authorization: Bearer abcdefghijklmnopqrstuv1234 sk_live_abcdefghijklmnop1234 " + "a".repeat(40));
    expect(r.matches.filter((m) => m.type === "SECRET").length).toBe(3);
    expect(r.text).not.toContain("abcdefghijklmnop");
    expect(detectPii(validClabe).map((m) => m.type)).toEqual(["CLABE"]);
  });
  it("is idempotent", () => {
    const once = redactText(`mail a@b.mx ${validCurp}`).text;
    expect(redactText(once).text).toBe(once);
  });
});

describe("redactDeep", () => {
  it("redacts nested strings and sensitive keys; survives cycles and depth", () => {
    const o: Record<string, unknown> = { user: "a@b.mx", password: "hunter2", nested: { token: "t", list: [`curp ${validCurp}`] } };
    o.self = o;
    const r = redactDeep(o) as Record<string, unknown>;
    expect(r.user).toBe("[REDACTED:EMAIL]");
    expect(r.password).toBe("[REDACTED:KEY]");
    expect((r.nested as { token: string }).token).toBe("[REDACTED:KEY]");
    expect(JSON.stringify(r)).not.toContain(validCurp);
    expect(r.self).toBe("[CIRCULAR]");
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let i = 0; i < 20; i += 1) { const n: Record<string, unknown> = {}; deep.n = n; deep = n; }
    expect(JSON.stringify(redactDeep(root))).toContain("[TRUNCATED]");
    expect(redactDeep(42)).toBe(42);
  });
});

describe("ReDoS resistance", () => {
  it("scans adversarial 100KB inputs in bounded time", () => {
    for (const s of ["1-".repeat(50000), "a.".repeat(50000), "1 ".repeat(50000), "A".repeat(100000), "a@".repeat(50000), "a@b.".repeat(25000)]) {
      const t = Date.now();
      redactText(s);
      expect(Date.now() - t).toBeLessThan(1500);
    }
  });
});
