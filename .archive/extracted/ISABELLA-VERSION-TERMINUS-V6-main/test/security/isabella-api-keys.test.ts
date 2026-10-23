import { describe, expect, it } from "vitest";
import { IsabellaApiKeyStore } from "../../src/security/isabella-api-keys";

describe("Isabella API key store", () => {
  it("issues hash-only keys and verifies scopes and tenants", () => {
    const store = new IsabellaApiKeyStore();
    const issued = store.issue({ tenantId: "tenant-a", name: "integration", scopes: ["cognition:read"] });
    expect(issued.secret).toMatch(/^isa_live_/);
    expect(issued.record).not.toHaveProperty("secret");
    expect(store.verify(issued.secret, "cognition:read", "tenant-a").ok).toBe(true);
    expect(store.verify(issued.secret, "memory:write", "tenant-a")).toEqual({ ok: false, reason: "scope" });
    expect(store.verify(issued.secret, "cognition:read", "tenant-b")).toEqual({ ok: false, reason: "invalid" });
  });

  it("revokes keys and never returns the secret from listings", () => {
    const store = new IsabellaApiKeyStore();
    const issued = store.issue({ tenantId: "tenant-a", name: "ci", scopes: ["admin:keys"] });
    expect(store.list()).toHaveLength(1);
    expect(store.revoke(issued.record.id)).toBe(true);
    expect(store.verify(issued.secret, "admin:keys")).toEqual({ ok: false, reason: "revoked" });
    expect(JSON.stringify(store.list())).not.toContain(issued.secret);
  });
});
