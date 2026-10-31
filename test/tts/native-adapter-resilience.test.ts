import { describe, expect, it } from "vitest";
import { NativeFsimAdapter } from "../../src/tts/native-adapter";

const B64 = Buffer.from("RIFFxxxxWAVEfmt ").toString("base64");

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

const REQUEST = {
  text: "hola",
  region: "TAMV",
  mode: "CONVERSACION",
  emotion: { excitement: 0.5 },
};

describe("NativeFsimAdapter · resilience", () => {
  it("returns decoded audio on success and clears failure counters", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ status: "success", audio_base64: B64, audio_mime: "audio/wav", trace_id: "t1" })) as unknown as typeof fetch;
    const adapter = new NativeFsimAdapter({ baseUrl: "http://x", token: null }, fetchImpl, () => 0);
    const audio = await adapter.synthesize(REQUEST, 1_000);
    expect(audio?.mimeType).toBe("audio/wav");
    expect(audio?.bytes).toBeGreaterThan(0);
    expect(audio?.remoteTraceId).toBe("t1");
    const telemetry = adapter.telemetry();
    expect(telemetry.attempts).toBe(1);
    expect(telemetry.successes).toBe(1);
    expect(telemetry.failureRate).toBe(0);
    expect(telemetry.inCooldown).toBe(false);
  });

  it("retries a 5xx once within the deadline, then succeeds", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ error: "boom" }, 503);
      return jsonResponse({ status: "success", audio_base64: B64, audio_mime: "audio/mpeg" });
    }) as unknown as typeof fetch;
    const adapter = new NativeFsimAdapter({ baseUrl: "http://x", token: null }, fetchImpl, () => 0, 30_000, 1);
    const audio = await adapter.synthesize(REQUEST, 5_000);
    expect(calls).toBe(2);
    expect(audio?.mimeType).toBe("audio/mpeg");
    expect(adapter.telemetry().successes).toBe(1);
  });

  it("enters exponential cooldown after repeated failures and reports the rate", async () => {
    let now = 0;
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const adapter = new NativeFsimAdapter({ baseUrl: "http://x", token: null }, fetchImpl, () => now, 1_000, 1);
    expect(await adapter.synthesize(REQUEST, 1_000)).toBeNull();
    const first = adapter.telemetry();
    expect(first.failureRate).toBe(1);
    expect(first.inCooldown).toBe(true);
    // First failure: cooldownUntil = 0 + 1000 * 2^0 = 1000.
    expect(adapter.available()).toBe(false);
    // Second failure at now=1100 backs off by 2x the base cooldown → until 3100.
    now = 1_100;
    expect(await adapter.synthesize(REQUEST, 1_000)).toBeNull();
    now = 3_099;
    expect(adapter.available()).toBe(false);
    // Cooldown elapsed but the failed probe is still fresh (< 15 s), so routing
    // stays conservatively unavailable until the probe goes stale or succeeds.
    now = 3_100;
    expect(adapter.available()).toBe(false);
    now = 1_100 + 15_000;
    expect(adapter.available()).toBe(true);
    expect(adapter.telemetry().consecutiveFailures).toBe(2);
  });

  it("rejects a malformed payload without retrying", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return jsonResponse({ status: "success", audio_base64: B64, audio_mime: "text/plain" });
    }) as unknown as typeof fetch;
    const adapter = new NativeFsimAdapter({ baseUrl: "http://x", token: null }, fetchImpl, () => 0, 1_000, 1);
    expect(await adapter.synthesize(REQUEST, 1_000)).toBeNull();
    expect(calls).toBe(1); // contract violation: not retried
    expect(adapter.telemetry().inCooldown).toBe(true);
  });

  it("reports a null failure rate before the first attempt", () => {
    const adapter = new NativeFsimAdapter({ baseUrl: "http://x", token: null });
    expect(adapter.telemetry().failureRate).toBeNull();
    expect(adapter.telemetry().attempts).toBe(0);
  });

  it("probes and caches reachability", async () => {
    let calls = 0;
    let now = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return jsonResponse({ state: "OPERATIONAL" });
    }) as unknown as typeof fetch;
    const adapter = new NativeFsimAdapter({ baseUrl: "http://x", token: null }, fetchImpl, () => now);
    expect((await adapter.probe()).reachable).toBe(true);
    now = 1_000;
    expect((await adapter.probe()).reachable).toBe(true);
    expect(calls).toBe(1); // cached for 15 s
    now = 20_000;
    await adapter.probe();
    expect(calls).toBe(2);
  });
});
