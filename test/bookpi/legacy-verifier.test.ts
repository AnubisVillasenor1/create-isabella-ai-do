import { describe, expect, it } from "vitest";
import {
  BOOKPI_LEDGER_V5_SCHEMA,
  normalizeLegacy,
  normalizeLedger,
  validateLegacyLedger,
  verifyNormalizedHashes,
  type LegacyLedgerEvent,
} from "../../src/bookpi/legacy-verifier";
import { ZERO_HASH } from "../../src/bookpi/crypto";

function event(overrides: Partial<LegacyLedgerEvent> = {}): LegacyLedgerEvent {
  return {
    index: 0,
    timestamp: "2026-01-01T00:00:00.000Z",
    eventType: "ai_decision",
    module: "ECOSYSTEM",
    action: "episode.register",
    actor: "system",
    data: { eventId: "evt-1", version: "1.0.0" },
    prevHash: ZERO_HASH,
    nonce: 0,
    hash: "a".repeat(64),
    ...overrides,
  };
}

describe("validateLegacyLedger", () => {
  it("rechaza un ledger vacío", () => {
    const result = validateLegacyLedger([]);
    expect(result.valid).toBe(false);
    expect(result.status).toBe("unverified");
    expect(result.issues[0]?.code).toBe("EMPTY_LEDGER");
  });

  it("acepta una cadena legacy válida", () => {
    const first = event({ index: 0, hash: "a".repeat(64) });
    const second = event({ index: 1, prevHash: "a".repeat(64), hash: "b".repeat(64), timestamp: "2026-01-01T00:00:01.000Z" });
    const result = validateLegacyLedger([first, second]);
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(2);
    expect(result.issues).toHaveLength(0);
  });

  it("detecta índice y génesis inválidos", () => {
    const result = validateLegacyLedger([event({ index: 5, prevHash: "f".repeat(64) })]);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("INDEX_INVALID");
    expect(codes).toContain("GENESIS_INVALID");
    expect(result.firstInvalidSequence).toBe(5);
  });

  it("detecta enlace roto y retroceso de timestamp", () => {
    const first = event({ index: 0, hash: "a".repeat(64) });
    const second = event({ index: 1, prevHash: "b".repeat(64), timestamp: "2025-01-01T00:00:00.000Z" });
    const codes = validateLegacyLedger([first, second]).issues.map((issue) => issue.code);
    expect(codes).toContain("CHAIN_LINK_INVALID");
    expect(codes).toContain("TIMESTAMP_ORDER_INVALID");
  });

  it("advierte por CID no validado", () => {
    const result = validateLegacyLedger([event({ cid: "bafy123" })]);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("CID"))).toBe(true);
  });

  it("detecta nonce, formato y hash inválidos", () => {
    const result = validateLegacyLedger([event({ nonce: -1, module: "bad module", prevHash: "xyz", hash: "nope" })]);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("NONCE_INVALID");
    expect(codes).toContain("MODULE_INVALID");
    expect(codes).toContain("PREVIOUS_HASH_INVALID");
    expect(codes).toContain("EVENT_HASH_INVALID");
  });
});

describe("normalizeLegacy", () => {
  it("normaliza al esquema bookpi.event.v5 con CID y firma", () => {
    const cid = "bafybeigdyrzt5s7x2vhjkmbp5m2qwerty";
    const [first] = normalizeLegacy([event({ index: 3, cid, signature: "sig", keyId: "key-1" })]);
    expect(first?.schema).toBe("bookpi.event.v5");
    expect(first?.sequence).toBe(4);
    expect(first?.eventId).toBe("evt-1");
    expect(first?.policyVersion).toBe("1.0.0");
    expect(first?.actor.type).toBe("system");
    expect(first?.signature).toEqual({ algorithm: "Ed25519", keyId: "key-1", value: "sig" });
    expect(first?.storage).toEqual({ provider: "object-storage", contentAddress: "bafybeigdyrzt5s7x2vhjkmbp5m2qwerty" });
    expect(first?.payloadHash).toMatch(/^[0-9a-f]{128}$/);
  });

  it("usa legacy-json y actor service por defecto", () => {
    const [first] = normalizeLegacy([event({ actor: "worker", index: 2 })]);
    expect(first?.actor.type).toBe("service");
    expect(first?.storage).toEqual({ provider: "legacy-json" });
  });
});

describe("verifyNormalizedHashes", () => {
  it("marca payloadHash inválido y advierte por eventHash legacy", () => {
    const [good] = normalizeLegacy([event()]);
    expect(good).toBeDefined();
    if (!good) return;
    const tampered = { ...good, payloadHash: "0".repeat(128) };
    const bad = verifyNormalizedHashes([tampered]);
    expect(bad.valid).toBe(false);
    expect(bad.status).toBe("invalid");
    expect(bad.issues.some((issue) => issue.code === "PAYLOAD_HASH_INVALID")).toBe(true);

    const intact = verifyNormalizedHashes([good]);
    expect(intact.valid).toBe(true);
    expect(intact.status).toBe("unverified");
  });
});

describe("normalizeLedger", () => {
  it("compone estructura + hashes con esquema v5", () => {
    const ledger = normalizeLedger([event()]);
    expect(ledger.schema).toBe(BOOKPI_LEDGER_V5_SCHEMA);
    expect(ledger.source).toBe("legacy");
    expect(ledger.events).toHaveLength(1);
    expect(ledger.validation.valid).toBe(true);
    expect(ledger.validation.status).toBe("unverified");
  });

  it("rechaza un ledger vacío", () => {
    expect(normalizeLedger([]).validation.issues[0]?.code).toBe("EMPTY_LEDGER");
  });
});
