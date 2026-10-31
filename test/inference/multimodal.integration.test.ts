import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildImageCandidates,
  buildVisionCandidates,
  parseImageDataUrl,
  performImage,
  performVision,
} from "../../src/inference/multimodal";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

interface Captured {
  url: string;
  auth: string | undefined;
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
      lastRequest = { url: req.url ?? "", auth: req.headers.authorization, body: Buffer.concat(chunks).toString("utf8") };
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
  handler = () => ({ status: 500, json: {} });
});

describe("performVision over a real HTTP loopback", () => {
  it("understands an image through a local OpenAI-compatible server", async () => {
    handler = () => ({ status: 200, json: { choices: [{ message: { content: "un gato sobre una mesa" } }] } });
    const image = parseImageDataUrl(PNG_DATA_URL);
    if (!image) throw new Error("fixture image must parse");
    const result = await performVision(
      buildVisionCandidates({ LOCAL_VISION_BASE_URL: baseUrl, LOCAL_VISION_MODEL: "qwen2.5-vl" }),
      "describe la imagen",
      image,
    );
    expect(result).toEqual({ text: "un gato sobre una mesa", provider: "local" });
    expect(lastRequest?.url).toBe("/v1/chat/completions");
    expect(lastRequest?.auth).toBe("Bearer local");
    expect(lastRequest?.body).toContain(PNG_DATA_URL);
  });

  it("fails over from a failing candidate to the next configured one", async () => {
    handler = (request) =>
      request.auth === "Bearer local"
        ? { status: 500, json: { error: "boom" } }
        : { status: 200, json: { choices: [{ message: { content: "respuesta del router" } }] } };
    const image = parseImageDataUrl(PNG_DATA_URL);
    if (!image) throw new Error("fixture image must parse");
    const env = { LOCAL_VISION_BASE_URL: baseUrl, OPENROUTER_API_KEY: "or", OPENROUTER_BASE_URL: baseUrl };
    const result = await performVision(buildVisionCandidates(env), "describe", image, 5_000);
    expect(result).toEqual({ text: "respuesta del router", provider: "openrouter-free" });
  });

  it("returns null without a provider or when every candidate fails", async () => {
    const image = parseImageDataUrl(PNG_DATA_URL);
    if (!image) throw new Error("fixture image must parse");
    expect(await performVision([], "describe", image)).toBeNull();
    handler = () => ({ status: 503, json: { error: "down" } });
    const env = { LOCAL_VISION_BASE_URL: baseUrl, LOCAL_VISION_MODEL: "vl" };
    expect(await performVision(buildVisionCandidates(env), "describe", image, 5_000)).toBeNull();
  });

  it("routes Gemini vision to generateContent and parses inline text", async () => {
    handler = () => ({ status: 200, json: { candidates: [{ content: { parts: [{ text: "una casa" }] } }] } });
    const image = parseImageDataUrl(PNG_DATA_URL);
    if (!image) throw new Error("fixture image must parse");
    const env = { GEMINI_API_KEY: "gkey", GEMINI_API_BASE: baseUrl, GEMINI_VISION_MODEL: "gemini-x" };
    const result = await performVision(buildVisionCandidates(env), "describe", image, 5_000);
    expect(result).toEqual({ text: "una casa", provider: "gemini" });
    expect(lastRequest?.url).toBe("/v1/models/gemini-x:generateContent?key=gkey");
  });
});

describe("image synthesis over the network", () => {
  it("synthesizes an image via a local OpenAI-compatible server", async () => {
    handler = () => ({ status: 200, json: { data: [{ b64_json: "QUJD" }] } });
    const env = { LOCAL_IMAGE_BASE_URL: baseUrl, LOCAL_IMAGE_MODEL: "sd" };
    const result = await performImage(buildImageCandidates(env), "un gato", 5_000);
    expect(result).toMatchObject({ provider: "local", mimeType: "image/png", base64: "QUJD" });
    expect(result?.dataUrl).toBe("data:image/png;base64,QUJD");
    expect(lastRequest?.url).toBe("/v1/images/generations");
  });

  it("parses a Gemini inline image", async () => {
    handler = () => ({
      status: 200,
      json: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "R0lG" } }] } }] },
    });
    const env = { GEMINI_API_KEY: "gkey", GEMINI_API_BASE: baseUrl };
    const result = await performImage(buildImageCandidates(env), "un perro", 5_000);
    expect(result).toMatchObject({ provider: "gemini", mimeType: "image/png", base64: "R0lG" });
  });
});
