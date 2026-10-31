import { describe, expect, it } from "vitest";
import {
  MAX_DEMAND_MULTIPLIER_BPS,
  MAX_LOYALTY_DISCOUNT_BPS,
  MAX_QUOTE_QUANTITY,
  MONETIZATION_STREAMS,
  getMonetizationStream,
  listMonetizationStreams,
  monetizationSummary,
  quoteMonetization,
} from "../../src/economy/monetization-streams";
import { MAX_USER_SHARE_BPS, MIN_USER_SHARE_BPS } from "../../src/commerce/revenue-share";

describe("native monetization streams", () => {
  it("catalogs metered streams bound to real runtime units", () => {
    expect(MONETIZATION_STREAMS.length).toBeGreaterThanOrEqual(8);
    const units = new Set(listMonetizationStreams().map((s) => s.unit));
    expect(units.has("inference_token")).toBe(true);
    expect(units.has("moe_route")).toBe(true);
    expect(units.has("tts_character")).toBe(true);
    expect(units.has("evidence_seal")).toBe(true);
    for (const stream of MONETIZATION_STREAMS) {
      expect(stream.unitPriceMinor).toBeGreaterThan(0);
      expect(stream.creatorShareBps).toBeGreaterThanOrEqual(MIN_USER_SHARE_BPS);
      expect(stream.creatorShareBps).toBeLessThanOrEqual(MAX_USER_SHARE_BPS);
    }
    expect(getMonetizationStream(" M-21-native-llm-tokens ")?.unit).toBe("inference_token");
    expect(getMonetizationStream("missing")).toBeUndefined();
  });

  it("summarizes cadence and regulatory review", () => {
    const summary = monetizationSummary();
    expect(summary.streams).toBe(MONETIZATION_STREAMS.length);
    expect(summary.usageStreams + summary.recurringStreams).toBeLessThanOrEqual(summary.streams);
    expect(summary.regulatoryReviewRequired).toBeGreaterThan(0);
  });

  it("quotes deterministically with an exact 75/25 split and no funds moved", () => {
    const quote = quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: 1_000 });
    expect(quote.grossMinor).toBe(2_000);
    expect(quote.totalMinor).toBe(2_000);
    expect(quote.creatorMinor + quote.platformMinor).toBe(quote.totalMinor);
    expect(quote.creatorMinor).toBe(1_500);
    expect(quote.platformMinor).toBe(500);
    expect(quote.fundsMoved).toBe(false);
    expect(quote.authorizationPerformed).toBe(false);
    expect(quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: 1_000 })).toEqual(quote);
  });

  it("keeps the split exact for every quantity (platform absorbs the remainder)", () => {
    for (let quantity = 1; quantity <= 500; quantity += 7) {
      for (const stream of MONETIZATION_STREAMS) {
        const quote = quoteMonetization({ streamId: stream.id, quantity });
        expect(quote.creatorMinor + quote.platformMinor).toBe(quote.totalMinor);
        expect(quote.platformMinor).toBeGreaterThanOrEqual(0);
        expect(quote.creatorMinor).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("applies bounded loyalty and demand multipliers", () => {
    const discounted = quoteMonetization({
      streamId: "M-23-native-tts-chars",
      quantity: 10_000,
      loyaltyDiscountBps: 2_000,
      demandMultiplierBps: 15_000,
    });
    // 1 * 10000 = 10000 gross; *1.5 = 15000; -20% = 12000
    expect(discounted.grossMinor).toBe(10_000);
    expect(discounted.totalMinor).toBe(12_000);
    expect(discounted.discountMinor).toBe(3_000);
    expect(discounted.creatorMinor + discounted.platformMinor).toBe(12_000);
  });

  it("fails closed on unknown streams and out-of-range inputs", () => {
    expect(() => quoteMonetization({ streamId: "nope", quantity: 1 })).toThrow("MONETIZATION_STREAM_NOT_FOUND");
    expect(() => quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: 0 })).toThrow("MONETIZATION_QUANTITY_INVALID");
    expect(() => quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: 1.5 })).toThrow("MONETIZATION_QUANTITY_INVALID");
    expect(() => quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: MAX_QUOTE_QUANTITY + 1 })).toThrow("MONETIZATION_QUANTITY_TOO_LARGE");
    expect(() => quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: 10, loyaltyDiscountBps: MAX_LOYALTY_DISCOUNT_BPS + 1 })).toThrow("MONETIZATION_DISCOUNT_INVALID");
    expect(() => quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: 10, demandMultiplierBps: MAX_DEMAND_MULTIPLIER_BPS + 1 })).toThrow("MONETIZATION_DEMAND_MULTIPLIER_INVALID");
    expect(() => quoteMonetization({ streamId: "M-21-native-llm-tokens", quantity: 10, demandMultiplierBps: 5_000 })).toThrow("MONETIZATION_DEMAND_MULTIPLIER_INVALID");
  });
});
