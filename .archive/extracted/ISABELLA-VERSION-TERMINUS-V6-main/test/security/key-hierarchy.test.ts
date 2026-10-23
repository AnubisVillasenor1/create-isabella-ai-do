import { describe, expect, it } from "vitest";
import { KeyHierarchy } from "../../src/security/key-hierarchy";

/** state: draft | engine-generated */
describe("KeyHierarchy", () => {
  const root = KeyHierarchy.generateRoot();

  it("derives deterministic, purpose- and context-separated keys", () => {
    const h = new KeyHierarchy(root);
    const kek = h.derive("KEK", "tenant-a");
    expect(kek).toHaveLength(32);
    expect(h.derive("KEK", "tenant-a").equals(kek)).toBe(true);
    expect(h.derive("IK", "tenant-a").equals(kek)).toBe(false);
    expect(h.derive("KEK", "tenant-b").equals(kek)).toBe(false);
    expect(new KeyHierarchy(KeyHierarchy.generateRoot()).derive("KEK", "tenant-a").equals(kek)).toBe(false);
  });

  it("two-phase rotation: prepared epoch unusable until commit; old becomes verify-only then retired", () => {
    const h = new KeyHierarchy(root, 1000);
    const k1 = h.derive("SK", "ctx");
    expect(h.prepareRotation()).toBe(2);
    expect(() => h.derive("SK", "ctx", "protect", 2)).toThrow("not yet active");
    expect(h.commitRotation(10_000)).toBe(2);
    expect(h.derive("SK", "ctx").equals(k1)).toBe(false);
    expect(() => h.derive("SK", "ctx", "protect", 1, 10_500)).toThrow("verify-only");
    expect(h.derive("SK", "ctx", "verify", 1, 10_500).equals(k1)).toBe(true);
    expect(() => h.derive("SK", "ctx", "verify", 1, 11_000)).toThrow("retired");
  });

  it("abort and emergency retire", () => {
    const h = new KeyHierarchy(root);
    h.prepareRotation();
    h.abortRotation();
    expect(() => h.commitRotation()).toThrow();
    h.prepareRotation();
    h.commitRotation();
    h.emergencyRetireOlder();
    expect(() => h.derive("BK", "c", "verify", 1)).toThrow("retired");
    expect(() => h.derive("BK", "c", "verify", 99)).toThrow("unknown epoch");
  });

  it("validates inputs", () => {
    expect(() => new KeyHierarchy(Buffer.alloc(8))).toThrow();
    const h = new KeyHierarchy(root);
    expect(() => h.derive("KEK", "")).toThrow();
    expect(() => h.derive("KEK", "a\nb")).toThrow();
    expect(() => h.derive("XX" as never, "a")).toThrow();
  });
});
