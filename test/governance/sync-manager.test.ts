import { describe, expect, it } from "vitest";
import {
  Lock,
  Semaphore,
  BoundedSemaphore,
  Event,
  Condition,
  Barrier,
  RLock,
  EntityMutationManager,
  allowManagerLifecycleTransition,
  issueManagerToken,
  tokenIsValid,
  revokeToken,
  reconcileBeforeRelease,
  scopeKey,
} from "../../src/governance";

const scope = { tenantId: "t1", workspace: "ws", service: "ikes" };

describe("sync manager", () => {
  it("bounds semaphore permits and rejects overflow release", async () => {
    const sem = new BoundedSemaphore(1);
    await sem.acquire();
    expect(sem.availablePermits).toBe(0);
    sem.release();
    expect(() => sem.release()).toThrow();
  });

  it("lock acquisition honors timeout and rejects a wrong owner", async () => {
    const lock = new Lock();
    const owner = await lock.acquire();
    await expect(lock.acquire(5, "waiter")).rejects.toThrow(/timeout/);
    expect(() => (lock.release as unknown as () => void)()).toThrow(/owner required/);
    expect(() => lock.release("wrong-owner")).toThrow(/owner mismatch/);
    lock.release(owner);
  });

  it("semaphore times out when exhausted", async () => {
    const sem = new Semaphore(1);
    await sem.acquire();
    await expect(sem.acquire(10)).rejects.toThrow(/timeout/);
  });

  it("transfers queued permits without inflating capacity", async () => {
    const sem = new BoundedSemaphore(1);
    await sem.acquire();
    const queued = sem.acquire(1000);
    sem.release();
    await queued;
    expect(sem.availablePermits).toBe(0);
    sem.release();
    expect(sem.availablePermits).toBe(1);
    expect(() => sem.release()).toThrow(/overflow/);
  });

  it("recovers a barrier after a timed-out generation", async () => {
    const barrier = new Barrier(2);
    await expect(barrier.wait(5)).rejects.toThrow(/generation aborted/);
    await Promise.all([barrier.wait(100), barrier.wait(100)]);
  });

  it("cleans timed-out event waiters and wakes condition waiters", async () => {
    await expect(new Event().wait(5)).rejects.toThrow(/event wait timeout/);
    const condition = new Condition();
    let ready = false;
    const waiting = condition.waitFor(() => ready, 1000);
    ready = true;
    condition.notifyAll();
    await expect(waiting).resolves.toBeUndefined();
  });

  it("event, barrier and reentrant lock behave", async () => {
    const event = new Event();
    expect(event.isSet()).toBe(false);
    const waiter = event.wait(1000);
    event.set();
    await waiter;

    const barrier = new Barrier(2);
    await Promise.all([barrier.wait(1000), barrier.wait(1000)]);

    const lock = new RLock();
    const owner = await lock.acquire();
    await lock.acquire(1000, owner);
    lock.release(owner);
    expect(lock.isLocked()).toBe(true);
    lock.release(owner);
    expect(lock.isLocked()).toBe(false);
  });

  it("serializes mutation by entity and scopes correctly", async () => {
    const manager = new EntityMutationManager();
    const order: number[] = [];
    await Promise.all([
      manager.mutate(scope, "e1", async () => { order.push(1); await new Promise((r) => setTimeout(r, 5)); order.push(2); }),
      manager.mutate(scope, "e1", async () => { order.push(3); }),
    ]);
    expect(order).toEqual([1, 2, 3]);
    expect(scopeKey(scope)).toBe("2:t1|2:ws|4:ikes|");
    expect(() => manager.assertNoLocksHeld()).not.toThrow();
  });

  it("enforces lifecycle transitions and token validity", () => {
    expect(allowManagerLifecycleTransition("INITIAL", "STARTED")).toBe(true);
    expect(allowManagerLifecycleTransition("INITIAL", "SHUTDOWN")).toBe(false);

    const token = issueManagerToken({ scope, capabilities: ["read"], ttlMs: 1000, at: "2026-01-01T00:00:00Z" });
    expect(tokenIsValid(token, new Date("2026-01-01T00:00:00.500Z"))).toBe(true);
    expect(tokenIsValid(token, new Date("2026-01-01T01:00:00Z"))).toBe(false);
    expect(tokenIsValid(revokeToken(token), new Date("2026-01-01T00:00:00.500Z"))).toBe(false);
    expect(tokenIsValid(token, new Date("2026-01-01T00:00:00.500Z"))).toBe(false);
  });

  it("does not reconcile empty markers or alias different scopes", () => {
    expect(reconcileBeforeRelease({ git: "", index: "", bookpi: "" }).reconciled).toBe(false);
    expect(scopeKey({ tenantId: "a/b", workspace: "c", service: "d" }))
      .not.toBe(scopeKey({ tenantId: "a", workspace: "b/c", service: "d" }));
  });

  it("reconciles git/index/bookpi before release", () => {
    expect(reconcileBeforeRelease({ git: "a", index: "a", bookpi: "a" }).reconciled).toBe(true);
    const divergent = reconcileBeforeRelease({ git: "a", index: "b", bookpi: "a" });
    expect(divergent.reconciled).toBe(false);
    expect(divergent.divergent.length).toBeGreaterThan(0);
  });
});
