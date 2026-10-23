import { describe, expect, it } from "vitest";
import { TemporalCognitionEngine } from "../../src/memory/temporal-cognition";

describe("Temporal Cognition Engine (YUN Ω)", () => {
  it("records versions and tracks current", () => {
    const e = new TemporalCognitionEngine<number>();
    const v1 = e.record(10, "init");
    const v2 = e.record(20, "update");
    expect(e.size).toBe(2);
    expect(e.currentVersion).toBe(2);
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
  });
  it("rollback and diff", () => {
    const e = new TemporalCognitionEngine<number>();
    e.record(10);
    e.record(20);
    e.rollback(1);
    expect(e.currentVersion).toBe(1);
    expect(e.diff(1, 2).changed).toBe(true);
  });
  it("counterfactual projection", () => {
    const e = new TemporalCognitionEngine<number>();
    e.record(10);
    const cf = e.counterfactual(1, "double", (s) => s * 2, 0.8);
    expect(cf.projectedState).toBe(20);
    expect(cf.confidence).toBe(0.8);
  });
  it("simulate with persist", () => {
    const e = new TemporalCognitionEngine<number>();
    e.record(5);
    const next = e.simulate((s) => s + 1, "sim", true);
    expect(next).toBe(6);
    expect(e.size).toBe(2);
  });
  it("verify integrity", () => {
    const e = new TemporalCognitionEngine<string>();
    e.record("a");
    e.record("b");
    expect(e.verify().valid).toBe(true);
    expect(e.verify().count).toBe(2);
  });
  it("rejects invalid input", () => {
    const e = new TemporalCognitionEngine<number>();
    e.record(1);
    expect(() => e.rollback(99)).toThrow();
    expect(() => e.counterfactual(1, "x", (s) => s, 1.5)).toThrow();
  });
});
