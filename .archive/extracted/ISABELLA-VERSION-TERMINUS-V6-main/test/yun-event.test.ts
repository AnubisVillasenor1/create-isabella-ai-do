import { describe, expect, it } from "vitest";
import { createYunEvent, verifyYunEvent } from "../src/federation/yun-event";

const validInput = {
  event_type: "policy.decision",
  domain: "governance",
  federation_id: "F1",
  entity_id: "workspace-123",
  trace_id: "trace-abc123",
  timestamp: "2026-10-11T12:00:00.000Z",
  severity: "audit" as const,
  payload: { policy_id: "external-action.v1", decision: "deny", details: { b: 2, a: 1 } },
};

describe("YUN event contract", () => {
  it("creates a frozen event with a verifiable content hash", () => {
    const event = createYunEvent(validInput, "event-001");
    expect(event.schema_version).toBe("1.0.0");
    expect(event.event_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyYunEvent(event)).toBe(true);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
  });

  it("canonicalizes object keys deterministically", () => {
    const first = createYunEvent(validInput, "event-001");
    const second = createYunEvent({
      ...validInput,
      payload: { decision: "deny", details: { a: 1, b: 2 }, policy_id: "external-action.v1" },
    }, "event-001");
    expect(first.event_hash).toBe(second.event_hash);
  });

  it("detects payload tampering", () => {
    const event = createYunEvent(validInput, "event-001");
    expect(verifyYunEvent({ ...event, payload: { decision: "allow" } })).toBe(false);
  });

  it("rejects invalid severity, timestamps and empty identifiers", () => {
    expect(() => createYunEvent({ ...validInput, severity: "fatal" as never })).toThrow(/severity/);
    expect(() => createYunEvent({ ...validInput, timestamp: "yesterday" })).toThrow(/timestamp/);
    expect(() => createYunEvent({ ...validInput, trace_id: "  " })).toThrow(/trace_id/);
  });

  it("rejects oversized payloads", () => {
    expect(() => createYunEvent({ ...validInput, payload: { message: "x".repeat(33 * 1024) } })).toThrow(/payload exceeds/);
  });
});
