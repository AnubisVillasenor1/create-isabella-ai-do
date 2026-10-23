import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { synthesizeSpeech, transcribeAudio } from "../../src/inference/speech";

interface Captured {
  url: string;
  auth: string | undefined;
  contentType: string | undefined;
  body: string;
}

type Handler = (request: Captured) => { status: number; json?: unknown; raw?: Buffer; contentType?: string };

let server: Server;
let baseUrl = "";
let handler: Handler;
let lastRequest: Captured | null = null;

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      lastRequest = {
        url: req.url ?? "",
        auth: req.headers.authorization,
        contentType: req.headers["content-type"],
        body: Buffer.concat(chunks).toString("utf8"),
      };
      const result = handler(lastRequest);
      if (result.raw) {
        res.writeHead(result.status, { "content-type": result.contentType ?? "application/octet-stream" });
        res.end(result.raw);
        return;
      }
      res.writeHead(result.status, { "content-type": "application/json" });
      res.end(JSON.stringify(result.json ?? {}));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  lastRequest = null;
  handler = () => ({ status: 500, json: { error: "down" } });
});

describe("speech over a real HTTP loopback", () => {
  it("synthesizes speech and returns a playable data URL", async () => {
    handler = () => ({ status: 200, raw: Buffer.from("RIFFwav-armstoffen"), contentType: "audio/wav" });
    const env = { GROQ_API_KEY: "k", GROQ_BASE_URL: baseUrl, GROQ_TTS_MODEL: "test-tts-model", GROQ_TTS_VOICE: "troy" };
    const result = await synthesizeSpeech(env, { text: "hola mundo", format: "wav", timeoutMs: 5_000 });
    expect(result).toMatchObject({ provider: "groq", mimeType: "audio/wav" });
    expect(result?.dataUrl.startsWith("data:audio/wav;base64,")).toBe(true);
    expect(result?.bytes).toBeGreaterThan(0);
    expect(lastRequest?.url).toBe("/v1/audio/speech");
    expect(lastRequest?.auth).toBe("Bearer k");
    const sent = JSON.parse(lastRequest?.body ?? "{}") as { model?: string; input?: string; voice?: string };
    expect(sent).toMatchObject({ input: "hola mundo", voice: "troy" });
  });

  it("fails closed when the provider rejects synthesis", async () => {
    handler = () => ({ status: 400, json: { error: { message: "model_terms_required" } } });
    const env = { GROQ_API_KEY: "k", GROQ_BASE_URL: baseUrl };
    expect(await synthesizeSpeech(env, { text: "hola", timeoutMs: 5_000 })).toBeNull();
  });

  it("transcribes audio through a multipart request", async () => {
    handler = () => ({ status: 200, json: { text: "transcripción de prueba" } });
    const env = { GROQ_API_KEY: "k", GROQ_BASE_URL: baseUrl };
    const audio = Buffer.from("RIFF....").toString("base64");
    const result = await transcribeAudio(env, { base64: audio, mimeType: "audio/wav", language: "es", timeoutMs: 5_000 });
    expect(result).toEqual({ provider: "groq", text: "transcripción de prueba" });
    expect(lastRequest?.url).toBe("/v1/audio/transcriptions");
    expect(lastRequest?.contentType?.startsWith("multipart/form-data")).toBe(true);
    expect(lastRequest?.body).toContain("es");
  });
});
