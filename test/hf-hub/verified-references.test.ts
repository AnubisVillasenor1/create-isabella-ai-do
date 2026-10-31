import { describe, expect, it } from "vitest";
import {
  HF_VERIFIED_REFERENCES,
  hfReferencesForDomain,
} from "../../src/hf-hub/catalog";

describe("Hugging Face verified references", () => {
  it("carries a verification date and license for every reference", () => {
    expect(HF_VERIFIED_REFERENCES.length).toBeGreaterThanOrEqual(4);
    for (const reference of HF_VERIFIED_REFERENCES) {
      expect(reference.repoId).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(reference.license.length).toBeGreaterThan(0);
      expect(reference.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("never claims a reference is executable, only discoverable", () => {
    for (const reference of HF_VERIFIED_REFERENCES) {
      expect(reference).not.toHaveProperty("executable");
      expect(reference).not.toHaveProperty("downloaded");
    }
  });

  it("filters by native domain", () => {
    expect(hfReferencesForDomain("moe").length).toBeGreaterThan(0);
    expect(hfReferencesForDomain("tts").every((r) => r.domain === "tts")).toBe(true);
    expect(hfReferencesForDomain("asr").every((r) => r.domain === "asr")).toBe(true);
  });

  it("is frozen so consumers cannot mutate the catalog", () => {
    expect(Object.isFrozen(HF_VERIFIED_REFERENCES)).toBe(true);
    expect(Object.isFrozen(HF_VERIFIED_REFERENCES[0])).toBe(true);
  });
});
