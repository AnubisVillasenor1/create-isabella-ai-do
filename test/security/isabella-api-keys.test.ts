import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createDefaultApiKeyStore,
  IsabellaApiKeyStore,
  MAX_KEYS,
  type ApiKeyPersistence,
  type StoredKey,
} from "../../src/security/isabella-api-keys";

interface RowBackend extends ApiKeyPersistence {
  rows: Map<string, StoredKey>;
  saveRecords: number;
  snapshots: number;
  markUsedCalls: number;
  failNextWrite: boolean;
}

/** Row-level fake: writes are counted so a regression to whole-collection snapshots is visible. */
function rowBackend(): RowBackend {
  const rows = new Map<string, StoredKey>();
  const backend: RowBackend = {
    rows,
    saveRecords: 0,
    snapshots: 0,
    markUsedCalls: 0,
    failNextWrite: false,
    load: () => [],
    save: (records) => {
      backend.snapshots += 1;
      for (const record of records) rows.set(record.id, record);
    },
    saveRecord: async (record) => {
      if (backend.failNextWrite) {
        backend.failNextWrite = false;
        throw new Error("durable write rejected");
      }
      backend.saveRecords += 1;
      rows.set(record.id, record);
    },
    markUsed: () => {
      backend.markUsedCalls += 1;
    },
  };
  return backend;
}

function storedKey(secret: string, id = "k1"): StoredKey {
  return {
    id,
    prefix: secret.slice(0, 16),
    tenantId: "tenant-a",
    name: "hydrated",
    scopes: ["cognition:read"],
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    digest: createHash("sha256").update(secret, "utf8").digest(),
  };
}

function warnText(spy: { mock: { calls: readonly (readonly unknown[])[] } }): string {
  return spy.mock.calls.map((args) => args.map((arg) => String(arg)).join(" ")).join(" ");
}

describe("Isabella API key store", () => {
  it("issues hash-only keys and verifies scopes and tenants", async () => {
    const store = new IsabellaApiKeyStore();
    const issued = await store.issue({ tenantId: "tenant-a", name: "integration", scopes: ["cognition:read"] });
    expect(issued.secret).toMatch(/^isa_live_/);
    expect(issued.record).not.toHaveProperty("secret");
    expect(store.verify(issued.secret, "cognition:read", "tenant-a").ok).toBe(true);
    expect(store.verify(issued.secret, "memory:write", "tenant-a")).toEqual({ ok: false, reason: "scope" });
    expect(store.verify(issued.secret, "cognition:read", "tenant-b")).toEqual({ ok: false, reason: "invalid" });
  });

  it("revokes keys and never returns the secret from listings", async () => {
    const store = new IsabellaApiKeyStore();
    const issued = await store.issue({ tenantId: "tenant-a", name: "ci", scopes: ["admin:keys"] });
    expect(store.list()).toHaveLength(1);
    expect(await store.revoke(issued.record.id)).toBe(true);
    expect(store.verify(issued.secret, "admin:keys")).toEqual({ ok: false, reason: "revoked" });
    expect(JSON.stringify(store.list())).not.toContain(issued.secret);
  });

  it("keeps verify() synchronous even though writes are async", async () => {
    const store = new IsabellaApiKeyStore();
    const issued = await store.issue({ tenantId: "tenant-a", name: "sync", scopes: ["cognition:read"] });
    const verdict = store.verify(issued.secret, "cognition:read");
    expect(verdict.ok).toBe(true);
    expect(verdict).not.toBeInstanceOf(Promise);
    expect((verdict as unknown as { then?: unknown }).then).toBeUndefined();
  });

  it("writes one row per mutation instead of rewriting the collection", async () => {
    const backend = rowBackend();
    const store = new IsabellaApiKeyStore({ persistence: backend });
    const issued = await store.issue({ tenantId: "tenant-a", name: "rows", scopes: ["cognition:read"] });
    expect(backend.saveRecords).toBe(1);
    expect(backend.snapshots).toBe(0);
    expect(backend.rows.get(issued.record.id)?.digest).toBeInstanceOf(Buffer);
    expect(await store.rotate(issued.record.id)).not.toBeNull();
    expect(await store.revoke(issued.record.id)).toBe(true);
    expect(backend.saveRecords).toBe(3);
    expect(backend.snapshots).toBe(0);
  });

  it("never writes the backend from verify(): lastUsedAt is not a per-request write", async () => {
    const backend = rowBackend();
    const store = new IsabellaApiKeyStore({ persistence: backend });
    const issued = await store.issue({ tenantId: "tenant-a", name: "telemetry", scopes: ["cognition:read"] });
    const writesAfterIssue = backend.saveRecords;
    for (let index = 0; index < 25; index += 1) expect(store.verify(issued.secret).ok).toBe(true);
    expect(backend.saveRecords).toBe(writesAfterIssue);
    expect(backend.snapshots).toBe(0);
    expect(backend.markUsedCalls).toBe(25);
  });

  it("rolls back the in-memory record when the durable write fails", async () => {
    const backend = rowBackend();
    const store = new IsabellaApiKeyStore({ persistence: backend });
    backend.failNextWrite = true;
    await expect(
      store.issue({ tenantId: "tenant-a", name: "failed", scopes: ["cognition:read"] })
    ).rejects.toThrow("durable write rejected");
    expect(store.list()).toHaveLength(0);
    expect(backend.rows.size).toBe(0);

    const issued = await store.issue({ tenantId: "tenant-a", name: "committed", scopes: ["cognition:read"] });
    backend.failNextWrite = true;
    await expect(store.rotate(issued.record.id)).rejects.toThrow("durable write rejected");
    expect(store.verify(issued.secret).ok).toBe(true);
    backend.failNextWrite = true;
    await expect(store.revoke(issued.record.id)).rejects.toThrow("durable write rejected");
    expect(store.verify(issued.secret).ok).toBe(true);
    expect(backend.rows.get(issued.record.id)?.revokedAt).toBeNull();
  });

  it("hydrates rows once and then answers verification synchronously", async () => {
    const secret = `isa_live_${"A".repeat(43)}`;
    const store = new IsabellaApiKeyStore({
      persistence: {
        load: () => [],
        save: () => undefined,
        hydrate: async () => [storedKey(secret)],
      },
    });
    expect(store.verify(secret).ok).toBe(false);
    await store.hydrate();
    expect(store.verify(secret).ok).toBe(true);
    await store.hydrate();
    expect(store.list()).toHaveLength(1);
  });

  it("degrades to process-local keys when hydration fails instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = new IsabellaApiKeyStore({
      persistence: {
        load: () => [],
        save: () => undefined,
        hydrate: async () => {
          throw new Error("connection refused");
        },
      },
    });
    const issued = await store.issue({ tenantId: "tenant-a", name: "degraded", scopes: ["cognition:read"] });
    expect(store.degradationReason).toContain("connection refused");
    expect(store.verify(issued.secret).ok).toBe(true);
    expect(warnText(warn)).toContain("process-local");
    warn.mockRestore();
  });

  it("keeps the pepper in the digest computation", async () => {
    const peppered = new IsabellaApiKeyStore({ pepper: "pepper-value" });
    const issued = await peppered.issue({ tenantId: "tenant-a", name: "pepper", scopes: ["cognition:read"] });
    expect(peppered.verify(issued.secret).ok).toBe(true);
    expect(new IsabellaApiKeyStore({ pepper: "other-pepper" }).verify(issued.secret).ok).toBe(false);
    expect(new IsabellaApiKeyStore().verify(issued.secret).ok).toBe(false);
  });

  it("keeps the MAX_KEYS ceiling", async () => {
    const store = new IsabellaApiKeyStore();
    for (let index = 0; index < MAX_KEYS; index += 1) {
      await store.issue({ tenantId: "tenant-a", name: `key-${index}`, scopes: ["cognition:read"] });
    }
    expect(store.list()).toHaveLength(MAX_KEYS);
    await expect(
      store.issue({ tenantId: "tenant-a", name: "one more", scopes: ["cognition:read"] })
    ).rejects.toThrow("API_KEY_STORE_FULL");
  });

  it("refuses to select Postgres without a usable database URL and stays process-local", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createDefaultApiKeyStore({
      VERCEL: "1",
      VERCEL_ENV: "production",
      ISABELLA_API_KEY_STORE: "postgres",
    });
    expect(store).toBeInstanceOf(IsabellaApiKeyStore);
    const text = warnText(warn);
    expect(text).toContain("DATABASE_URL");
    expect(text).not.toContain("postgres://");
    warn.mockRestore();
  });

  it("still refuses the file backend on production serverless", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createDefaultApiKeyStore({
      VERCEL: "1",
      VERCEL_ENV: "production",
      ISABELLA_API_KEY_STORE: "file",
      ISABELLA_API_KEY_STORE_PATH: ".data/never-written.json",
    });
    expect(store.list()).toEqual([]);
    expect(warnText(warn)).toContain("ephemeral on serverless");
    warn.mockRestore();
  });
});
