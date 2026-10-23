import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createJsonPassportStore, createMemoryPassportStore, createPassportAuthority } from "../../src/gameover";
import type { AgentIdentity } from "../../src/gameover";

const agent: AgentIdentity = {
  id: "agent-1",
  name: "Isabella",
  organization: "TAMV",
  owner: "human-authority",
  capabilities: ["conversation"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const now = () => new Date("2026-10-13T00:00:00.000Z");

const tempDirs: string[] = [];
function tempFile(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "isabella-passport-"));
  tempDirs.push(dir);
  return path.join(dir, "passports.json");
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("GAME OVER passport durability (TD-05)", () => {
  it("persists issued passports across authority instances", () => {
    const file = tempFile();
    const first = createPassportAuthority({ store: createJsonPassportStore(file), now, idFactory: () => "GOP-1" });
    const issued = first.issue({ agent, issuer: "TAMV", trustScore: 90 });
    expect(issued.certification).toBe("CERTIFIED");
    expect(existsSync(file)).toBe(true);
    expect(existsSync(`${file}.tmp`)).toBe(false);

    const second = createPassportAuthority({ store: createJsonPassportStore(file), now });
    expect(second.get("GOP-1")).toMatchObject({ id: "GOP-1", certification: "CERTIFIED" });
    expect(second.verify("GOP-1")).toMatchObject({ valid: true, reason: "PASSPORT_VALID" });
  });

  it("persists revocations", () => {
    const file = tempFile();
    createPassportAuthority({ store: createJsonPassportStore(file), now, idFactory: () => "GOP-2" }).issue({
      agent,
      issuer: "TAMV",
      trustScore: 90,
    });
    const revoker = createPassportAuthority({ store: createJsonPassportStore(file), now });
    revoker.revoke("GOP-2", "policy violation");

    const reloaded = createPassportAuthority({ store: createJsonPassportStore(file), now });
    expect(reloaded.verify("GOP-2")).toMatchObject({ valid: false, reason: "PASSPORT_REVOKED" });
    expect(reloaded.list()).toHaveLength(1);
  });

  it("fails loudly on a corrupt store instead of dropping records", () => {
    const file = tempFile();
    writeFileSync(file, "{ this is not valid json", "utf8");
    expect(() => createPassportAuthority({ store: createJsonPassportStore(file) })).toThrow(/PASSPORT_STORE_CORRUPT/);
  });

  it("stays in-memory when no store is configured", () => {
    const authority = createPassportAuthority({ now, idFactory: () => "GOP-3" });
    authority.issue({ agent, issuer: "TAMV", trustScore: 90 });
    expect(authority.get("GOP-3")).not.toBeNull();
  });

  it("memory store mirrors the full registry", () => {
    const store = createMemoryPassportStore();
    const authority = createPassportAuthority({ store, now, idFactory: () => "GOP-4" });
    authority.issue({ agent, issuer: "TAMV", trustScore: 40 });
    expect(store.load()).toHaveLength(1);
    expect(store.load()[0]?.id).toBe("GOP-4");
  });
});
