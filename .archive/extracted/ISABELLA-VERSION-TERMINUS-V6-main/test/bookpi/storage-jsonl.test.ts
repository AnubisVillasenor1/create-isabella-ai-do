import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonlStorage } from "../../src/bookpi/storage-jsonl";
import { ZERO_HASH } from "../../src/bookpi/crypto";
import { makeSeed } from "./helpers";

function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "bookpi-"));
  return join(dir, "ledger.jsonl");
}

describe("bookpi/storage-jsonl", () => {
  it("append/lista secuencialmente y verifica la cadena", async () => {
    const file = tempFile();
    try {
      const store = createJsonlStorage(file);
      const e1 = await store.appendEvent(makeSeed({ payload: { tick: 1 } }));
      const e2 = await store.appendEvent(makeSeed({ payload: { tick: 2 } }));

      expect(e1.sequence).toBe(1);
      expect(e2.sequence).toBe(2);
      expect(e2.prevHash).toBe(e1.hash);

      const events = await store.listEvents();
      expect(events).toHaveLength(2);
      expect(events[0]?.sequence).toBe(1);

      const check = await store.verifyChain();
      expect(check.valid).toBe(true);
      expect(check.count).toBe(2);
      expect(check.failures).toEqual([]);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("getLastEvent devuelve null en cadena vacía y el último tras append", async () => {
    const file = tempFile();
    try {
      const store = createJsonlStorage(file);
      expect(await store.getLastEvent()).toBeNull();
      await store.appendEvent(makeSeed());
      const last = await store.getLastEvent();
      expect(last?.sequence).toBe(1);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("detecta manipulación del payload (hash roto)", async () => {
    const file = tempFile();
    try {
      const store = createJsonlStorage(file);
      await store.appendEvent(makeSeed({ payload: { tick: 1 } }));
      await store.appendEvent(makeSeed({ payload: { tick: 2 } }));

      const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
      const first = JSON.parse(lines[0] ?? "{}");
      first.payload.tick = 99;
      writeFileSync(file, JSON.stringify(first) + "\n" + (lines[1] ?? "") + "\n", "utf8");

      const check = await store.verifyChain();
      expect(check.valid).toBe(false);
      expect(check.failures.some((f) => f.includes("inválidos"))).toBe(true);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("detecta ruptura del encadenamiento prevHash", async () => {
    const file = tempFile();
    try {
      const store = createJsonlStorage(file);
      await store.appendEvent(makeSeed({ payload: { tick: 1 } }));
      await store.appendEvent(makeSeed({ payload: { tick: 2 } }));

      const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
      const second = JSON.parse(lines[1] ?? "{}");
      second.prevHash = ZERO_HASH;
      writeFileSync(file, (lines[0] ?? "") + "\n" + JSON.stringify(second) + "\n", "utf8");

      const check = await store.verifyChain();
      expect(check.valid).toBe(false);
      expect(check.failures.some((f) => f.includes("prevHash"))).toBe(true);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("rechaza contextos derivados explícitos en appendEvent", async () => {
    const file = tempFile();
    try {
      const store = createJsonlStorage(file);
      await expect(
        store.appendEvent(makeSeed(), { sequence: 5 }),
      ).rejects.toThrow(/sequence\/prevHash\/timestamp/);
    } finally {
      rmSync(file, { force: true });
    }
  });
});