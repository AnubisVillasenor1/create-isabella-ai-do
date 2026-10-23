import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DurableBookPiLedger, createAuditLedger } from "../../src/bookpi/ledger";
import { planRetention } from "../../src/bookpi/retention";

let ledgerPath = "";
let t = 0;

function nextInput() {
  t += 1000;
  return {
    id: randomUUID(),
    timestamp: new Date(1_700_000_000_000 + t).toISOString(),
    type: "test.event",
    methodId: "TINA.YUN.TEST.append.v0.1.0.LOW.AUTONOMOUS",
    principal: "tester",
    riskTier: "LOW",
    status: "OK",
  };
}

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "bookpi-"));
  ledgerPath = join(dir, "ledger.jsonl");
});

afterEach(() => {
  try { rmSync(dirname(ledgerPath), { recursive: true, force: true }); } catch { /* ignore */ }
});

describe("DurableBookPiLedger", () => {
  it("fails closed when an interrupted maintenance marker exists", () => {
    writeFileSync(ledgerPath + ".maintenance.pending.json", JSON.stringify({
      operation: "prune",
      startedAt: new Date().toISOString(),
      targetLedger: ledgerPath,
    }), "utf8");
    expect(() => new DurableBookPiLedger(ledgerPath)).toThrow("BOOKPI_MAINTENANCE_RECOVERY_REQUIRED");
  });

  it("persists events and reports a durable chain", () => {
    const ledger = new DurableBookPiLedger(ledgerPath);
    ledger.append(nextInput());
    ledger.append(nextInput());
    const verify = ledger.verify();
    expect(verify.valid).toBe(true);
    expect(verify.storage).toBe("DURABLE_APPEND_ONLY_JSONL");
    expect(verify.durable).toBe(true);
    expect(verify.blocksValidated).toBe(2);
  });

  it("reloads and re-verifies the chain from disk", () => {
    const first = new DurableBookPiLedger(ledgerPath);
    first.append(nextInput());
    first.append(nextInput());
    const headBefore = first.verify().chainHead;
    const second = new DurableBookPiLedger(ledgerPath);
    expect(second.verify().valid).toBe(true);
    expect(second.verify().chainHead).toBe(headBefore);
    expect(second.list()).toHaveLength(2);
  });

  it("continues the chain correctly after reload", () => {
    new DurableBookPiLedger(ledgerPath).append(nextInput());
    const reopened = new DurableBookPiLedger(ledgerPath);
    const appended = reopened.append(nextInput());
    expect(appended.sequence).toBe(2);
    expect(reopened.verify().valid).toBe(true);
  });

  it("detects tampering of a persisted event", () => {
    const ledger = new DurableBookPiLedger(ledgerPath);
    ledger.append(nextInput());
    ledger.append(nextInput());
    const lines = readFileSync(ledgerPath, "utf8").trim().split("\n");
    const tampered = JSON.parse(lines[0] as string);
    tampered.status = "TAMPERED";
    lines[0] = JSON.stringify(tampered);
    writeFileSync(ledgerPath, `${lines.join("\n")}\n`, "utf8");
    const reopened = new DurableBookPiLedger(ledgerPath);
    expect(reopened.verify().valid).toBe(false);
    expect(reopened.verify().status).toBe("INTEGRITY_FAILURE");
    expect(() => reopened.backup(ledgerPath + ".refuse-corrupt-backup"))
      .toThrow("BOOKPI_BACKUP_SOURCE_CORRUPT");
  });

  it("backs up and restores the ledger", () => {
    const ledger = new DurableBookPiLedger(ledgerPath);
    ledger.append(nextInput());
    const backupPath = `${ledgerPath}.bak`;
    const backup = ledger.backup(backupPath);
    expect(backup.events).toBe(1);
    ledger.append(nextInput());
    expect(ledger.list()).toHaveLength(2);
    const restored = ledger.restore(backupPath);
    expect(restored.valid).toBe(true);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.verify().valid).toBe(true);
    rmSync(backupPath, { force: true });
  });

  it("refuses to restore a corrupt backup", () => {
    const ledger = new DurableBookPiLedger(ledgerPath);
    ledger.append(nextInput());
    const corrupt = `${ledgerPath}.corrupt`;
    writeFileSync(corrupt, "{\"not\":\"an event\"}\n", "utf8");
    expect(() => ledger.restore(corrupt)).toThrow("BOOKPI_RESTORE_SOURCE_INVALID");
    rmSync(corrupt, { force: true });
  });

  it("continues global sequence and checkpoint hash after pruning", () => {
    const ledger = new DurableBookPiLedger(ledgerPath);
    for (let i = 0; i < 5; i += 1) ledger.append(nextInput());
    ledger.prune(planRetention(ledger.list(), { maxEvents: 2 }));
    const lastKept = ledger.list().at(-1)!;
    const appended = ledger.append(nextInput());
    expect(appended.sequence).toBe(6);
    expect(appended.previousHash).toBe(lastKept.hash);
    expect(ledger.verify().valid).toBe(true);
  });

  it("backs up and restores a pruned ledger together with its checkpoint", () => {
    const ledger = new DurableBookPiLedger(ledgerPath);
    for (let i = 0; i < 5; i += 1) ledger.append(nextInput());
    ledger.prune(planRetention(ledger.list(), { maxEvents: 2 }));
    const backupPath = ledgerPath + ".pruned-backup";
    ledger.backup(backupPath);
    const result = ledger.restore(backupPath);
    expect(result.valid).toBe(true);
    expect(result.restored).toBe(2);
    expect(ledger.verify().valid).toBe(true);
    expect(ledger.getCheckpoint()?.archivedCount).toBe(3);
    rmSync(backupPath, { force: true });
    rmSync(backupPath + ".checkpoint.json", { force: true });
  });

  it("prunes an archived prefix and keeps the chain verifiable via checkpoint", () => {
    const ledger = new DurableBookPiLedger(ledgerPath);
    for (let i = 0; i < 5; i += 1) ledger.append(nextInput());
    const plan = planRetention(ledger.list(), { maxEvents: 2 });
    expect(plan.archived).toHaveLength(3);
    const result = ledger.prune(plan);
    expect(result.pruned).toBe(3);
    expect(result.remaining).toBe(2);
    expect(ledger.verify().valid).toBe(true);
    expect(ledger.getCheckpoint()?.archivedCount).toBe(3);
    const reopened = new DurableBookPiLedger(ledgerPath);
    expect(reopened.verify().valid).toBe(true);
    expect(reopened.list()).toHaveLength(2);
  });
});

describe("createAuditLedger", () => {
  it("returns a durable ledger when a path is provided", () => {
    expect(createAuditLedger(ledgerPath)).toBeInstanceOf(DurableBookPiLedger);
  });

  it("returns the in-memory ledger without a path", () => {
    expect(createAuditLedger("")).not.toBeInstanceOf(DurableBookPiLedger);
  });
});
