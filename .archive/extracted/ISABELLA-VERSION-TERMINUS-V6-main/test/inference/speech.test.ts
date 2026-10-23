import { describe, expect, it, vi } from "vitest";
import { describeSpeechReadiness, synthesizeSpeech, transcribeAudio } from "../../src/inference/speech";

describe("speech readiness", () => {
  it("reports nothing configured when no credential is present", () => {
    const readiness = describeSpeechReadiness({});
    expect(readiness).toEqual({ textToSpeech: false, speechToText: false, providers: [] });
  });

  it("enables both directions when a Groq credential is present", () => {
    const readiness = describeSpeechReadiness({ GROQ_API_KEY: "k" });
    expect(readiness).toEqual({ textToSpeech: false, speechToText: true, providers: ["groq"] });
    expect(describeSpeechReadiness({ GROQ_API_KEY: "k", GROQ_TTS_MODEL: "configured-multilingual-model" }).textToSpeech).toBe(true);
  });

  it("treats a blank credential as absent", () => {
    expect(describeSpeechReadiness({ GROQ_API_KEY: "   " }).providers).toEqual([]);
  });
});

describe("speech fails closed without a provider", () => {
  it("never synthesizes without a key", async () => {
    expect(await synthesizeSpeech({}, { text: "hola" })).toBeNull();
  });

  it("rejects empty synthesis text even with a key", async () => {
    expect(await synthesizeSpeech({ GROQ_API_KEY: "k" }, { text: "   " })).toBeNull();
  });

  it("never transcribes without a key", async () => {
    expect(await transcribeAudio({}, { base64: "AAAA", mimeType: "audio/wav" })).toBeNull();
  });

  it("rejects disallowed audio mime types and malformed base64", async () => {
    const env = { GROQ_API_KEY: "k" };
    expect(await transcribeAudio(env, { base64: "AAAA", mimeType: "text/plain" })).toBeNull();
    expect(await transcribeAudio(env, { base64: "not base64!", mimeType: "audio/wav" })).toBeNull();
    expect(await transcribeAudio(env, { base64: "", mimeType: "audio/wav" })).toBeNull();
  });
});

describe("speech transcription upload", () => {
  it("sends a filename with a recognized audio extension (Groq rejects extensionless uploads)", async () => {
    const env = { GROQ_API_KEY: "k" };
    const base64 = Buffer.from("RIFF....WAVEfmt ").toString("base64");
    const names: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const file = (init.body as FormData).get("file");
      if (file instanceof File) names.push(file.name);
      return new Response(JSON.stringify({ text: "hola" }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    try {
      const wav = await transcribeAudio(env, { base64, mimeType: "audio/wav" });
      expect(wav).toEqual({ provider: "groq", text: "hola" });
      await transcribeAudio(env, { base64, mimeType: "audio/mpeg" });
      await transcribeAudio(env, { base64, mimeType: "audio/webm" });
      expect(names).toEqual(["audio.wav", "audio.mp3", "audio.webm"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
