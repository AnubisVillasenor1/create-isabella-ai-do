import { describe, expect, it } from "vitest";
import { SubscriptionStore } from "../../src/commerce/subscriptions";
import {
  applyProviderSubscriptionEvent,
  defaultResolveIntent,
  type ProviderSubscriptionInput,
} from "../../src/commerce/provider-events";

const base: ProviderSubscriptionInput = {
  workspaceId: "acme",
  provider: "stripe",
  externalRef: "sub_123",
  eventType: "customer.subscription.created",
  planCode: "premium",
};

describe("defaultResolveIntent", () => {
  it("clasifica estados terminales antes que activadores", () => {
    expect(defaultResolveIntent("customer.subscription.deleted")).toBe("cancel");
    expect(defaultResolveIntent("subscription.canceled")).toBe("cancel");
    expect(defaultResolveIntent("account.suspended")).toBe("suspend");
    expect(defaultResolveIntent("invoice.payment_failed")).toBe("past_due");
    expect(defaultResolveIntent("invoice.paid")).toBe("activate");
    expect(defaultResolveIntent("customer.subscription.updated")).toBe("activate");
    expect(defaultResolveIntent("customer.subscription.trial_will_end")).toBe("trial");
    expect(defaultResolveIntent("something.unknown")).toBe("ignore");
    expect(defaultResolveIntent("")).toBe("ignore");
  });
});

describe("applyProviderSubscriptionEvent", () => {
  it("crea una suscripción activa desde un evento de alta", async () => {
    const store = new SubscriptionStore();
    const result = await applyProviderSubscriptionEvent(store, base);
    expect(result.outcome).toBe("APPLIED");
    expect(result.intent).toBe("activate");
    expect(result.record?.status).toBe("active");
    expect(result.record?.planCode).toBe("premium");
    expect(result.record?.externalRef).toBe("sub_123");
    expect((await store.effective("acme")).planCode).toBe("premium");
  });

  it("crea una suscripción en trial", async () => {
    const store = new SubscriptionStore();
    const result = await applyProviderSubscriptionEvent(store, {
      ...base,
      eventType: "customer.subscription.trial_started",
    });
    expect(result.outcome).toBe("APPLIED");
    expect(result.record?.status).toBe("trialing");
  });

  it("pasa a mora con payment_failed sobre una suscripción existente", async () => {
    const store = new SubscriptionStore();
    await applyProviderSubscriptionEvent(store, base);
    const result = await applyProviderSubscriptionEvent(store, {
      ...base,
      eventType: "invoice.payment_failed",
    });
    expect(result.outcome).toBe("APPLIED");
    expect(result.intent).toBe("past_due");
    expect(result.record?.status).toBe("past_due");
  });

  it("cancela y suspende una suscripción existente", async () => {
    const store = new SubscriptionStore();
    await applyProviderSubscriptionEvent(store, base);
    const canceled = await applyProviderSubscriptionEvent(store, {
      ...base,
      eventType: "customer.subscription.deleted",
    });
    expect(canceled.record?.status).toBe("canceled");

    const store2 = new SubscriptionStore();
    await applyProviderSubscriptionEvent(store2, base);
    const suspended = await applyProviderSubscriptionEvent(store2, {
      ...base,
      eventType: "customer.subscription.paused",
    });
    expect(suspended.record?.status).toBe("suspended");
  });

  it("ignora eventos no mapeados sin tocar el store", async () => {
    const store = new SubscriptionStore();
    const result = await applyProviderSubscriptionEvent(store, { ...base, eventType: "ping.hello" });
    expect(result.outcome).toBe("IGNORED_UNMAPPED_EVENT");
    expect(result.record).toBeUndefined();
    expect(await store.get("acme")).toBeNull();
  });

  it("rechaza cancelar una suscripción inexistente", async () => {
    const store = new SubscriptionStore();
    const result = await applyProviderSubscriptionEvent(store, {
      ...base,
      eventType: "customer.subscription.deleted",
    });
    expect(result.outcome).toBe("REJECTED_NO_SUBSCRIPTION");
  });

  it("rechaza activar sin plan resoluble ni suscripción previa", async () => {
    const store = new SubscriptionStore();
    const result = await applyProviderSubscriptionEvent(store, { ...base, planCode: undefined });
    expect(result.outcome).toBe("REJECTED_PLAN_UNRESOLVED");
  });

  it("reutiliza el plan existente si el evento no lo especifica", async () => {
    const store = new SubscriptionStore();
    await applyProviderSubscriptionEvent(store, base);
    const result = await applyProviderSubscriptionEvent(store, {
      ...base,
      planCode: undefined,
      eventType: "invoice.paid",
    });
    expect(result.outcome).toBe("APPLIED");
    expect(result.record?.planCode).toBe("premium");
  });

  it("exige contrato explícito para ENTERPRISE", async () => {
    const store = new SubscriptionStore();
    const rejected = await applyProviderSubscriptionEvent(store, { ...base, planCode: "enterprise" });
    expect(rejected.outcome).toBe("REJECTED_CONTRACT_REQUIRED");

    const applied = await applyProviderSubscriptionEvent(store, {
      ...base,
      planCode: "enterprise",
      contract: true,
    });
    expect(applied.outcome).toBe("APPLIED");
    expect(applied.record?.planCode).toBe("enterprise");
  });

  it("cambia de plan sobre una suscripción existente", async () => {
    const store = new SubscriptionStore();
    await applyProviderSubscriptionEvent(store, base);
    const upgraded = await applyProviderSubscriptionEvent(store, {
      ...base,
      planCode: "vip",
      eventType: "customer.subscription.updated",
    });
    expect(upgraded.outcome).toBe("APPLIED");
    expect(upgraded.record?.planCode).toBe("vip");
  });

  it("acepta un clasificador inyectado", async () => {
    const store = new SubscriptionStore();
    const result = await applyProviderSubscriptionEvent(
      store,
      { ...base, eventType: "custom.weird.thing" },
      () => "activate",
    );
    expect(result.outcome).toBe("APPLIED");
    expect(result.record?.status).toBe("active");
  });
});
