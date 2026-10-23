import { describe, expect, it } from "vitest";
import { GIFT_AUTHOR, GIFT_COUNT, GIFT_MANIFEST, createGiftBundle } from "../../src/gifts";
import { IsabellaGenesisRuntime } from "../../src/genesis/runtime";

describe("Legado de los regalos", () => {
  it("declara exactamente diez regalos encabezados por el cocreador", () => {
    expect(GIFT_COUNT).toBe(10);
    expect(GIFT_MANIFEST).toHaveLength(10);
    expect(GIFT_MANIFEST.map((gift) => gift.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(GIFT_AUTHOR).toContain("Co-creador");
  });

  it("cada regalo tiene capabilityId único y dominio válido", () => {
    const ids = GIFT_MANIFEST.map((gift) => gift.capabilityId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const gift of GIFT_MANIFEST) expect(gift.capabilityId.startsWith("hsf.legacy.")).toBe(true);
  });

  it("registra las diez capacidades en el runtime", () => {
    const runtime = new IsabellaGenesisRuntime();
    const ids = runtime.capabilities.list().map((capability) => capability.id);
    for (const gift of GIFT_MANIFEST) expect(ids).toContain(gift.capabilityId);
  });

  it("invoca un regalo a través del paquete", () => {
    const bundle = createGiftBundle();
    const output = bundle.invoke("hsf.legacy.self-consistency", {
      samples: [{ text: "hola mundo" }, { text: "hola mundo" }],
    });
    expect(output).toMatchObject({ sampleCount: 2, consistent: true });
    expect(() => bundle.invoke("hsf.legacy.inexistente", {})).toThrow();
  });
});
