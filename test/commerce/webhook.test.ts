import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  createIdempotencyRegistry,
  idempotencyKey,
  normalizeWebhookEvent,
  processWebhookEvent,
  verifyStripeWebhookSignature,
  verifyWebhookSignature,
} from "../../src/commerce/webhook";

const SECRET = "test-secret-characters-0123456789";

function validSignature(rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

describe("Stripe webhook signature", () => {
  it("verifies timestamped Stripe signatures and rejects stale or altered payloads", () => {
    const rawBody = JSON.stringify({ id: "evt_test_12345678", type: "customer.subscription.updated" });
    const timestamp = 1_800_000_000;
    const digest = createHmac("sha256", SECRET).update(timestamp + "." + rawBody, "utf8").digest("hex");
    const signature = "t=" + timestamp + ",v1=" + digest;
    expect(verifyStripeWebhookSignature(rawBody, signature, SECRET, { now: () => timestamp })).toBe(true);
    expect(verifyStripeWebhookSignature(rawBody + " ", signature, SECRET, { now: () => timestamp })).toBe(false);
    expect(verifyStripeWebhookSignature(rawBody, signature, SECRET, { now: () => timestamp + 301 })).toBe(false);
    expect(verifyStripeWebhookSignature(rawBody, signature, "", { now: () => timestamp })).toBe(false);
  });
});

describe("commerce/webhook", () => {
  it("acepta una firma HMAC-SHA256 válida", () => {
    const raw = '{"id":"evt_1"}';
    expect(verifyWebhookSignature(raw, validSignature(raw), SECRET)).toBe(true);
  });

  it("acepta el prefijo sha256=", () => {
    const raw = '{"id":"evt_1"}';
    expect(verifyWebhookSignature(raw, `sha256=${validSignature(raw)}`, SECRET)).toBe(true);
  });

  it("rechaza firma inválida, secreto distinto o ausencia de firma", () => {
    const raw = '{"id":"evt_1"}';
    expect(verifyWebhookSignature(raw, "00".repeat(32), SECRET)).toBe(false);
    expect(verifyWebhookSignature(raw, validSignature(raw), "other-secret")).toBe(false);
    expect(verifyWebhookSignature(raw, undefined, SECRET)).toBe(false);
    expect(verifyWebhookSignature(raw, "no-hex!", SECRET)).toBe(false);
  });

  it("normaliza eventos validando proveedor, id y tipo", () => {
    const event = normalizeWebhookEvent({ provider: "stripe", externalEventId: "evt_1", eventType: "checkout.completed" });
    expect(event.provider).toBe("stripe");
    expect(event.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => normalizeWebhookEvent({ provider: "stripe", externalEventId: "", eventType: "x" } as never)).toThrow(/EXTERNAL_EVENT_ID/);
    expect(() => normalizeWebhookEvent({ provider: "Stripe!", externalEventId: "e", eventType: "x" })).toThrow(/PROVIDER/);
    expect(() => normalizeWebhookEvent({ provider: "stripe", externalEventId: "e", eventType: "" })).toThrow(/EVENT_TYPE/);
  });

  it("un webhook duplicado no se registra dos veces (idempotencia)", () => {
    const registry = createIdempotencyRegistry();
    const first = processWebhookEvent({ provider: "stripe", externalEventId: "evt_9", eventType: "checkout.completed" }, registry);
    const second = processWebhookEvent({ provider: "stripe", externalEventId: "evt_9", eventType: "checkout.completed" }, registry);
    expect(first.duplicate).toBe(false);
    expect(first.recorded).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.recorded).toBe(false);
  });

  it("la clave de idempotencia une proveedor e id externo", () => {
    expect(idempotencyKey("stripe", "evt_1")).toBe("stripe:evt_1");
  });

  it("events distintos no colisionan en el registro", () => {
    const registry = createIdempotencyRegistry();
    expect(processWebhookEvent({ provider: "stripe", externalEventId: "a", eventType: "x" }, registry).recorded).toBe(true);
    expect(processWebhookEvent({ provider: "paypal", externalEventId: "a", eventType: "x" }, registry).recorded).toBe(true);
  });
});