import { describe, expect, it } from "vitest";
import { createRuntimeBookPiStorage } from "../../src/bookpi/runtime-storage";
import { makeSeed } from "./helpers";

describe("runtime BookPI storage composition", () => {
  it("makes volatile fallback explicit and reports it as not ready", async () => {
    const runtime = createRuntimeBookPiStorage({ BOOKPI_PIPELINE_STORAGE: "memory" });
    expect(runtime.backend).toBe("VOLATILE_MEMORY");
    expect(runtime.durable).toBe(false);
    expect(runtime.shared).toBe(false);
    expect((await runtime.probe()).healthy).toBe(false);

    const event = await runtime.storage.appendEvent(makeSeed(), { actorId: "test-actor" });
    expect(event.sequence).toBe(1);
    expect((await runtime.storage.verifyChain()).valid).toBe(true);
    await runtime.close();
  });

  it("selects the configured Vercel POSTGRES_URL without requiring DATABASE_URL", async () => {
    const runtime = createRuntimeBookPiStorage({
      POSTGRES_URL: "postgres://isabella:test@127.0.0.1:5432/isabella",
    });
    expect(runtime.backend).toBe("POSTGRES");
    expect(runtime.durable).toBe(true);
    expect(runtime.shared).toBe(true);
    const probe = await runtime.probe();
    expect(probe.healthy).toBe(false);
    expect(probe.reason).toContain("BOOKPI_INTEGRITY_SECRET");
    await runtime.close();
  });

  it("fails closed when PostgreSQL is explicitly selected without a connection string", () => {
    expect(() => createRuntimeBookPiStorage({ BOOKPI_PIPELINE_STORAGE: "postgres" }))
      .toThrow("BOOKPI_POSTGRES_REQUIRES_DATABASE_URL");
  });

  it("fails closed on an unsupported storage mode", () => {
    expect(() => createRuntimeBookPiStorage({ BOOKPI_PIPELINE_STORAGE: "unknown" }))
      .toThrow("BOOKPI_PIPELINE_STORAGE_UNSUPPORTED");
  });
});
