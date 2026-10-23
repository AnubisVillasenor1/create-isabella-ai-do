import { describe, expect, it } from "vitest";
import { inspectLegacyBookPiLedger } from "../../src/bookpi/readiness";

describe("legacy BookPI readiness", () => {
  it("does not treat a valid in-memory chain as production-ready", () => {
    const result = inspectLegacyBookPiLedger(() => ({
      storage: "VOLATILE_IN_MEMORY",
      valid: true,
      durable: false,
    }));
    expect(result.status).toBe("degraded");
    expect(result.valid).toBe(true);
    expect(result.reason).toContain("will not survive process restart");
  });

  it("accepts a verified durable local ledger for its own component only", () => {
    const result = inspectLegacyBookPiLedger(() => ({
      storage: "DURABLE_APPEND_ONLY_JSONL",
      valid: true,
      durable: true,
    }));
    expect(result.status).toBe("healthy");
    expect(result.reason).toContain("not shared PostgreSQL durability");
  });

  it("fails closed when chain verification fails", () => {
    const result = inspectLegacyBookPiLedger(() => ({
      storage: "DURABLE_APPEND_ONLY_JSONL",
      valid: false,
      durable: true,
    }));
    expect(result.status).toBe("degraded");
    expect(result.valid).toBe(false);
  });

  it("fails closed when the ledger requires recovery", () => {
    const result = inspectLegacyBookPiLedger(() => { throw new Error("private diagnostic"); });
    expect(result.status).toBe("degraded");
    expect(result.backend).toBe("UNKNOWN");
    expect(result.reason).not.toContain("private diagnostic");
  });
});
