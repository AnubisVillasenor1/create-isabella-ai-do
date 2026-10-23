import { describe, expect, it } from "vitest";
import {
  CIVILIZATION_GIFTS,
  CIVILIZATION_GIFT_COUNT,
  civilizationGiftById,
  giftsForLayer,
} from "../../src/civilization/gifts";
import { layerById } from "../../src/civilization/layers";

describe("ISABELLA Ω · CCR-1 — veinte regalos Ω", () => {
  it("registra exactamente 20 regalos con orden 1..20", () => {
    expect(CIVILIZATION_GIFT_COUNT).toBe(20);
    expect(CIVILIZATION_GIFTS.map((g) => g.order)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it("usa códigos de regalo únicos", () => {
    const ids = CIVILIZATION_GIFTS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("mapea cada regalo a capas Ω existentes", () => {
    for (const gift of CIVILIZATION_GIFTS) {
      expect(gift.layerIds.length).toBeGreaterThan(0);
      for (const layerId of gift.layerIds) {
        expect(layerById(layerId), `gift ${gift.id} → ${layerId}`).toBeDefined();
      }
    }
  });

  it("declara estado y realidad honestos para cada regalo", () => {
    for (const gift of CIVILIZATION_GIFTS) {
      expect(gift.reality.trim().length).toBeGreaterThan(0);
      expect(gift.claimed.trim().length).toBeGreaterThan(0);
    }
  });

  it("devuelve regalos por id y por capa", () => {
    expect(civilizationGiftById("EFM-CCI")?.status).toBe("IMPLEMENTED");
    expect(civilizationGiftById("ASE")?.status).toBe("NOT_WIRED");
    const trustGifts = giftsForLayer("Ω-7");
    expect(trustGifts.some((g) => g.id === "EFM-CCI")).toBe(true);
  });
});
