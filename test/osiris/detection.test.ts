import { describe, expect, it } from "vitest";
import { detect, maxSeverityOf, DEFAULT_DETECTION_RULES } from "../../src/osiris/detection";
import type { SecurityFeatures } from "../../src/osiris/types";

function run(features: SecurityFeatures) {
  return detect(features, { signalId: "sig-1", timestamp: "2026-10-11T12:00:00.000Z" });
}

describe("OSIRIS deterministic detection", () => {
  it("returns no findings for benign features", () => {
    const result = run({ requestRatePerMinute: 5, inputLength: 120, isAuthenticated: true, tls: true });
    expect(result.findings).toHaveLength(0);
    expect(result.maxSeverity).toBe("none");
    expect(result.score).toBe(0);
    expect(result.recommendation).toBe("ALLOW");
  });

  it("ignores undefined and non-finite features", () => {
    const result = run({ requestRatePerMinute: Number.NaN, failedAuthAttempts: undefined });
    expect(result.findings).toHaveLength(0);
  });

  it("flags rate anomalies with escalating severity", () => {
    expect(run({ requestRatePerMinute: 350 }).maxSeverity).toBe("medium");
    expect(run({ requestRatePerMinute: 1500 }).maxSeverity).toBe("high");
  });

  it("flags credential abuse after repeated auth failures", () => {
    const result = run({ failedAuthAttempts: 12 });
    expect(result.findings[0]?.category).toBe("credential_abuse");
    expect(result.maxSeverity).toBe("high");
    expect(result.recommendation).toBe("REVIEW");
  });

  it("flags injection and policy-evasion lexicons", () => {
    const injection = run({ contentFlags: ["prompt-injection"] });
    expect(injection.findings.some((f) => f.category === "injection_attempt")).toBe(true);
    const evasion = run({ contentFlags: ["jailbreak-lexicon"] });
    expect(evasion.findings.some((f) => f.category === "policy_evasion")).toBe(true);
  });

  it("flags reconnaissance sweeps", () => {
    expect(run({ uniqueResourceCount: 60 }).maxSeverity).toBe("medium");
    expect(run({ uniqueResourceCount: 500 }).maxSeverity).toBe("high");
  });

  it("flags unauthenticated access to sensitive resources", () => {
    const result = run({ isAuthenticated: false, contentFlags: ["sensitive-resource"] });
    expect(result.findings.some((f) => f.ruleId === "OSIRIS-EXPOSURE-001")).toBe(true);
  });

  it("composes multiple findings into a bounded score and stronger recommendation", () => {
    const result = run({ requestRatePerMinute: 1500, failedAuthAttempts: 12, contentFlags: ["jailbreak-lexicon"] });
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.recommendation).toBe("REVIEW");
  });

  it("every finding is frozen and deterministic", () => {
    const a = run({ failedAuthAttempts: 12 });
    const b = run({ failedAuthAttempts: 12 });
    expect(a.findings[0]).toBeDefined();
    expect(Object.isFrozen(a.findings[0])).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("exposes a non-empty rule catalog", () => {
    expect(DEFAULT_DETECTION_RULES.length).toBeGreaterThan(0);
    expect(maxSeverityOf([])).toBe("none");
  });
});
