import { describe, expect, it } from "vitest";
import { Bulkhead, BulkheadRejectedError } from "../../src/resilience/bulkhead";
import { RetryExhaustedError, backoffDelay, isTransientError, retry } from "../../src/resilience/retry";

/** state: draft | engine-generated */
const transient = Object.assign(new Error("boom"), { status: 503 });

describe("backoffDelay", () => {
  it("is bounded by the exponential ceiling and the cap (full jitter)", () => {
    expect(backoffDelay(1, 100, 5000, () => 0.999)).toBe(99);
    expect(backoffDelay(3, 100, 5000, () => 0.5)).toBe(200);
    expect(backoffDelay(20, 100, 5000, () => 0.999)).toBeLessThan(5000);
    expect(backoffDelay(5, 100, 5000, () => 0)).toBe(0);
    expect(() => backoffDelay(0, 100, 5000, () => 0)).toThrow();
  });
});

describe("isTransientError", () => {
  it("classifies HTTP and network errors", () => {
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ statusCode: 429 })).toBe(true);
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 404 })).toBe(false);
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError(new Error("x"))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe("retry", () => {
  const fast = { sleep: async () => undefined, random: () => 0.5 };
  it("returns on first success without sleeping", async () => {
    expect(await retry(async () => "ok", fast)).toBe("ok");
  });
  it("retries transient errors then succeeds", async () => {
    const delays: number[] = [];
    let n = 0;
    const out = await retry(async () => { n += 1; if (n < 3) throw transient; return n; }, { ...fast, onRetry: (i) => delays.push(i.delayMs) });
    expect(out).toBe(3);
    expect(delays).toEqual([50, 100]);
  });
  it("does not retry permanent errors", async () => {
    let n = 0;
    await expect(retry(async () => { n += 1; throw Object.assign(new Error("bad"), { status: 400 }); }, fast)).rejects.toThrow("bad");
    expect(n).toBe(1);
  });
  it("gives up at maxAttempts with the last error attached", async () => {
    let n = 0;
    try { await retry(async () => { n += 1; throw transient; }, { ...fast, maxAttempts: 3 }); throw new Error("unreachable"); }
    catch (e) { expect(e).toBeInstanceOf(RetryExhaustedError); expect((e as RetryExhaustedError).reason).toBe("MAX_ATTEMPTS"); expect((e as RetryExhaustedError).lastError).toBe(transient); }
    expect(n).toBe(3);
  });
  it("honors the total deadline without sleeping past it", async () => {
    let t = 0;
    let slept = 0;
    try {
      await retry(async () => { t += 10; throw transient; }, { now: () => t, sleep: async (ms) => { slept += ms; t += ms; }, random: () => 0.99, baseDelayMs: 100, maxDelayMs: 1000, deadlineMs: 150, maxAttempts: 10 });
      throw new Error("unreachable");
    } catch (e) { expect((e as RetryExhaustedError).reason).toBe("DEADLINE"); }
    expect(slept).toBeLessThan(150);
  });
  it("stops when aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(retry(async () => "x", { signal: ac.signal })).rejects.toThrow("RETRY");
  });
  it("validates options", async () => {
    await expect(retry(async () => 1, { maxAttempts: 0 })).rejects.toThrow(RangeError);
    await expect(retry(async () => 1, { baseDelayMs: 10, maxDelayMs: 5 })).rejects.toThrow(RangeError);
  });
});

describe("Bulkhead", () => {
  const gate = () => { let open!: () => void; const p = new Promise<void>((r) => { open = r; }); return { p, open }; };
  it("limits concurrency, queues, and drains in order", async () => {
    const b = new Bulkhead({ maxConcurrent: 2, maxQueue: 5, queueTimeoutMs: 1000 });
    const g = gate();
    let running = 0, peak = 0;
    const task = async () => { running += 1; peak = Math.max(peak, running); await g.p; running -= 1; };
    const all = [1, 2, 3, 4, 5].map(() => b.run(task));
    await Promise.resolve();
    expect(b.stats().active).toBe(2);
    expect(b.stats().queued).toBe(3);
    g.open();
    await Promise.all(all);
    expect(peak).toBe(2);
    expect(b.stats()).toEqual({ active: 0, queued: 0, completed: 5, rejected: 0 });
  });
  it("sheds load when the queue is full", async () => {
    const b = new Bulkhead({ maxConcurrent: 1, maxQueue: 1, queueTimeoutMs: 1000 });
    const g = gate();
    const a = b.run(() => g.p);
    const q = b.run(() => g.p);
    await expect(b.run(async () => 1)).rejects.toBeInstanceOf(BulkheadRejectedError);
    g.open();
    await Promise.all([a, q]);
    expect(b.stats().rejected).toBe(1);
  });
  it("times out queued work", async () => {
    const b = new Bulkhead({ maxConcurrent: 1, maxQueue: 1, queueTimeoutMs: 10 });
    const g = gate();
    const a = b.run(() => g.p);
    await expect(b.run(async () => 1)).rejects.toThrow("QUEUE_TIMEOUT");
    g.open();
    await a;
    expect(b.stats().queued).toBe(0);
  });
  it("releases the slot when a task throws and rejects after close", async () => {
    const b = new Bulkhead({ maxConcurrent: 1, maxQueue: 0, queueTimeoutMs: 10 });
    await expect(b.run(async () => { throw new Error("x"); })).rejects.toThrow("x");
    expect(await b.run(async () => 7)).toBe(7);
    b.close();
    await expect(b.run(async () => 1)).rejects.toThrow("CLOSED");
  });
  it("validates configuration", () => {
    expect(() => new Bulkhead({ maxConcurrent: 0, maxQueue: 0, queueTimeoutMs: 1 })).toThrow();
    expect(() => new Bulkhead({ maxConcurrent: 1, maxQueue: -1, queueTimeoutMs: 1 })).toThrow();
  });
});
