import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { measure, parseWav16 } from "../../src/inference/voice-analysis";
import { GenesisTtsEngine } from "../../src/tts/engine";
import { NativeFsimAdapter, nativeConfigFromEnv } from "../../src/tts/native-adapter";

/** A real 16-bit PCM WAV (205 Hz tone) served over a REAL local HTTP server that follows the documented contract. */
function wavBase64(): string {
  const sr = 16_000, n = sr;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(0.4 * 32000 * Math.sin((2 * Math.PI * 205 * i) / sr)), 44 + i * 2);
  return buf.toString("base64");
}

let server: Server;
let base = "";
const seen: { auth?: string | undefined; body?: Record<string, unknown> }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.method === "GET" && req.url === "/v1/status") { res.end(JSON.stringify({ state: "OPERATIONAL", device: "CPU" })); return; }
      if (req.method === "POST" && req.url === "/v1/synthesize") {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
        seen.push({ auth: req.headers.authorization, body });
        res.end(JSON.stringify({ status: "success", audio_base64: wavBase64(), audio_mime: "audio/wav", trace_id: "remote-1", experts_used: ["semantic_expert"] }));
        return;
      }
      res.statusCode = 404; res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

describe("native FSIM over real HTTP", () => {
  it("probes the service and reports it reachable", async () => {
    const cfg = nativeConfigFromEnv({ GENESIS_TTS_URL: base, GENESIS_TTS_TOKEN: "secret-token" })!;
    const probe = await new NativeFsimAdapter(cfg).probe(true);
    expect(probe).toMatchObject({ reachable: true, state: "OPERATIONAL" });
  });

  it("engine delivers real, decodable WAV audio and forwards bearer, emotion and region", async () => {
    const e = new GenesisTtsEngine({ env: { GENESIS_TTS_URL: base, GENESIS_TTS_TOKEN: "secret-token" } });
    const r = await e.synthesize({ text: "¡Qué gran noticia! Lamento el retraso, pero ya quedó listo el despliegue completo.", mode: "PODCAST", region: "norte", actorId: "session:e2e" }, 5_000);
    expect(r.status).toBe("audio");
    if (r.status !== "audio" || !r.audio) throw new Error("expected audio");
    expect(r.backend).toBe("native-fsim");
    const wav = Buffer.from(r.audio.dataUrl.split(",")[1] ?? "", "base64");
    const m = measure(parseWav16(wav));
    expect(Math.abs(m.f0.median - 205)).toBeLessThan(10);
    expect(seen.at(-1)?.auth).toBe("Bearer secret-token");
    expect(seen.at(-1)?.body).toMatchObject({ language: "es-MX", region: "norte", mode: "PODCAST", actor_id: "session:e2e" });
    expect((seen.at(-1)?.body?.emotion_vector as Record<string, number>).empathy).toBeGreaterThan(0);
    const status = await e.status();
    expect((status.backends as Record<string, { state: string }>)["native-fsim"]?.state).toBe("reachable");
    expect(status.audioServerSide).toBe(true);
  });

  it("an unreachable service degrades to a client plan instead of failing", async () => {
    const e = new GenesisTtsEngine({ env: { GENESIS_TTS_URL: "http://127.0.0.1:9" } });
    const r = await e.synthesize({ text: "Texto largo para modo podcast y revisar el respaldo.", mode: "PODCAST", actorId: "u" }, 800);
    expect(r.status).toBe("client-plan");
  });
});
