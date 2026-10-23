import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  ack,
  AckOutcome,
  createIdempotencyRegistry,
  deriveFallbackTenant,
  mapTenantFromSignature,
  redactSecret,
  resolveTenant,
  signWebhookWithWindow,
  verifyProviderSignature,
  verifyWebhookWithWindow,
  verifyWebhookWithWindowDetailed,
  type ProviderConfig,
  type TenantMapping,
} from "../../src/commerce/webhook";
import {
  handleConnectorEvent,
  type ConnectorConfig,
  type ConnectorEventInput,
} from "../../src/commerce/connector";

const SECRET = "connector-secret-0123456789-abcdefghijklmnop";
const PROVIDERS: ProviderConfig[] = [
  { provider: "stripe", scheme: "raw-hmac-sha256", secret: SECRET },
  { provider: "github", scheme: "raw-hmac-sha256", secret: SECRET },
  { provider: "slack", scheme: "timestamped-hmac-sha256", secret: SECRET },
];

function rawSignature(rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function slackEvent(overrides: Partial<ConnectorEventInput> = {}): ConnectorEventInput {
  return {
    provider: "slack",
    externalEventId: "evt_slack",
    eventType: "message",
    rawBody: JSON.stringify({ event_id: "evt_slack" }),
    signature: signWebhookWithWindow(JSON.stringify({ event_id: "evt_slack" }), SECRET, 1_700_000_000),
    ...overrides,
  };
}

describe("commerce/webhook — ventana de replay", () => {
  it("acepta una firma timestamped dentro de la ventana de tolerancia", () => {
    const now = 1_700_000_000;
    const raw = '{"ok":true}';
    const signature = signWebhookWithWindow(raw, SECRET, now);
    expect(verifyWebhookWithWindow(raw, signature, SECRET, { now: () => now })).toBe(true);
  });

  it("rechaza un replay fuera de la ventana y reporta OUT_OF_WINDOW", () => {
    const signedAt = 1_700_000_000;
    const raw = '{"ok":true}';
    const signature = signWebhookWithWindow(raw, SECRET, signedAt);
    const late = verifyWebhookWithWindowDetailed(raw, signature, SECRET, {
      now: () => signedAt + 301,
      toleranceSeconds: 300,
    });
    expect(late).toEqual({ valid: false, reason: "OUT_OF_WINDOW" });
    expect(verifyWebhookWithWindow(raw, signature, SECRET, { now: () => signedAt + 100 })).toBe(true);
  });

  it("rechaza firma manipulada, secreto distinto o formato malformado", () => {
    const now = 1_700_000_000;
    const signature = signWebhookWithWindow('{"a":1}', SECRET, now);
    expect(verifyWebhookWithWindowDetailed('{"a":2}', signature, SECRET, { now: () => now }).reason).toBe("BAD_SIGNATURE");
    expect(verifyWebhookWithWindow('{"a":1}', signature, "other-secret", { now: () => now })).toBe(false);
    expect(verifyWebhookWithWindow('{"a":1}', "no-equals-here", SECRET, { now: () => now })).toBe(false);
    expect(verifyWebhookWithWindowDetailed('{"a":1}', undefined, SECRET).reason).toBe("MISSING");
  });

  it("soporta el esquema v0 estilo Slack y timestamp futuro (desvío de reloj)", () => {
    const now = 1_700_000_000;
    const raw = '{"ok":true}';
    const v0 = signWebhookWithWindow(raw, SECRET, now - 60, "v0");
    expect(verifyWebhookWithWindow(raw, v0, SECRET, { now: () => now })).toBe(true);
    const future = signWebhookWithWindow(raw, SECRET, now + 6_000, "v0");
    expect(verifyWebhookWithWindowDetailed(raw, future, SECRET, { now: () => now, toleranceSeconds: 300 }).reason).toBe(
      "OUT_OF_WINDOW",
    );
  });
});

describe("commerce/webhook — verificación por proveedor", () => {
  it("liga la firma al proveedor esperado (binding)", () => {
    const raw = '{"x":1}';
    const sig = `sha256=${rawSignature(raw)}`;
    expect(verifyProviderSignature("stripe", raw, sig, PROVIDERS)).toEqual({ valid: true, reason: "OK" });
    expect(verifyProviderSignature("paypal", raw, sig, PROVIDERS).valid).toBe(false);
    expect(verifyProviderSignature("stripe", raw, rawSignature(raw), PROVIDERS).valid).toBe(true);
    expect(verifyProviderSignature("github", raw, rawSignature("altered"), PROVIDERS).reason).toBe("BAD_SIGNATURE");
  });

  it("verifica proveedores timestamped con ventana", () => {
    const now = 1_700_000_000;
    const raw = '{"ok":true}';
    const sig = signWebhookWithWindow(raw, SECRET, now);
    expect(verifyProviderSignature("slack", raw, sig, PROVIDERS, { now: () => now }).valid).toBe(true);
  });
});

describe("commerce/webhook — tenant mapping", () => {
  it("mapea el tenant por tabla llana y por prefijo de evento", () => {
    const mappings: TenantMapping[] = [
      { provider: "stripe", tenantId: "tenant-stripe-main" },
      { provider: "github", tenantId: "tenant-gh-scoped", eventPrefixes: ["evt_scope_"] },
    ];
    expect(resolveTenant("stripe", "evt_1", mappings)).toBe("tenant-stripe-main");
    expect(resolveTenant("github", "evt_scope_42", mappings)).toBe("tenant-gh-scoped");
    expect(resolveTenant("github", "evt_other", mappings)).toBeUndefined();
    expect(resolveTenant("slack", "evt", mappings)).toBeUndefined();
  });

  it("el fallback determinista deriva un tenant desde el proveedor", () => {
    expect(deriveFallbackTenant("slack")).toMatch(/^tenant-[0-9a-f]{16}$/);
    expect(resolveTenant("slack", "evt", [], { allowFallback: true })).toBe(deriveFallbackTenant("slack"));
  });

  it("deriva tenant desde un key-id en la firma", () => {
    const index: Record<string, string> = { keyA: "tenant-a" };
    expect(mapTenantFromSignature("t=1,v1=ab,k=keyA", index)).toBe("tenant-a");
    expect(mapTenantFromSignature("t=1,v1=ab,k=missing", index)).toBeUndefined();
    expect(mapTenantFromSignature(undefined, index)).toBeUndefined();
  });
});

describe("commerce/webhook — redacción de secretos", () => {
  it("enmascara firmas y digests sin exponer el hex completo", () => {
    const digest = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    expect(redactSecret(`sha256=${digest}`)).toBe("sha256=ab•••");
    expect(redactSecret(`t=1700000000,v1=${digest}`)).toBe("t=1700000000,v1=ab•••");
    expect(redactSecret(`v0=${digest}`)).toBe("v0=ab•••");
  });

  it("enmascara bearer tokens y pares clave=secreto", () => {
    const digest = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    const redacted = redactSecret(`Authorization: Bearer ${digest} secret=super-secret-value`);
    expect(redacted).not.toContain(digest);
    expect(redacted).not.toContain("super-secret-value");
    expect(redactSecret("")).toBe("");
  });
});

describe("commerce/webhook — semántica ACK", () => {
  it("mapea outcomes a status/código/retryable tipados", () => {
    expect(ack({ outcome: AckOutcome.ACCEPTED })).toMatchObject({ status: 202, code: "ACCEPTED", retryable: false });
    expect(ack({ outcome: AckOutcome.DUPLICATE })).toMatchObject({ status: 200, code: "DUPLICATE", retryable: false });
    expect(ack({ outcome: AckOutcome.REJECTED_REPLAY })).toMatchObject({ status: 409, code: "REJECTED_REPLAY", retryable: false });
    expect(ack({ outcome: AckOutcome.REJECTED_SIGNATURE })).toMatchObject({ status: 401, retryable: false });
    expect(ack({ outcome: AckOutcome.REJECTED_TENANT })).toMatchObject({ status: 403, retryable: false });
    expect(ack({ outcome: AckOutcome.REJECTED_MALFORMED })).toMatchObject({ status: 400, retryable: false });
    expect(ack({ outcome: AckOutcome.RETRY })).toMatchObject({ status: 503, retryable: true });
  });
});

describe("commerce/connector — orquestación", () => {
  it("ingesta verificada: persiste (ISA-200/210), mapea tenant y ACK 202", async () => {
    const raw = '{"id":"evt_100","type":"checkout.completed"}';
    const signature = rawSignature(raw);
    const persisted: string[] = [];
    const config: ConnectorConfig = {
      providers: PROVIDERS,
      registry: createIdempotencyRegistry(),
      mappings: [{ provider: "stripe", tenantId: "tenant-stripe" }],
      persist: (record) => {
        persisted.push(record.externalEventId);
      },
    };
    const input: ConnectorEventInput = {
      provider: "stripe",
      externalEventId: "evt_100",
      eventType: "checkout.completed",
      rawBody: raw,
      signature,
    };
    const first = await handleConnectorEvent(input, config);
    expect(first.code).toBe(AckOutcome.ACCEPTED);
    expect(first.status).toBe(202);
    expect(first.tenantId).toBe("tenant-stripe");
    expect(first.dedupeKey).toBe("stripe:evt_100");
    expect(persisted).toEqual(["evt_100"]);
  });

  it("dedupe: el segundo evento idéntico responde DUPLICATE sin re-persistir", async () => {
    const raw = '{"id":"evt_100","type":"checkout.completed"}';
    const signature = rawSignature(raw);
    const persisted: string[] = [];
    const config: ConnectorConfig = {
      providers: PROVIDERS,
      registry: createIdempotencyRegistry(),
      mappings: [{ provider: "stripe", tenantId: "tenant-stripe" }],
      persist: (record) => {
        persisted.push(record.externalEventId);
      },
    };
    const input: ConnectorEventInput = {
      provider: "stripe",
      externalEventId: "evt_100",
      eventType: "checkout.completed",
      rawBody: raw,
      signature,
    };
    await handleConnectorEvent(input, config);
    const duplicate = await handleConnectorEvent(input, config);
    expect(duplicate.code).toBe(AckOutcome.DUPLICATE);
    expect(duplicate.status).toBe(200);
    expect(duplicate.retryable).toBe(false);
    expect(persisted).toEqual(["evt_100"]);
  });

  it("rechaza replay fuera de ventana a nivel de orquestación (REJECTED_REPLAY)", async () => {
    const signedAt = 1_700_000_000;
    const raw = '{"event_id":"evt_replay"}';
    const signature = signWebhookWithWindow(raw, SECRET, signedAt);
    const config: ConnectorConfig = {
      providers: PROVIDERS,
      registry: createIdempotencyRegistry(),
      mappings: [{ provider: "slack", tenantId: "tenant-slack" }],
      now: () => signedAt + 10_000,
    };
    const result = await handleConnectorEvent({ ...slackEvent(), signature, rawBody: raw }, config);
    expect(result.code).toBe(AckOutcome.REJECTED_REPLAY);
    expect(result.status).toBe(409);
    expect(result.retryable).toBe(false);
  });

  it("rechaza firma inválida a nivel de orquestación (REJECTED_SIGNATURE)", async () => {
    const raw = '{"event_id":"evt_100"}';
    const config: ConnectorConfig = {
      providers: PROVIDERS,
      registry: createIdempotencyRegistry(),
      mappings: [{ provider: "stripe", tenantId: "tenant-stripe" }],
    };
    const result = await handleConnectorEvent(
      { provider: "stripe", externalEventId: "evt_100", eventType: "checkout.completed", rawBody: raw, signature: "00".repeat(32) },
      config,
    );
    expect(result.code).toBe(AckOutcome.REJECTED_SIGNATURE);
  });

  it("rechaza tenant no mapeado (REJECTED_TENANT)", async () => {
    const raw = '{"id":"evt_x"}';
    const signature = rawSignature(raw);
    const config: ConnectorConfig = {
      providers: PROVIDERS,
      registry: createIdempotencyRegistry(),
      mappings: [],
    };
    const result = await handleConnectorEvent(
      { provider: "stripe", externalEventId: "evt_x", eventType: "x", rawBody: raw, signature },
      config,
    );
    expect(result.code).toBe(AckOutcome.REJECTED_TENANT);
    expect(result.status).toBe(403);
  });

  it("no responde ACCEPTED si la persistencia no es durable (ISA-210), y no consume el dedupe", async () => {
    const raw = '{"id":"evt_p"}';
    const signature = rawSignature(raw);
    const registry = createIdempotencyRegistry();
    const failing: ConnectorConfig = {
      providers: PROVIDERS,
      registry,
      mappings: [{ provider: "stripe", tenantId: "tenant-stripe" }],
      persist: () => false,
    };
    const input: ConnectorEventInput = {
      provider: "stripe",
      externalEventId: "evt_p",
      eventType: "x",
      rawBody: raw,
      signature,
    };
    const pending = await handleConnectorEvent(input, failing);
    expect(pending.code).toBe(AckOutcome.RETRY);
    expect(pending.status).toBe(503);
    expect(pending.retryable).toBe(true);
    expect(registry.isDuplicate("stripe:evt_p")).toBe(false);

    const recovered = await handleConnectorEvent(input, { ...failing, persist: () => true });
    expect(recovered.code).toBe(AckOutcome.ACCEPTED);
  });

  it("el log del sink recibe líneas sin el secreto en claro (ISA-217)", async () => {
    const raw = '{"id":"evt_log"}';
    void rawSignature(raw);
    const lines: string[] = [];
    const config: ConnectorConfig = {
      providers: PROVIDERS,
      registry: createIdempotencyRegistry(),
      mappings: [],
      log: (line) => lines.push(line),
    };
    await handleConnectorEvent(
      { provider: "stripe", externalEventId: "evt_log", eventType: "x", rawBody: raw, signature: "00".repeat(32) },
      config,
    );
    expect(lines.join("\n")).not.toContain(SECRET);
  });
});