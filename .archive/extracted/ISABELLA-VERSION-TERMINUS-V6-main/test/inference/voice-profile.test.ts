import { describe, expect, it } from "vitest";
import { compareToProfile, measure, parseWav16 } from "../../src/inference/voice-analysis";
import { chunkForSpeech, ISABELLA_VOICE_PROFILE, pickVoice, scoreVoiceCandidate } from "../../src/inference/voice-profile";

function wav(samples: Float32Array, sr: number): Uint8Array {
  const buf = new Uint8Array(44 + samples.length * 2);
  const dv = new DataView(buf.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); dv.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, "data"); dv.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => dv.setInt16(44 + i * 2, Math.round(s * 32000), true));
  return buf;
}

describe("voice profile", () => {
  it("never claims cloning and stays draft", () => {
    expect(ISABELLA_VOICE_PROFILE.cloning).toBe(false);
    expect(ISABELLA_VOICE_PROFILE.state).toBe("draft");
  });

  it("prefers named Latin-American Spanish voices and rejects non-Spanish", () => {
    expect(scoreVoiceCandidate({ name: "Google English", lang: "en-US" })).toBe(-1);
    const best = pickVoice([
      { name: "Generic", lang: "es-ES" },
      { name: "Microsoft Dalia Online", lang: "es-MX" },
      { name: "Alex", lang: "en-US" },
    ]);
    expect(best?.name).toBe("Microsoft Dalia Online");
    expect(pickVoice([{ name: "Alex", lang: "en-US" }])).toBeNull();
  });

  it("chunks speech by sentence and bounds chunk length", () => {
    expect(chunkForSpeech("  ")).toEqual([]);
    expect(chunkForSpeech("Hola. ¿Cómo estás? Bien!")).toEqual(["Hola.", "¿Cómo estás?", "Bien!"]);
    const long = "palabra ".repeat(80).trim();
    for (const c of chunkForSpeech(long, 100)) expect(c.length).toBeLessThanOrEqual(100);
  });

  it("measures F0 and pauses of a synthetic signal", () => {
    const sr = 16000;
    const seg = (sec: number, f: number) => Float32Array.from({ length: Math.round(sr * sec) }, (_, i) => 0.4 * Math.sin((2 * Math.PI * f * i) / sr));
    const gap = new Float32Array(Math.round(sr * 0.7));
    const parts = [seg(1, 205), gap, seg(1, 205), gap, seg(1, 205)];
    const all = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    const m = measure(parseWav16(wav(all, sr)));
    expect(Math.abs(m.f0.median - 205)).toBeLessThan(10);
    expect(m.pauses.count).toBe(2);
    expect(Math.abs(m.pauses.meanMs - 700)).toBeLessThan(60);
    expect(compareToProfile(m, ISABELLA_VOICE_PROFILE).find((r) => r.metric === "f0_median_hz")?.ok).toBe(true);
  });

  it("rejects non-WAV input", () => {
    expect(() => parseWav16(new Uint8Array(64))).toThrow();
  });
});
