import { describe, expect, it } from "vitest";
import {
  FEDERATION_MANIFEST_DIGEST,
  TAMV_FEDERATION_COUNT,
  TAMV_FEDERATIONS,
  federationById,
  federationByYun,
  isFederationId,
  listFederations,
} from "../../src/federation/registry";
import { YUN_FEDERATIONS } from "../../src/authority/method-id";

describe("TAMV federation registry", () => {
  it("declares exactly seven federations with stable ids 1..7", () => {
    expect(TAMV_FEDERATIONS).toHaveLength(TAMV_FEDERATION_COUNT);
    expect(TAMV_FEDERATIONS.map((f) => f.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("covers every YUN code exactly once", () => {
    expect(new Set(TAMV_FEDERATIONS.map((f) => f.yun))).toEqual(new Set(YUN_FEDERATIONS));
  });

  it("resolves by id and by yun code, failing closed on unknown input", () => {
    expect(federationById(1).yun).toBe("IDENTITY");
    expect(federationByYun("RESILIENCE").id).toBe(7);
    expect(isFederationId(7)).toBe(true);
    expect(isFederationId(8)).toBe(false);
    expect(() => federationById(0)).toThrow(/FEDERATION_UNKNOWN_ID/);
  });

  it("exposes a stable manifest digest", () => {
    expect(FEDERATION_MANIFEST_DIGEST).toMatch(/^[0-9a-f]{64}$/);
    expect(listFederations()).toBe(TAMV_FEDERATIONS);
  });
});
