import { describe, expect, it } from "vitest";
import { assessDefensePosture } from "../../src/osiris/posture";

describe("OSIRIS defense posture", () => {
  it("reports every unprobed control as unknown, never active", () => {
    const posture = assessDefensePosture();
    expect(posture.controls.length).toBeGreaterThan(0);
    expect(posture.activeCount).toBe(0);
    expect(posture.unknownCount).toBe(posture.controls.length);
    expect(posture.controls.every((c) => c.state === "unknown")).toBe(true);
  });

  it("never certifies and declares no trained model", () => {
    const posture = assessDefensePosture({ pqcAvailable: true, ledgerDurable: true });
    expect(posture.certification).toBe("NOT_CERTIFIED");
    expect(posture.trainedModelPresent).toBe(false);
  });

  it("distinguishes active, inactive and unknown controls", () => {
    const posture = assessDefensePosture({
      pqcAvailable: true,
      ed25519Active: false,
      secretsConfigured: true,
    });
    const byControl = new Map(posture.controls.map((c) => [c.control, c.state]));
    expect(byControl.get("post_quantum_readiness")).toBe("active");
    expect(byControl.get("signature_identity")).toBe("inactive");
    expect(byControl.get("secret_hygiene")).toBe("active");
    expect(byControl.get("rate_limiting")).toBe("unknown");
    expect(posture.activeCount).toBe(2);
  });

  it("freezes its output and stamps an assessment time", () => {
    const posture = assessDefensePosture({}, () => "2026-10-11T12:00:00.000Z");
    expect(posture.assessedAt).toBe("2026-10-11T12:00:00.000Z");
    expect(Object.isFrozen(posture)).toBe(true);
  });
});
