import { describe, expect, it } from "vitest";
import { buildBookPiEvent } from "../../src/bookpi/emitter";
import { eventCore, sha256Hex, ZERO_HASH } from "../../src/bookpi/crypto";
import { BOOKPI_PROTOCOL } from "../../src/bookpi/types";
import { makeSeed } from "./helpers";

describe("bookpi/emitter", () => {
  it("construye un evento canónico con integridad y hash", () => {
    const ev = buildBookPiEvent(makeSeed(), { sequence: 1 });
    expect(ev.type).toBe("TEST_EVENT");
    expect(ev.header.protocol).toBe(BOOKPI_PROTOCOL);
    expect(ev.prevHash).toBe(ZERO_HASH);
    expect(ev.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ev.integrity).toMatch(/^[0-9a-f]{128}$/);
  });

  it("el hash corresponde al núcleo canónico (sin hash/integrity/canonical)", () => {
    const ev = buildBookPiEvent(makeSeed(), { sequence: 1, timestamp: "2026-01-01T00:00:00.000Z" });
    expect(ev.hash).toBe(sha256Hex(eventCore(ev)));
  });

  it("el canon preserva hehepcontext {hexagon, domain}", () => {
    const ev = buildBookPiEvent(makeSeed(), { sequence: 1 });
    expect(ev.header.hehepcontext).toEqual({ hexagon: "H1", domain: "evolution" });
  });

  it("secuencia, prevHash y actorId se propagan desde ctx", () => {
    const ev = buildBookPiEvent(makeSeed(), {
      sequence: 7,
      prevHash: sha256Hex("prev"),
      actorId: "anubis",
    });
    expect(ev.sequence).toBe(7);
    expect(ev.prevHash).toBe(sha256Hex("prev"));
    expect(ev.actorId).toBe("anubis");
  });

  it("el id del evento es único entre llamadas", () => {
    const a = buildBookPiEvent(makeSeed());
    const b = buildBookPiEvent(makeSeed());
    expect(a.id).not.toBe(b.id);
  });
});