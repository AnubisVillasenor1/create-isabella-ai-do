import { describe, expect, it } from "vitest";
import { buildGenesisChunk, canonicalGenesisJson, verifyGenesisChunk, type GenesisChunkDraft } from "../../src/cognition/genesis-chunk";
import { routeGenesisExperts, IGE_EXPERT_COUNT, IGE_HEAD_COUNT } from "../../src/cognition/genesis-moe";

function draft(text = "Isabella: acción, ñ, e\u0301, 🧠"): GenesisChunkDraft {
  const routing = routeGenesisExperts({
    requestId: "req-1",
    headScores: Array.from({ length: IGE_HEAD_COUNT }, (_, i) => i),
    expertScores: Array.from({ length: IGE_EXPERT_COUNT }, (_, i) => i),
  });
  return {
    schemaVersion: "ige-chunk/v1",
    requestId: "req-1",
    sessionId: "session-1",
    sequence: 0,
    timestamp: "2026-10-10T12:00:00.000Z",
    latencyMs: 12.5,
    text,
    routing,
    ethicsTrace: { guardiansInvoked: ["privacy", "safety"], flags: [], arbitrationResult: "ALLOW" },
  };
}

describe("Genesis chunk integrity", () => {
  it("builds a verifiable SHA-256 integrity digest", () => {
    const chunk = buildGenesisChunk(draft());
    expect(chunk.chunkHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyGenesisChunk(chunk)).toBe(true);
  });
  it("detects mutation after digest creation", () => {
    const chunk = buildGenesisChunk(draft());
    expect(verifyGenesisChunk({ ...chunk, text: "altered" })).toBe(false);
  });
  it("rejects malformed Unicode and missing chain linkage", () => {
    expect(() => buildGenesisChunk(draft("bad \ud800"))).toThrow(/surrogate/);
    expect(() => buildGenesisChunk({ ...draft(), sequence: 1 })).toThrow(/previous SHA-256/);
  });
  it("requires a previous digest for chained chunks", () => {
    const first = buildGenesisChunk(draft());
    const secondDraft = { ...draft("second"), sequence: 1, previousChunkHash: first.chunkHash };
    const second = buildGenesisChunk(secondDraft);
    expect(verifyGenesisChunk(second)).toBe(true);
  });
  it("canonicalizes object keys without changing array order", () => {
    expect(canonicalGenesisJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalGenesisJson([2, 1])).toBe("[2,1]");
    expect(() => canonicalGenesisJson({ x: Number.NaN })).toThrow(/non-finite/);
  });

  it("rejects accessors and hidden object properties without invoking getters", () => {
    let getterInvoked = false;
    const accessor = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return "not canonical";
      },
    });
    expect(() => canonicalGenesisJson(accessor)).toThrow(/accessors/);
    expect(getterInvoked).toBe(false);

    const hidden = Object.defineProperty({ visible: 1 }, "hidden", {
      enumerable: false,
      value: 2,
    });
    expect(() => canonicalGenesisJson(hidden)).toThrow(/accessors and non-enumerable/);
  });

  it("rejects sparse arrays and malformed routing metadata", () => {
    const sparse = new Array(2);
    expect(() => canonicalGenesisJson(sparse)).toThrow(/sparse arrays/);
    const chunk = buildGenesisChunk(draft());
    const badRouting = { ...chunk, routing: { ...chunk.routing, weights: [1] } };
    expect(verifyGenesisChunk(badRouting as typeof chunk)).toBe(false);
  });
});
