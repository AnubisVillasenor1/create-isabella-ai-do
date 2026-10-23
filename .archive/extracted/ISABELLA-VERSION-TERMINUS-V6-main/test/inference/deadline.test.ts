import { describe, expect, it } from "vitest";
import { boundedBudgetMs, DeadlineBudget, MIN_ATTEMPT_MS } from "../../src/inference/deadline";

function fakeClock(start = 1_000) {
  let t = start;
  return { clock: { now: () => t }, advance: (ms: number) => { t += ms; } };
}

describe("DeadlineBudget", () => {
  it("caps each attempt by remaining budget", () => {
    const f = fakeClock();
    const b = new DeadlineBudget(10_000, f.clock);
    expect(b.attemptMs(8_000)).toBe(8_000);
    f.advance(6_000);
    expect(b.remainingMs()).toBe(4_000);
    expect(b.attemptMs(8_000)).toBe(4_000);
  });

  it("expires once less than the minimum attempt window remains", () => {
    const f = fakeClock();
    const b = new DeadlineBudget(5_000, f.clock);
    f.advance(5_000 - MIN_ATTEMPT_MS + 1);
    expect(b.expired()).toBe(true);
    f.advance(10_000);
    expect(b.remainingMs()).toBe(0);
    expect(b.attemptMs(8_000)).toBe(1);
  });

  it("bounds a worst-case sequential chain by the total budget", () => {
    const f = fakeClock();
    const b = new DeadlineBudget(20_000, f.clock);
    let attempts = 0;
    while (!b.expired()) {
      attempts += 1;
      f.advance(b.attemptMs(8_000)); // every provider hangs until its timeout
    }
    expect(attempts).toBe(3);
    expect(b.elapsedMs()).toBeLessThanOrEqual(20_000);
  });


  it("propagates caller cancellation to provider signals and prevents retries", () => {
    const controller = new AbortController();
    const budget = new DeadlineBudget(20_000, undefined, controller.signal);
    expect(budget.expired()).toBe(false);
    const signal = budget.signal(8_000);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(budget.cancelled()).toBe(true);
    expect(budget.expired()).toBe(true);
    expect(signal.aborted).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(() => new DeadlineBudget(0)).toThrow();
    expect(() => new DeadlineBudget(Number.NaN)).toThrow();
    expect(() => new DeadlineBudget(1000).attemptMs(-1)).toThrow();
  });

  it("parses bounded env values", () => {
    expect(boundedBudgetMs(undefined, 20_000, 6_000, 60_000)).toBe(20_000);
    expect(boundedBudgetMs("abc", 20_000, 6_000, 60_000)).toBe(20_000);
    expect(boundedBudgetMs("1", 20_000, 6_000, 60_000)).toBe(6_000);
    expect(boundedBudgetMs("999999", 20_000, 6_000, 60_000)).toBe(60_000);
  });
});

import { hedgedFirst } from "../../src/inference/deadline";

const later = <T>(ms: number, v: T | null) => () => new Promise<T | null>((r) => setTimeout(() => r(v), ms));

describe("hedgedFirst", () => {
  it("returns the first success and does not wait for slower earlier tasks", async () => {
    const t0 = Date.now();
    const win = await hedgedFirst([{ label: "slow", run: later(400, "S") }, { label: "fast", run: later(20, "F") }], 30);
    expect(win?.label).toBe("fast");
    expect(Date.now() - t0).toBeLessThan(300);
  });
  it("moves on immediately when a task yields null (no hedge wait)", async () => {
    const t0 = Date.now();
    const win = await hedgedFirst([{ label: "off", run: later(0, null) }, { label: "ok", run: later(10, "OK") }], 5_000);
    expect(win?.label).toBe("ok");
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("treats throws as null and resolves null when all fail", async () => {
    const boom = { label: "boom", run: () => Promise.reject(new Error("x")) };
    expect(await hedgedFirst([boom, boom], 10)).toBeNull();
    expect(await hedgedFirst([], 10)).toBeNull();
  });
  it("rejects a negative hedge delay", () => {
    expect(() => hedgedFirst([], -1)).toThrow();
  });
});
