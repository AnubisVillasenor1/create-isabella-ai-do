import { describe, expect, it } from "vitest";
import { SessionMemory, type SessionMessage, deriveSessionId, formatSessionContext } from "../../src/memory/session-memory";

describe("session memory", () => {
  it("preserves message order and exposes a snapshot", () => {
    const mem = new SessionMemory();
    mem.addToSession("s1", { role: "user", content: "hola", timestamp: "t1" });
    mem.addToSession("s1", { role: "assistant", content: "¡Hola!", timestamp: "t2" });
    const history = mem.getSessionHistory("s1");
    expect(history.map((m) => m.role)).toEqual(["user", "assistant"]);
    const snap = mem.snapshot("s1");
    expect(snap?.messageCount).toBe(2);
    expect(snap?.createdAt).toBe("t1");
    expect(snap?.updatedAt).toBe("t2");
  });

  it("evicts the oldest messages beyond the per-session cap", () => {
    const mem = new SessionMemory({ maxMessagesPerSession: 2 });
    mem.addToSession("s1", { role: "user", content: "m1", timestamp: "t1" });
    mem.addToSession("s1", { role: "user", content: "m2", timestamp: "t2" });
    mem.addToSession("s1", { role: "user", content: "m3", timestamp: "t3" });
    const history = mem.getSessionHistory("s1");
    expect(history.map((m) => m.content)).toEqual(["m2", "m3"]);
  });

  it("evicts the oldest session beyond the session cap", () => {
    const mem = new SessionMemory({ maxSessions: 1 });
    mem.addToSession("first", { role: "user", content: "a", timestamp: "t1" });
    mem.addToSession("second", { role: "user", content: "b", timestamp: "t2" });
    expect(mem.getSessionCount()).toBe(1);
    expect(mem.snapshot("first")).toBeNull();
    expect(mem.snapshot("second")?.messageCount).toBe(1);
  });

  it("rejects invalid messages and options", () => {
    const mem = new SessionMemory();
    expect(() => mem.addToSession(" ", { role: "user", content: "x", timestamp: "t" })).toThrow("sessionId required");
    expect(() => mem.addToSession("s", { role: "user", content: "  ", timestamp: "t" })).toThrow("content required");
    expect(() => mem.addToSession("s", { role: "system" as SessionMessage["role"], content: "x", timestamp: "t" })).toThrow("role");
    expect(() => mem.addToSession("s", { role: "user", content: "x".repeat(50_001), timestamp: "t" })).toThrow("content too large");
    expect(() => new SessionMemory({ maxMessagesPerSession: 1 })).toThrow("maxMessagesPerSession");
  });

  it("derives deterministic session ids and falls back to a random id", () => {
    expect(deriveSessionId("abc")).toBe(deriveSessionId("abc"));
    expect(deriveSessionId("abc")).not.toBe(deriveSessionId("abd"));
    expect(deriveSessionId(undefined)).toMatch(/^[a-f0-9]{32}$/);
  });

  it("formats session context with role labels and a hard limit", () => {
    expect(formatSessionContext([])).toBe("");
    const messages = [{ role: "user" as const, content: "c", timestamp: "t1" }, { role: "assistant" as const, content: "r".repeat(500), timestamp: "t2" }];
    const out = formatSessionContext(messages, 10);
    expect(out).toContain("Usuario: c");
    expect(out).toContain("Isabella:");
    expect(out).not.toContain("r".repeat(310));
  });
});