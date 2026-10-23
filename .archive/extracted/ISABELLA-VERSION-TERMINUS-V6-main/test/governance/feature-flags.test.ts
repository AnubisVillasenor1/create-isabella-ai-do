import { describe, expect, it } from "vitest";
import { FeatureFlags, rolloutBucket } from "../../src/governance/feature-flags";
import { KillSwitch } from "../../src/security/kill-switch";

/** state: draft | engine-generated */
describe("FeatureFlags", () => {
  it("is fail-closed for unknown flags and invalid subjects", () => {
    const f = new FeatureFlags();
    expect(f.evaluate("nope", "u1")).toMatchObject({ enabled: false, reason: "UNKNOWN_FLAG" });
    f.define({ key: "chat", enabled: true, rolloutPercent: 100 });
    expect(f.evaluate("chat", "").reason).toBe("INVALID_SUBJECT");
    expect(f.evaluate("chat", "u1")).toMatchObject({ enabled: true, reason: "ROLLOUT_IN" });
  });
  it("honors disabled, deny list over allow list, and allow list over rollout", () => {
    const f = new FeatureFlags();
    f.define({ key: "x", enabled: false, rolloutPercent: 100 });
    expect(f.evaluate("x", "u").reason).toBe("DISABLED");
    f.define({ key: "y", enabled: true, rolloutPercent: 0, allowList: ["vip", "both"], denyList: ["both"] });
    expect(f.evaluate("y", "vip")).toMatchObject({ enabled: true, reason: "ALLOW_LIST" });
    expect(f.evaluate("y", "both")).toMatchObject({ enabled: false, reason: "DENY_LIST" });
    expect(f.evaluate("y", "other")).toMatchObject({ enabled: false, reason: "ROLLOUT_OUT" });
  });
  it("rollout is stable, monotonic and approximately proportional", () => {
    const at = (p: number) => { const f = new FeatureFlags(); f.define({ key: "r", enabled: true, rolloutPercent: p, salt: "s" }); return f; };
    const users = Array.from({ length: 4000 }, (_, i) => `user-${i}`);
    const in10 = users.filter((u) => at(10).evaluate("r", u).enabled);
    const in50 = new Set(users.filter((u) => at(50).evaluate("r", u).enabled));
    expect(in10.every((u) => in50.has(u))).toBe(true);
    expect(in10.length / users.length).toBeGreaterThan(0.08);
    expect(in10.length / users.length).toBeLessThan(0.12);
    expect(rolloutBucket("s", "r", "u")).toBe(rolloutBucket("s", "r", "u"));
    expect(rolloutBucket("s1", "r", "u")).not.toBe(rolloutBucket("s2", "r", "u"));
  });
  it("a kill-switch scope turns the flag off", () => {
    const ks = new KillSwitch({ authorizedKeys: new Map(), envFlag: false });
    const f = new FeatureFlags({ isHalted: (scope, now) => scope === "feature:chat" && ks.isHalted("GLOBAL", now) });
    f.define({ key: "chat", enabled: true, rolloutPercent: 100, killScope: "feature:chat" });
    expect(f.evaluate("chat", "u").enabled).toBe(true);
    const f2 = new FeatureFlags({ isHalted: () => true });
    f2.define({ key: "chat", enabled: true, rolloutPercent: 100, killScope: "feature:chat" });
    expect(f2.evaluate("chat", "u")).toMatchObject({ enabled: false, reason: "KILL_SWITCH" });
  });
  it("validates definitions and snapshots without subject ids", () => {
    const f = new FeatureFlags();
    expect(() => f.define({ key: "Bad Key", enabled: true, rolloutPercent: 1 })).toThrow();
    expect(() => f.define({ key: "ok", enabled: true, rolloutPercent: 101 })).toThrow();
    f.define({ key: "ok", enabled: true, rolloutPercent: 5, allowList: ["secret-user"] });
    expect(JSON.stringify(f.snapshot())).not.toContain("secret-user");
  });
});
