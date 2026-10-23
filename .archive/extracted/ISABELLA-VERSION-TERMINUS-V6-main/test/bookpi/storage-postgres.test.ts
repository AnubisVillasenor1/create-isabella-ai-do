import { describe, expect, it } from "vitest";
import { createPostgresStorage } from "../../src/bookpi/storage-postgres";
import { buildBookPiEvent } from "../../src/bookpi/emitter";
import type { PostgresLike } from "../../src/bookpi/storage-postgres";
import { makeSeed } from "./helpers";

describe("BookPI PostgreSQL adapter contract", () => {
  it("binds all thirteen insert columns including canonical", async () => {
    let insert = "";
    let params: unknown[] = [];
    const pool: PostgresLike = {
      query: async (text, values = []) => {
        if (text.startsWith("INSERT INTO")) { insert = text; params = values; }
        return { rows: [] };
      },
    };
    await createPostgresStorage(pool).appendEvent(makeSeed());
    expect(insert).toContain("$13");
    expect(params).toHaveLength(13);
  });

  it("uses one transaction and actor-scoped RLS context for an append", async () => {
    const statements: Array<{ sql: string; params?: unknown[] }> = [];
    const client = {
      query: async (sql: string, params?: unknown[]) => {
        statements.push({ sql, params });
        return { rows: [] };
      },
      release: () => { statements.push({ sql: "RELEASE" }); },
    };
    const pool: PostgresLike = {
      query: async (sql, params) => { statements.push({ sql, params }); return { rows: [] }; },
      connect: async () => client,
    };
    const storage = createPostgresStorage(pool, "bookpi_events", { actorId: "human:pipeline-session" });
    const event = await storage.appendEvent(makeSeed(), { actorId: "human:pipeline-session" });

    expect(event.actorId).toBe("human:pipeline-session");
    expect(statements.some((x) => x.sql === "BEGIN")).toBe(true);
    expect(statements.some((x) => x.sql.includes("set_config('app.actor_id', $1, true)"))).toBe(true);
    expect(statements.some((x) => x.sql.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(statements.some((x) => x.sql === "COMMIT")).toBe(true);
    expect(statements.some((x) => x.sql === "RELEASE")).toBe(true);
  });

  it("normalizes PostgreSQL BIGINT strings before allocating the next sequence", async () => {
    let insertedParams: unknown[] = [];
    const previousRow = {
      id: "evt-41",
      type: "TEST",
      sequence: "41",
      prev_hash: "a".repeat(64),
      timestamp: "2026-10-17T00:00:00.000Z",
      actor_id: null,
      payload: { ok: true },
      schema_version: "v1",
      meta: {},
      header: { type: "TEST", source: "test", protocol: "tamv-federation-v1", hehepcontext: { hexagon: "test", domain: "test" } },
      hash: "b".repeat(64),
      integrity: "c".repeat(128),
      canonical: "{}",
    };
    const pool: PostgresLike = {
      query: async (sql, values = []) => {
        if (sql.startsWith("SELECT id, type, sequence")) return { rows: [previousRow] };
        if (sql.startsWith("INSERT INTO")) insertedParams = values;
        return { rows: [] };
      },
    };
    const storage = createPostgresStorage(pool);
    const last = await storage.getLastEvent();
    expect(last?.sequence).toBe(41);
    await storage.appendEvent(makeSeed());
    expect(insertedParams[2]).toBe(42);
  });

  it("rejects an append that crosses the configured actor scope before touching the database", async () => {
    let touchedDatabase = false;
    const pool: PostgresLike = {
      query: async () => { touchedDatabase = true; return { rows: [] }; },
    };
    const storage = createPostgresStorage(pool, "bookpi_events", { actorId: "actor-a" });
    await expect(storage.appendEvent(makeSeed(), { actorId: "actor-b" }))
      .rejects.toThrow("BOOKPI_ACTOR_SCOPE_MISMATCH");
    expect(touchedDatabase).toBe(false);
  });
  it("normalizes node-postgres TIMESTAMPTZ Date values before canonical chain verification", async () => {
    const secret = "test-integrity-secret-with-32-chars";
    const record = buildBookPiEvent(makeSeed(), {
      sequence: 1,
      prevHash: "0".repeat(64),
      timestamp: "2026-10-17T12:30:00.000Z",
      actorId: "human:pipeline-session",
      secret,
    });
    const row = {
      id: record.id,
      type: record.type,
      sequence: String(record.sequence),
      prev_hash: record.prevHash,
      timestamp: new Date(record.timestamp),
      actor_id: record.actorId ?? null,
      payload: record.payload,
      schema_version: record.schemaVersion,
      meta: record.meta,
      header: record.header,
      hash: record.hash,
      integrity: record.integrity,
      canonical: record.canonical,
    };
    const pool: PostgresLike = {
      query: async () => ({ rows: [row] }),
    };
    const result = await createPostgresStorage(pool).verifyChain({ secret });
    expect(result.valid).toBe(true);
    expect(result.count).toBe(1);
    expect(result.failures).toEqual([]);
  });

});
