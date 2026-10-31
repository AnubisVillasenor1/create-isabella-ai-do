import { describe, expect, it } from "vitest";
import { deriveSessionId } from "../../src/memory/session-memory";
import { LocalInferenceEngine } from "../../src/inference/local-engine";
import { PROTOCOL_CATALOG } from "../../src/protocols/catalog";

/**
 * Regresiones de la auditoría 2026-10-13.
 * state: draft | engine-generated (pendiente de revisión humana con nombre).
 */
describe("audit 2026-10-13 regressions", () => {
  it("AUD-01: anonymous session ids come from a CSPRNG (unique, 32 hex)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const id = deriveSessionId(undefined);
      expect(id).toMatch(/^[a-f0-9]{32}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(500);
  });

  it("AUD-01: explicit session ids remain deterministic", () => {
    expect(deriveSessionId("  abc ")).toBe(deriveSessionId("abc"));
    expect(deriveSessionId("abc")).not.toBe(deriveSessionId("abd"));
  });

  it("AUD-02: verify_event accepts only the exact signature and rejects non-strings", async () => {
    const sign = PROTOCOL_CATALOG.find((p) => p.id === "isabella.security.sign_event");
    const verify = PROTOCOL_CATALOG.find((p) => p.id === "isabella.security.verify_event");
    if (!sign || !verify) throw new Error("protocols missing");
    const payload = { a: 1, b: "x" };
    const signed = (await sign.execute({ input: { payload, actorId: "anubis" } })) as { signature: string };
    const ok = (await verify.execute({ input: { payload, actorId: "anubis", signature: signed.signature } })) as { valid: boolean };
    expect(ok.valid).toBe(true);
    const wrongActor = (await verify.execute({ input: { payload, actorId: "otro", signature: signed.signature } })) as { valid: boolean };
    expect(wrongActor.valid).toBe(false);
    const tampered = (await verify.execute({ input: { payload: { a: 2, b: "x" }, actorId: "anubis", signature: signed.signature } })) as { valid: boolean };
    expect(tampered.valid).toBe(false);
    for (const bad of [undefined, 123, null, {}, "", "zz", signed.signature.slice(0, 10)]) {
      const r = (await verify.execute({ input: { payload, actorId: "anubis", signature: bad } })) as { valid: boolean };
      expect(r.valid).toBe(false);
    }
  });

  it("AUD-03: local engine intent replies are deterministic per prompt (no Math.random)", async () => {
    const a = new LocalInferenceEngine();
    const b = new LocalInferenceEngine();
    const prompts = ["Hola, ¿cómo estás?", "hola", "buenos días isabella", "háblame de Real del Monte"];
    for (const prompt of prompts) {
      const r1 = await a.generate({ prompt, maxTokens: 200 });
      const r2 = await b.generate({ prompt, maxTokens: 200 });
      const r3 = await a.generate({ prompt, maxTokens: 200 });
      if (r1.confidence === "HIGH") {
        expect(r2.text).toBe(r1.text);
        expect(r3.text).toBe(r1.text);
      }
    }
  });
});

describe("AUD-02b canonical payload hashing", () => {
  it("key order of the payload does not change the signature", async () => {
    const sign = PROTOCOL_CATALOG.find((p) => p.id === "isabella.security.sign_event");
    if (!sign) throw new Error("protocol missing");
    const a = (await sign.execute({ input: { payload: { a: 1, b: { x: 1, y: 2 } }, actorId: "u" } })) as { signature: string };
    const b = (await sign.execute({ input: { payload: { b: { y: 2, x: 1 }, a: 1 }, actorId: "u" } })) as { signature: string };
    expect(a.signature).toBe(b.signature);
  });
});
