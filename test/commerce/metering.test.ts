import { describe, expect, it } from "vitest";
import { UsageMeter } from "../../src/commerce/metering";

const DAY1 = new Date("2026-02-01T10:00:00.000Z");
const DAY2 = new Date("2026-02-02T10:00:00.000Z");

describe("commerce/metering", () => {
  it("cuenta incrementos por workspace y cuota", () => {
    const meter = new UsageMeter({ now: () => DAY1 });
    expect(meter.increment("ws-1", "active_offers")).toBe(1);
    expect(meter.increment("ws-1", "active_offers")).toBe(2);
    expect(meter.increment("ws-2", "active_offers")).toBe(1);
    expect(meter.getUsage("ws-1", "active_offers")).toBe(2);
    expect(meter.getUsage("ws-2", "active_offers")).toBe(1);
  });

  it("separa el conteo por día", () => {
    const meter = new UsageMeter({ now: () => DAY1 });
    meter.increment("ws-1", "attribution_events_per_day", 5, DAY1);
    meter.increment("ws-1", "attribution_events_per_day", 3, DAY2);
    expect(meter.getUsage("ws-1", "attribution_events_per_day", DAY1)).toBe(5);
    expect(meter.getUsage("ws-1", "attribution_events_per_day", DAY2)).toBe(3);
  });

  it("rechaza incrementos no positivos", () => {
    const meter = new UsageMeter();
    expect(() => meter.increment("ws-1", "active_offers", 0)).toThrow("METER_AMOUNT_INVALID");
  });

  it("snapshot solo devuelve las cuotas del workspace del día", () => {
    const meter = new UsageMeter({ now: () => DAY1 });
    meter.increment("ws-1", "active_offers", 2, DAY1);
    meter.increment("ws-1", "active_campaigns", 1, DAY1);
    meter.increment("ws-2", "active_offers", 9, DAY1);
    meter.increment("ws-1", "active_offers", 7, DAY2);
    expect(meter.snapshot("ws-1", DAY1)).toEqual({ active_offers: 2, active_campaigns: 1 });
  });

  it("reset limpia el día del workspace indicado", () => {
    const meter = new UsageMeter({ now: () => DAY1 });
    meter.increment("ws-1", "active_offers", 2, DAY1);
    meter.reset("ws-1", DAY1);
    expect(meter.getUsage("ws-1", "active_offers", DAY1)).toBe(0);
  });

  it("acota la memoria desalojando la entrada más antigua", () => {
    const meter = new UsageMeter({ maxKeys: 2, now: () => DAY1 });
    meter.increment("a", "leads_per_month", 1, DAY1);
    meter.increment("b", "leads_per_month", 1, DAY1);
    meter.increment("c", "leads_per_month", 1, DAY1);
    expect(meter.getUsage("a", "leads_per_month", DAY1)).toBe(0);
    expect(meter.getUsage("c", "leads_per_month", DAY1)).toBe(1);
  });
});
