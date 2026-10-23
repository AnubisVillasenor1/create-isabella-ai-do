import { describe, expect, it } from "vitest";
import {
  shannonEntropy,
  findHighEntropyTokens,
  detectUnicodeEvasion,
  detectDeepPII,
  hardenSanitization,
  buildQuarantineRecord,
} from "../../src/sanitization";

describe("sanitization hardening", () => {
  it("computes Shannon entropy and finds high-entropy secrets", () => {
    expect(shannonEntropy("aaaa")).toBe(0);
    expect(shannonEntropy("abcd")).toBeCloseTo(2, 5);
    const token = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4P5q6";
    const found = findHighEntropyTokens(`key=${token}`, 3.5);
    expect(found.length).toBeGreaterThan(0);
  });

  it("detects zero-width and homoglyph evasion", () => {
    const evasion = detectUnicodeEvasion("ad\u200Bmin\u200D \u0430dmin");
    expect(evasion.zeroWidth).toBe(2);
    expect(evasion.homoglyphs).toBeGreaterThan(0);
  });

  it("masks IBAN and Luhn-valid cards but leaves invalid cards", () => {
    const deep = detectDeepPII("IBAN DE89370400440532013000 y tarjeta 4111 1111 1111 1111 y 1234 5678 9012 3456");
    expect(deep.ibans).toBe(1);
    expect(deep.cards).toBe(1);
    expect(deep.luhnInvalid).toBe(1);
    expect(deep.masked).not.toContain("4111 1111 1111 1111");
  });

  it("requires quarantine for high-entropy secrets and zero-width evasion", () => {
    const secret = hardenSanitization("token=Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0Lm");
    expect(secret.quarantineRequired).toBe(true);
    expect(secret.findings.some((f) => f.kind === "high_entropy_secret")).toBe(true);

    const clean = hardenSanitization("Texto normal sin secretos ni evasion.");
    expect(clean.quarantineRequired).toBe(false);
  });

  it("records quarantine by hash without storing the secret", () => {
    const content = "token=Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0Lm";
    const { findings } = hardenSanitization(content);
    const record = buildQuarantineRecord(content, findings);
    expect(record.contentHash).toHaveLength(128);
    expect(record.reasons.length).toBeGreaterThan(0);
    expect(JSON.stringify(record)).not.toContain("Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0Lm");
  });
});
