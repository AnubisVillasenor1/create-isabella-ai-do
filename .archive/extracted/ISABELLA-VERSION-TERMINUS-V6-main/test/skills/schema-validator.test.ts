import { describe, expect, it } from "vitest";
import { validateSchema } from "../../src/skills/schema-validator";

describe("JSON Schema 2020-12 subset validator", () => {
  it("accepts a value matching type and required", () => {
    const result = validateSchema(
      { id: "doc-1", content: "hola" },
      { type: "object", required: ["id", "content"], properties: { id: { type: "string" }, content: { type: "string" } } },
    );
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("reports a missing required property with its path", () => {
    const result = validateSchema({ id: "doc-1" }, { type: "object", required: ["id", "content"] });
    expect(result.valid).toBe(false);
    expect(result.violations[0]?.path).toBe("$.content");
    expect(result.violations[0]?.message).toMatch(/required/);
  });

  it("rejects additional properties when additionalProperties is false", () => {
    const result = validateSchema(
      { id: "doc-1", extra: true },
      { type: "object", properties: { id: { type: "string" } }, additionalProperties: false },
    );
    expect(result.valid).toBe(false);
    expect(result.violations[0]?.path).toBe("$.extra");
  });

  it("enforces type unions, enum and const", () => {
    expect(validateSchema("x", { type: ["string", "number"] }).valid).toBe(true);
    expect(validateSchema(true, { type: ["string", "number"] }).valid).toBe(false);
    expect(validateSchema("b", { enum: ["a", "b"] }).valid).toBe(true);
    expect(validateSchema("c", { enum: ["a", "b"] }).valid).toBe(false);
    expect(validateSchema(true, { const: true }).valid).toBe(true);
    expect(validateSchema(false, { const: true }).valid).toBe(false);
  });

  it("enforces pattern, length, numeric and array bounds", () => {
    expect(validateSchema("0x1f", { type: "string", pattern: "^[0-9a-f]+$" }).valid).toBe(false);
    expect(validateSchema("xyz", { type: "string", pattern: "^[0-9a-f]+$" }).valid).toBe(false);
    expect(validateSchema("ab", { type: "string", minLength: 3 }).valid).toBe(false);
    expect(validateSchema("abcd", { type: "string", maxLength: 3 }).valid).toBe(false);
    expect(validateSchema(2, { type: "number", minimum: 3 }).valid).toBe(false);
    expect(validateSchema(9, { type: "number", maximum: 8 }).valid).toBe(false);
    expect(validateSchema([1], { type: "array", minItems: 2 }).valid).toBe(false);
  });

  it("validates nested items and reports the exact path", () => {
    const schema = {
      type: "object",
      properties: {
        shares: {
          type: "array",
          items: { type: "object", required: ["federationId"], properties: { federationId: { type: "integer" } } },
        },
      },
    };
    const result = validateSchema({ shares: [{ federationId: "x" }] }, schema);
    expect(result.valid).toBe(false);
    expect(result.violations[0]?.path).toBe("$.shares[0].federationId");
  });

  it("rejects additional properties when properties are absent", () => {
    const result = validateSchema({ extra: 1 }, { type: "object", additionalProperties: false });
    expect(result.valid).toBe(false);
    expect(result.violations[0]?.path).toBe("$.extra");
  });
});
