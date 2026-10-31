import { describe, expect, it } from "vitest";
import { TtlSingleFlight } from "../../src/deployment/ttl-single-flight";

describe("TTL single-flight probe cache", () => {
  it("coalesces concurrent requests and caches successful probes", async () => {
    const cache = new TtlSingleFlight<boolean>(1_000);
    let calls = 0;
    let release!: (value: boolean) => void;
    const loader = () => {
      calls += 1;
      return new Promise<boolean>((resolve) => { release = resolve; });
    };
    const first = cache.get(loader);
    const second = cache.get(loader);
    expect(calls).toBe(1);
    release(true);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    await expect(cache.get(async () => { calls += 1; return false; })).resolves.toBe(true);
    expect(calls).toBe(1);
  });

  it("does not cache failures and supports explicit invalidation", async () => {
    const cache = new TtlSingleFlight<number>(1_000);
    await expect(cache.get(async () => { throw new Error("probe failed"); })).rejects.toThrow("probe failed");
    await expect(cache.get(async () => 7)).resolves.toBe(7);
    cache.invalidate();
    await expect(cache.get(async () => 8)).resolves.toBe(8);
  });
  
  it("does not let an invalidated in-flight probe overwrite fresh state", async () => {
    const cache = new TtlSingleFlight<string>(1_000);
    let releaseOld!: (value: string) => void;
    let oldCalls = 0;
    const oldRequest = cache.get(() => {
      oldCalls += 1;
      return new Promise<string>((resolve) => { releaseOld = resolve; });
    });
    await Promise.resolve();
    cache.invalidate();
    const fresh = await cache.get(async () => "fresh");
    expect(fresh).toBe("fresh");
    releaseOld("stale");
    await expect(oldRequest).resolves.toBe("stale");
    await expect(cache.get(async () => "unexpected")).resolves.toBe("fresh");
    expect(oldCalls).toBe(1);
  });

});
