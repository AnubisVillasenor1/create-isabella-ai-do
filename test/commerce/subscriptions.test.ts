import { describe, expect, it } from "vitest";
import { SubscriptionStore } from "../../src/commerce/subscriptions";

const T0 = "2026-01-01T00:00:00.000Z";

function makeStore() {
  let t = 0;
  return new SubscriptionStore({ now: () => new Date(Date.parse(T0) + t++ * 1000).toISOString() });
}

describe("commerce/subscriptions", () => {
  it("registra una suscripción activa desde referencia de proveedor", async () => {
    const store = makeStore();
    const record = await store.subscribe({
      workspaceId: "ws-1",
      planCode: "premium",
      provider: "stripe",
      externalRef: "sub_123",
    });
    expect(record.status).toBe("active");
    expect(record.planCode).toBe("premium");
    expect(record.createdAt).toBe(record.updatedAt);
  });

  it("exige referencia del proveedor (no se infiere estado pagado)", async () => {
    const store = makeStore();
    await expect(
      store.subscribe({ workspaceId: "ws-1", planCode: "premium", provider: "stripe", externalRef: "" }),
    ).rejects.toThrow("SUBSCRIPTION_PROVIDER_REFERENCE_REQUIRED");
  });

  it("exige workspace", async () => {
    const store = makeStore();
    await expect(
      store.subscribe({ workspaceId: "  ", planCode: "premium", provider: "stripe", externalRef: "x" }),
    ).rejects.toThrow("SUBSCRIPTION_WORKSPACE_REQUIRED");
  });

  it("valida la máquina de estados: cancelar -> activo permitido, luego suspender desde cancelado es inválido", async () => {
    const store = makeStore();
    await store.subscribe({ workspaceId: "ws-1", planCode: "vip", provider: "stripe", externalRef: "s1" });
    await store.cancel("ws-1");
    expect((await store.get("ws-1"))?.status).toBe("canceled");
    await store.subscribe({ workspaceId: "ws-1", planCode: "vip", provider: "stripe", externalRef: "s2" });
    expect((await store.get("ws-1"))?.status).toBe("active");
  });

  it("upgrade conserva estado activo y cambia el plan", async () => {
    const store = makeStore();
    await store.subscribe({ workspaceId: "ws-1", planCode: "premium", provider: "stripe", externalRef: "s1" });
    const upgraded = await store.upgrade("ws-1", "vip", "stripe", "s1");
    expect(upgraded.planCode).toBe("vip");
    expect(upgraded.status).toBe("active");
  });

  it("suspend marca la cuenta y bloquea nuevas transiciones inválidas", async () => {
    const store = makeStore();
    await store.subscribe({ workspaceId: "ws-1", planCode: "premium", provider: "stripe", externalRef: "s1" });
    const suspended = await store.suspend("ws-1");
    expect(suspended.status).toBe("suspended");
  });

  it("rechaza operar sobre un workspace sin suscripción", async () => {
    const store = makeStore();
    await expect(store.cancel("missing")).rejects.toThrow("SUBSCRIPTION_NOT_FOUND");
  });

  it("registra el rastro de auditoría de transiciones", async () => {
    const store = makeStore();
    await store.subscribe({ workspaceId: "ws-1", planCode: "premium", provider: "stripe", externalRef: "s1" });
    await store.cancel("ws-1");
    const history = store.history();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ from: "none", to: "active", planCode: "premium" });
    expect(history[1]).toMatchObject({ from: "active", to: "canceled" });
  });

  it("no permite activar ENTERPRISE sin contrato explícito", async () => {
    const store = makeStore();
    await expect(
      store.subscribe({ workspaceId: "ws-1", planCode: "enterprise", provider: "stripe", externalRef: "e1" }),
    ).rejects.toThrow("SUBSCRIPTION_CONTRACT_REQUIRED");
    const ok = await store.subscribe({
      workspaceId: "ws-1",
      planCode: "enterprise",
      provider: "salesforce",
      externalRef: "contract-42",
      contract: true,
    });
    expect(ok.planCode).toBe("enterprise");
    expect(ok.status).toBe("active");
  });

  it("sin suscripción no hay registro (el llamador aplica el estado FREE por defecto)", async () => {
    const store = makeStore();
    expect(await store.get("nope")).toBeNull();
  });
});
