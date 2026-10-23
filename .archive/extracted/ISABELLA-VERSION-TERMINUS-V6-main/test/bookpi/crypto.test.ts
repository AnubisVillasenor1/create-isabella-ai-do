import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  computeEventHash,
  computeEventIntegrity,
  hmacSha256Hex,
  sha256Hex,
  sha3_512Hex,
  signEvent,
  verifyEventSignature,
  ZERO_HASH,
} from "../../src/bookpi/crypto";
import { buildBookPiEvent } from "../../src/bookpi/emitter";
import { makeSeed } from "./helpers";

describe("bookpi/crypto", () => {
  it("canonicalJson ordena claves y es estable", () => {
    const a = canonicalJson({ b: 1, a: [2, { z: 3, y: 4 }], c: null });
    const b = canonicalJson({ c: null, a: [2, { y: 4, z: 3 }], b: 1 });
    expect(a).toBe('{"a":[2,{"y":4,"z":3}],"b":1,"c":null}');
    expect(a).toBe(b);
  });

  it("sha256Hex es determinista y de 64 hex", () => {
    const h = sha256Hex("tamv-federation-v1");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("tamv-federation-v1")).toBe(h);
  });

  it("sha3_512Hex genera 128 hex", () => {
    expect(sha3_512Hex("x")).toMatch(/^[0-9a-f]{128}$/);
  });

  it("computeEventHash cambia con el payload", () => {
    const e1 = buildBookPiEvent(makeSeed({ payload: { x: 1 } }), { actorId: "A" });
    const e2 = buildBookPiEvent(makeSeed({ payload: { x: 2 } }), { actorId: "A" });
    expect(e1.hash).not.toBe(e2.hash);
  });

  it("computeEventIntegrity depende de la llave", () => {
    const h = sha256Hex("hash");
    expect(computeEventIntegrity(h, "k1")).not.toBe(computeEventIntegrity(h, "k2"));
  });

  it("signEvent/verifyEventSignature: roundtrip y rechazo de manipulación", () => {
    const hash = computeEventHash(buildBookPiEvent(makeSeed()));
    const sig = signEvent(hash, "anubis", "secret");
    expect(verifyEventSignature(sig, hash, "anubis", "secret")).toBe(true);
    expect(verifyEventSignature(sig, hash, "otro", "secret")).toBe(false);
    expect(verifyEventSignature(sig, sha256Hex("other"), "anubis", "secret")).toBe(false);
    expect(verifyEventSignature(sig, hash, "anubis", "wrong-secret")).toBe(false);
  });

  it("ZERO_HASH es la raíz de la cadena", () => {
    expect(ZERO_HASH).toMatch(/^0{64}$/);
  });

  it("hmacSha256Hex es determinista y verificable", () => {
    const a = hmacSha256Hex("msg", "key");
    const b = hmacSha256Hex("msg", "key");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});