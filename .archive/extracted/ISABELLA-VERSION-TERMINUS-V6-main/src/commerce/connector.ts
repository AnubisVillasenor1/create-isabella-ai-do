/** COMMERCE — ingesta de eventos de connectors con ACK tipado (ISA-200/D..217/D). */

import {
  AckOutcome,
  ack,
  idempotencyKey,
  normalizeWebhookEvent,
  redactSecret,
  resolveTenant,
  verifyProviderSignature,
  type AckDecision,
  type IdempotencyRegistry,
  type ProviderConfig,
  type TenantMapping,
  type WebhookWindowOptions,
} from "./webhook";

/** Entrada mínima del evento tal y como llega por el conector. */
export interface ConnectorEventInput {
  provider: string;
  externalEventId: string;
  eventType: string;
  rawBody: string;
  signature: string | undefined;
}

/** Registro de auditoría durable opcional (ISA-216). */
export interface ConnectorPersistRecord {
  provider: string;
  externalEventId: string;
  eventType: string;
  payloadHash: string;
  tenantId: string;
  signatureValid: boolean;
  actor: string;
  receivedAt: string;
}

export type PersistOutcome = boolean | void | Promise<boolean | void>;

export interface ConnectorConfig {
  providers: readonly ProviderConfig[];
  registry: IdempotencyRegistry;
  mappings?: readonly TenantMapping[];
  actor?: string;
  toleranceSeconds?: number;
  now?: () => number;
  /** Sink de log; recibe cadenas ya redactadas (ISA-217). */
  log?: (line: string) => void;
  /** Persistencia durable: se invoca ANTES del ACK (ISA-200/210). */
  persist?: (record: ConnectorPersistRecord) => PersistOutcome;
}

export interface ConnectorAck extends AckDecision {
  tenantId?: string;
  dedupeKey?: string;
  eventId?: string;
}

interface PersistenceVerdict {
  ok: boolean;
  reason?: string;
}

async function persistRecord(config: ConnectorConfig, record: ConnectorPersistRecord): Promise<PersistenceVerdict> {
  if (!config.persist) return { ok: true };
  try {
    const result = await config.persist(record);
    if (result === false) return { ok: false, reason: "PERSISTENCE_REJECTED" };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? redactSecret(error.message) : "PERSISTENCE_FAILED" };
  }
}

/**
 * Orquesta: verify(proveedor, con ventana de replay) → dedupe (registry +
 * persistencia durable) → tenant-mapping → ACK tipado. Ninguna línea de log
 * incluye secretos en claro.
 */
export async function handleConnectorEvent(
  input: ConnectorEventInput,
  config: ConnectorConfig,
): Promise<ConnectorAck> {
  const options: WebhookWindowOptions = { toleranceSeconds: config.toleranceSeconds, now: config.now };
  const actor = config.actor ?? "connector:webhook";
  const log = (line: string): void => {
    config.log?.(redactSecret(line));
  };

  const verification = verifyProviderSignature(input.provider, input.rawBody, input.signature, config.providers, options);
  if (!verification.valid) {
    log(`connector verify failed provider=${input.provider} reason=${verification.reason}`);
    const outcome = verification.reason === "OUT_OF_WINDOW" ? AckOutcome.REJECTED_REPLAY : AckOutcome.REJECTED_SIGNATURE;
    return { ...ack({ outcome }), dedupeKey: undefined };
  }

  let event;
  try {
    event = normalizeWebhookEvent({
      provider: input.provider,
      externalEventId: input.externalEventId,
      eventType: input.eventType,
    });
  } catch (error) {
    log(`connector malformed provider=${input.provider} error=${error instanceof Error ? error.message : "unknown"}`);
    return { ...ack({ outcome: AckOutcome.REJECTED_MALFORMED }), dedupeKey: undefined };
  }

  const dedupeKey = idempotencyKey(event.provider, event.externalEventId);
  if (config.registry.isDuplicate(dedupeKey)) {
    return { ...ack({ outcome: AckOutcome.DUPLICATE }), dedupeKey };
  }

  const tenantId = resolveTenant(event.provider, event.externalEventId, config.mappings ?? [], { allowFallback: false });
  if (!tenantId) {
    log(`connector tenant unresolved provider=${input.provider}`);
    return { ...ack({ outcome: AckOutcome.REJECTED_TENANT }), dedupeKey };
  }

  const record: ConnectorPersistRecord = {
    provider: event.provider,
    externalEventId: event.externalEventId,
    eventType: event.eventType,
    payloadHash: event.payloadHash,
    tenantId,
    signatureValid: true,
    actor,
    receivedAt: event.receivedAt,
  };

  const persisted = await persistRecord(config, record);
  if (!persisted.ok) {
    log(`connector persistence pending provider=${input.provider} reason=${persisted.reason ?? "unknown"}`);
    return {
      ...ack({ outcome: AckOutcome.RETRY, reason: "Event not durably persisted; retry later." }),
      tenantId,
      dedupeKey,
    };
  }

  config.registry.consume(dedupeKey);
  return { ...ack({ outcome: AckOutcome.ACCEPTED }), tenantId, dedupeKey, eventId: event.externalEventId };
}