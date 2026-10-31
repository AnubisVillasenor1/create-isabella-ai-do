import { describe, expect, it } from "vitest";
import { GenesisTtsEngine } from "../../src/tts/engine";
import { MemoryVoiceCore } from "../../src/tts/memory";
import { NativeFsimAdapter, nativeConfigFromEnv } from "../../src/tts/native-adapter";
import { TtsGovernor, sealTtsEvidence } from "../../src/tts/governance";
import { integerToSpanish, normalizeEsMx } from "../../src/tts/normalize";
import { detectCulturalCues, inferEmotion, planProsody } from "../../src/tts/prosody";
import { CognitiveRouter, routeFeatures } from "../../src/tts/router";

const b64 = Buffer.from("RIFFfakewavebytes").toString("base64");
const okFetch = (body: Record<string, unknown>, status = 200): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("normalizeEsMx", () => {
  it("reads Spanish integers with apocope and big numbers", () => {
    expect(integerToSpanish(21_000)).toBe("veintiún mil");
    expect(integerToSpanish(1_500_000)).toBe("un millón quinientos mil");
    expect(integerToSpanish(1_000_000_000)).toBe("mil millones");
    expect(integerToSpanish(2026)).toBe("dos mil veintiséis");
    expect(integerToSpanish(100)).toBe("cien");
    expect(() => integerToSpanish(-1)).toThrow();
  });
  it("handles es-MX money, percent, decimals, acronyms, abbreviations and markdown", () => {
    const t = normalizeEsMx("**Costo:** $1,500.50 y 19 USD con 16.7% en la CDMX. Dr. Pérez usa la API en https://x.io a las 10:00. ```x=1```");
    expect(t).toContain("mil quinientos pesos con cincuenta centavos");
    expect(t).toContain("diecinueve dólares");
    expect(t).toContain("dieciséis punto siete por ciento");
    expect(t).toContain("ce de eme equis");
    expect(t).toContain("doctor Pérez");
    expect(t).toContain("a pe i");
    expect(t).toContain("diez en punto");
    expect(t).toContain("enlace");
    expect(t).not.toMatch(/\*\*|```|https?:/);
  });
});

describe("prosody planner", () => {
  it("detects cultural cues with stated confidence and disambiguates 'ahorita'", () => {
    expect(detectCulturalCues("No estuvo tan mal.").map((c) => c.id)).toContain("litotes-elogio");
    expect(detectCulturalCues("Ahorita mismo lo hago").map((c) => c.id)).toEqual(["ahorita-inmediato"]);
    expect(detectCulturalCues("Ahorita voy, al rato").map((c) => c.id)).toEqual(["ahorita-posterior"]);
    const amb = detectCulturalCues("Ahorita te digo");
    expect(amb[0]?.id).toBe("ahorita-ambiguo");
    expect(amb[0]?.confidence).toBeLessThan(0.5);
  });
  it("infers bounded emotion and lets an explicit vector win", () => {
    const e = inferEmotion("¡Es urgente! Lamento el error.", { urgency: 2, calm: -1, bogus: 1 });
    expect(e.urgency).toBe(1);
    expect(e.calm).toBe(0);
    expect(e.empathy).toBeGreaterThan(0.5);
    expect(Object.keys(e)).toHaveLength(12);
  });
  it("plans phrases within safe bounds with paragraph pauses near the reference profile", () => {
    const p = planProsody("Hola. ¿Cómo estás?\n\nTodo bien, gracias.");
    expect(p.phrases.length).toBeGreaterThanOrEqual(3);
    for (const ph of p.phrases) { expect(ph.rate).toBeGreaterThanOrEqual(0.7); expect(ph.rate).toBeLessThanOrEqual(1.3); expect(ph.pitch).toBeGreaterThanOrEqual(0.8); expect(ph.pitch).toBeLessThanOrEqual(1.25); }
    expect(p.phrases.at(-1)?.pauseAfterMs).toBe(0);
    expect(p.phrases.find((x) => x.text.startsWith("¿"))?.pitch).toBeGreaterThan(p.phrases[0]!.pitch - 0.001);
    expect(p.estimatedDurationMs).toBeGreaterThan(1000);
  });
  it("urgency speeds up and calm slows down", () => {
    const fast = planProsody("Hazlo.", { emotion: { urgency: 1 } }).phrases[0]!.rate;
    const slow = planProsody("Hazlo.", { emotion: { calm: 1 } }).phrases[0]!.rate;
    expect(fast).toBeGreaterThan(slow);
  });
});

describe("router", () => {
  const plan = planProsody("¡Qué gran noticia!");
  it("masks unavailable experts and renormalises weights to 1", () => {
    const r = new CognitiveRouter();
    const d = r.route([{ id: "native-fsim", available: false }, { id: "server-tts", available: true }, { id: "browser-speech", available: true }], routeFeatures(plan, "CONVERSACION", 20));
    expect(d.ranked.map((x) => x.id)).not.toContain("native-fsim");
    expect(d.ranked.reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1, 2);
  });
  it("prefers the browser for real-time and the neural service for quality mode when available", () => {
    const r = new CognitiveRouter();
    const all = [{ id: "native-fsim" as const, available: true }, { id: "server-tts" as const, available: true }, { id: "browser-speech" as const, available: true }];
    expect(r.route(all, routeFeatures(plan, "TIEMPO_REAL", 20)).ranked[0]?.id).toBe("browser-speech");
    expect(r.route(all, routeFeatures(plan, "PODCAST", 500)).ranked[0]?.id).toBe("native-fsim");
  });
  it("returns an empty ranking when nothing is available", () => {
    expect(new CognitiveRouter().route([{ id: "native-fsim", available: false }], {}).ranked).toEqual([]);
  });
});

describe("memory, governance, evidence", () => {
  it("applies whole-word case-insensitive pronunciations per actor and can erase them", () => {
    const m = new MemoryVoiceCore();
    m.learn("a", "Kubernetes", "Kúbernetes");
    expect(m.apply("a", "Uso kubernetes y KubernetesX")).toBe("Uso Kúbernetes y KubernetesX");
    expect(m.apply("b", "Uso kubernetes")).toBe("Uso kubernetes");
    expect(m.forget("a")).toBe(true);
    expect(m.apply("a", "kubernetes")).toBe("kubernetes");
    expect(() => m.learn("a", "x", "y")).toThrow();
    expect(() => m.learn("a", "ok<", "y")).toThrow();
  });
  it("blocks nonce replay, expires nonces, enforces strict actor and size", () => {
    let t = 1_000;
    const g = new TtsGovernor({ strict: true, nonceTtlMs: 100, now: () => t });
    expect(g.validate({ nonce: "nonce-12345", actorId: "u", textLength: 5 }).allowed).toBe(true);
    expect(g.validate({ nonce: "nonce-12345", actorId: "u", textLength: 5 })).toEqual({ allowed: false, reason: "NONCE_REPLAY_DETECTED" });
    t += 200;
    expect(g.validate({ nonce: "nonce-12345", actorId: "u", textLength: 5 }).allowed).toBe(true);
    expect(g.validate({ actorId: undefined, textLength: 5 })).toEqual({ allowed: false, reason: "ACTOR_ID_REQUIRED" });
    expect(g.validate({ actorId: "u", textLength: 0 }).allowed).toBe(false);
    expect(g.validate({ actorId: "u", textLength: 99_999 })).toEqual({ allowed: false, reason: "TEXT_TOO_LONG" });
    expect(g.validate({ nonce: "bad nonce!", actorId: "u", textLength: 5 })).toEqual({ allowed: false, reason: "NONCE_INVALID" });
  });
  it("evidence seal covers the whole text, not a prefix", () => {
    const base = { traceId: "t1", backend: "browser-speech", planDigest: "d" };
    const a = sealTtsEvidence({ ...base, normalizedText: "x".repeat(200) + "A" });
    const b = sealTtsEvidence({ ...base, normalizedText: "x".repeat(200) + "B" });
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{128}$/);
  });
});

describe("native adapter + engine", () => {
  const cfg = { baseUrl: "http://127.0.0.1:8600", token: "tok" };
  it("config only from a valid URL; cleartext off-box refused in production", () => {
    expect(nativeConfigFromEnv({})).toBeNull();
    expect(nativeConfigFromEnv({ GENESIS_TTS_URL: "ftp://x" })).toBeNull();
    expect(nativeConfigFromEnv({ GENESIS_TTS_URL: "http://10.0.0.5:8600", NODE_ENV: "production" })).toBeNull();
    expect(nativeConfigFromEnv({ GENESIS_TTS_URL: "http://127.0.0.1:8600/", NODE_ENV: "production" })?.baseUrl).toBe("http://127.0.0.1:8600");
  });
  it("accepts a valid audio payload and rejects path-only, bad mime and bad base64 (with cooldown)", async () => {
    const req = { text: "hola", region: "cdmx", mode: "PODCAST", emotion: {} };
    const good = new NativeFsimAdapter(cfg, okFetch({ status: "success", audio_base64: b64, audio_mime: "audio/wav", experts_used: ["a"] }));
    expect((await good.synthesize(req, 1000))?.bytes).toBeGreaterThan(0);
    const pathOnly = new NativeFsimAdapter(cfg, okFetch({ status: "success", audio_path: "./build/x.wav" }));
    expect(await pathOnly.synthesize(req, 1000)).toBeNull();
    expect(pathOnly.available()).toBe(false);
    expect(await new NativeFsimAdapter(cfg, okFetch({ status: "success", audio_base64: b64, audio_mime: "text/html" })).synthesize(req, 1000)).toBeNull();
    expect(await new NativeFsimAdapter(cfg, okFetch({ status: "success", audio_base64: "@@@", audio_mime: "audio/wav" })).synthesize(req, 1000)).toBeNull();
  });
  it("engine returns REAL audio from the neural service when it is the top route", async () => {
    const native = new NativeFsimAdapter(cfg, okFetch({ status: "success", audio_base64: b64, audio_mime: "audio/wav" }));
    const e = new GenesisTtsEngine({ env: {}, native, serverTts: async () => null });
    const r = await e.synthesize({ text: "Gracias por tu paciencia, esto es un texto largo para el modo podcast.", mode: "PODCAST", actorId: "u" });
    expect(r.status).toBe("audio");
    if (r.status === "audio") { expect(r.backend).toBe("native-fsim"); expect(r.audio?.dataUrl.startsWith("data:audio/wav;base64,")).toBe(true); expect(r.evidenceHash).toHaveLength(128); }
  });
  it("falls through to a CLIENT PLAN (no fake audio) when no backend yields bytes", async () => {
    const native = new NativeFsimAdapter(cfg, okFetch({ status: "error" }, 500));
    const e = new GenesisTtsEngine({ env: {}, native, serverTts: async () => null });
    const r = await e.synthesize({ text: "Hola, ¿qué onda?", mode: "PODCAST", actorId: "u" });
    expect(r.status).toBe("client-plan");
    if (r.status === "client-plan") { expect(r.audio).toBeNull(); expect(r.backend).toBe("browser-speech"); expect(r.plan.phrases.length).toBeGreaterThan(0); expect(r.voice).toBe("isabella-esmx-female-v1"); }
  });
  it("uses server TTS bytes when configured and ranked, and denies replayed nonces", async () => {
    const e = new GenesisTtsEngine({ env: { GROQ_API_KEY: "k", GROQ_TTS_MODEL: "m" }, native: null, serverTts: async () => ({ provider: "groq", mimeType: "audio/wav", dataUrl: "data:audio/wav;base64,AAAA", bytes: 3, voice: "Celeste-PlayAI" }) });
    const first = await e.synthesize({ text: "Texto de prueba para el servidor de voz.", mode: "PODCAST", actorId: "u", nonce: "abcdefgh1" });
    expect(first.status === "audio" && first.backend).toBe("server-tts");
    const replay = await e.synthesize({ text: "Texto de prueba para el servidor de voz.", mode: "PODCAST", actorId: "u", nonce: "abcdefgh1" });
    expect(replay).toMatchObject({ status: "denied", reason: "NONCE_REPLAY_DETECTED" });
  });
  it("planStream segments sentences, assigns pauses and never implies audio", () => {
    const e = new GenesisTtsEngine({ env: {}, native: null });
    const result = e.planStream({
      text: "Primera oración de prueba. ¿Segunda oración de prueba? Tercera oración final.",
      actorId: "u",
      mode: "CONVERSACION",
    });
    expect(result.chunks.length).toBeGreaterThanOrEqual(3);
    expect(result.chunks.map((chunk) => chunk.index)).toEqual(result.chunks.map((_, i) => i));
    expect(result.chunks.every((chunk) => chunk.total === result.chunks.length)).toBe(true);
    expect(result.chunks.at(-1)?.pauseAfterMs).toBe(0);
    expect(result.chunks.slice(0, -1).every((chunk) => chunk.pauseAfterMs > 0)).toBe(true);
    expect(result.chunks.every((chunk) => chunk.plan.phrases.length > 0)).toBe(true);
    const summed = result.chunks.reduce((total, chunk) => total + chunk.estimatedDurationMs + chunk.pauseAfterMs, 0);
    expect(result.estimatedDurationMs).toBe(summed);
    expect(result.estimatedDurationMs).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("audio");
  });

  it("status is truthful: nothing configured means no server audio and spec-only items are listed", async () => {
    const s = await new GenesisTtsEngine({ env: {}, native: null }).status();
    expect(s.audioServerSide).toBe(false);
    expect((s.backends as Record<string, { state: string }>)["native-fsim"]?.state).toBe("not_configured");
    expect(s.designTargetsNotMeasured).toBe(true);
    expect((s.voice as { id: string; gender: string }).id).toBe("isabella-esmx-female-v1");
    expect((s.voice as { id: string; gender: string }).gender).toBe("female");
    expect(JSON.stringify(s)).toContain("BigVGAN");
  });
});
