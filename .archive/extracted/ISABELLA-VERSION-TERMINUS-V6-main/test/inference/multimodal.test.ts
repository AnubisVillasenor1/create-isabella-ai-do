import { describe, expect, it } from "vitest";
import {
  buildGeminiImageBody,
  buildGeminiVisionBody,
  buildImageCandidates,
  buildOpenAIImageBody,
  buildOpenAIVisionBody,
  buildVisionCandidates,
  describeMultimodalReadiness,
  extractGeminiText,
  extractImageFromGemini,
  extractImageFromOpenAI,
  geminiGenerateEndpoint,
  parseImageDataUrl,
  performImage,
  performVision,
} from "../../src/inference/multimodal";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

describe("multimodal candidate policy", () => {
  it("fails closed when no credentials are configured", () => {
    expect(buildVisionCandidates({})).toHaveLength(0);
    expect(buildImageCandidates({})).toHaveLength(0);
  });

  it("treats a local OpenAI-compatible server as the first vision candidate", () => {
    const [candidate] = buildVisionCandidates({ LOCAL_VISION_BASE_URL: "http://127.0.0.1:8080/v1/" });
    expect(candidate).toMatchObject({
      name: "local",
      protocol: "openai",
      endpoint: "http://127.0.0.1:8080/v1/chat/completions",
    });
  });

  it("orders local before an explicitly keyed free router before remote providers", () => {
    const names = buildVisionCandidates({
      LOCAL_VISION_BASE_URL: "http://127.0.0.1:8080/v1",
      OPENROUTER_API_KEY: "or",
      GEMINI_API_KEY: "gk",
      TOGETHER_API_KEY: "tg",
    }).map((candidate) => candidate.name);
    expect(names).toEqual(["local", "openrouter-free", "gemini", "together"]);
  });

  it("never invents a model for an unkeyed provider", () => {
    expect(buildImageCandidates({ GROQ_API_KEY: "g", OLLAMA_API_KEY: "o" })).toHaveLength(0);
  });

  it("uses the images/generations endpoint and free FLUX default for Together", () => {
    const [candidate] = buildImageCandidates({ TOGETHER_API_KEY: "tg" });
    expect(candidate).toMatchObject({
      name: "together",
      endpoint: "https://api.together.xyz/v1/images/generations",
      model: "black-forest-labs/FLUX.1-schnell-Free",
    });
  });

  it("honors explicit model overrides and Hugging Face model lists", () => {
    const gemini = buildVisionCandidates({ GEMINI_API_KEY: "gk", GEMINI_VISION_MODEL: "gemini-custom" })[0];
    expect(gemini?.model).toBe("gemini-custom");
    const [hf] = buildVisionCandidates({ HF_TOKEN: "t", HF_VISION_MODELS: "org/vlm, org/other" });
    expect(hf).toMatchObject({ name: "huggingface", model: "org/vlm" });
  });

  it("reports readiness per capability without touching the network", () => {
    expect(describeMultimodalReadiness({})).toEqual({ vision: [], image: [] });
    expect(describeMultimodalReadiness({ GEMINI_API_KEY: "gk" })).toEqual({
      vision: ["gemini"],
      image: ["gemini"],
    });
  });
});

describe("image data URL parsing", () => {
  it("accepts only raster image data URLs", () => {
    expect(parseImageDataUrl(PNG_DATA_URL)).toMatchObject({ mimeType: "image/png" });
    expect(parseImageDataUrl("data:image/jpeg;base64,AAAA")).toMatchObject({ mimeType: "image/jpeg" });
    expect(parseImageDataUrl("data:image/webp;base64,AAAA")).toMatchObject({ mimeType: "image/webp" });
  });

  it("rejects non-image, remote and malformed inputs", () => {
    expect(parseImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(parseImageDataUrl("data:text/html;base64,PGgxPg==")).toBeNull();
    expect(parseImageDataUrl("https://example.com/a.png")).toBeNull();
    expect(parseImageDataUrl("data:image/png;base64,not base64!")).toBeNull();
    expect(parseImageDataUrl(null)).toBeNull();
  });
});

describe("request/response shaping", () => {
  const image = parseImageDataUrl(PNG_DATA_URL);
  if (!image) throw new Error("fixture image must parse");

  it("builds an OpenAI-compatible vision body with an inline data URL", () => {
    const body = buildOpenAIVisionBody("m", "describe", image) as {
      messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
    };
    const parts = body.messages[0]?.content;
    expect(parts?.[0]).toMatchObject({ type: "text", text: "describe" });
    expect(parts?.[1]?.image_url?.url).toBe(PNG_DATA_URL);
  });

  it("builds a Gemini vision body with inline data", () => {
    const body = buildGeminiVisionBody("describe", image) as {
      contents: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }>;
    };
    expect(body.contents[0]?.parts[1]?.inlineData).toMatchObject({ mimeType: "image/png" });
  });

  it("requests base64 payloads for OpenAI-compatible image synthesis", () => {
    expect(buildOpenAIImageBody("m", "a cat")).toMatchObject({ response_format: "b64_json", n: 1 });
    expect(buildGeminiImageBody("a cat")).toMatchObject({ generationConfig: { responseModalities: ["IMAGE"] } });
  });

  it("builds the Gemini generateContent endpoint with the key", () => {
    const endpoint = geminiGenerateEndpoint({
      name: "gemini",
      kind: "vision",
      protocol: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      key: "secret",
      model: "gemini-2.5-flash",
    });
    expect(endpoint).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=secret",
    );
  });

  it("extracts text and images from provider responses", () => {
    expect(extractGeminiText({ candidates: [{ content: { parts: [{ text: "hi" }, { text: "there" }] } }] })).toBe("hi\nthere");
    expect(extractImageFromGemini({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "zzz" } }] } }] })).toEqual({ mimeType: "image/png", base64: "zzz" });
    expect(extractImageFromOpenAI({ data: [{ b64_json: "abc" }] })).toEqual({ base64: "abc" });
    expect(extractImageFromOpenAI({ data: [{ url: "https://x/y.png" }] })).toEqual({ url: "https://x/y.png" });
    expect(extractImageFromOpenAI({})).toBeNull();
  });

  it("fails closed when there are no candidates", async () => {
    expect(await performVision([], "p", image)).toBeNull();
    expect(await performImage([], "p")).toBeNull();
  });
});
