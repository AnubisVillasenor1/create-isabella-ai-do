import { describe, expect, it } from "vitest";
import { IdempotencyStore, requestFingerprint } from "../../src/ingress/idempotency";

/** state: draft | engine-generated */
describe("IdempotencyStore", () => {
  const fp = requestFingerprint("POST", "/api/v1/x", { a: 1, b: [1, 2] });

  it("fingerprint is canonical (key order) and sensitive to method/path/body", () => {
    expect(requestFingerprint("post", "/p", { a: 1, b: 2 })).toBe(requestFingerprint("POST", "/p", { b: 2, a: 1 }));
    expect(requestFingerprint("POST", "/p", { a: 1 })).not.toBe(requestFingerprint("POST", "/p", { a: 2 }));
    expect(requestFingerprint("POST", "/p", {})).not.toBe(requestFingerprint("PUT", "/p", {}));
    expect(requestFingerprint("POST", "/p", {})).not.toBe(requestFingerprint("POST", "/q", {}));
  });

  it("executes once and replays the stored value", async () => {
    const s = new IdempotencyStore<number>();
    let calls = 0;
    const fn = async (): Promise<number> => { calls += 1; return 42; };
    expect(await s.run("key-12345678", fp, fn)).toEqual({ kind: "EXECUTED", value: 42 });
    expect(await s.run("key-12345678", fp, fn)).toEqual({ kind: "REPLAYED", value: 42 });
    expect(calls).toBe(1);
  });

  it("same key with a different request is a CONFLICT and does not execute", async () => {
    const s = new IdempotencyStore<number>();
    await s.run("key-12345678", fp, async () => 1);
    let called = false;
    const r = await s.run("key-12345678", requestFingerprint("POST", "/api/v1/x", { a: 2 }), async () => { called = true; return 2; });
    expect(r).toEqual({ kind: "CONFLICT" });
    expect(called).toBe(false);
  });

  it("concurrent duplicates share one execution", async () => {
    const s = new IdempotencyStore<number>();
    let calls = 0;
    const fn = (): Promise<number> => new Promise((resolve) => { calls += 1; setTimeout(() => resolve(7), 20); });
    const [a, b] = await Promise.all([s.run("key-12345678", fp, fn), s.run("key-12345678", fp, fn)]);
    expect(calls).toBe(1);
    expect(a.kind).toBe("EXECUTED");
    expect(b).toEqual({ kind: "REPLAYED", value: 7 });
  });

  it("failures are not cached; entries expire by TTL; invalid keys are refused", async () => {
    const s = new IdempotencyStore<number>(1000);
    await expect(s.run("key-12345678", fp, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await s.run("key-12345678", fp, async () => 5, 0)).toEqual({ kind: "EXECUTED", value: 5 });
    expect(await s.run("key-12345678", fp, async () => 6, 500)).toEqual({ kind: "REPLAYED", value: 5 });
    expect(await s.run("key-12345678", fp, async () => 6, 2000)).toEqual({ kind: "EXECUTED", value: 6 });
    for (const bad of ["", "short", "has space 123456", "x".repeat(129)]) {
      expect((await s.run(bad, fp, async () => 1)).kind).toBe("INVALID_KEY");
    }
  });

  it("bounds memory", async () => {
    const s = new IdempotencyStore<number>(1_000_000, 5);
    for (let i = 0; i < 20; i += 1) await s.run(`key-${String(i).padStart(8, "0")}`, fp, async () => i, i);
    expect(s.size).toBeLessThanOrEqual(5);
  });
});
