/**
 * Native connector registry and signed-webhook inbox.
 *
 * Inspired by the CONCEPTS of OpenWA/Evolution API (signed webhook ingress) and
 * the repository's own security/persistence conventions. Implemented from
 * scratch; no third-party source code is copied.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { envFlag } from '../lib/env-flags';
import { isPostgresStoreMode } from '../database/postgres-store-mode';
import {
  createPostgresFederationPersistence,
  PostgresFederationPersistence,
} from './postgres-federation-persistence';

export const CONNECTOR_KINDS = ['whatsapp', 'openwa', 'evolution', 'webhook'] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export interface ConnectorRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: ConnectorKind;
  readonly targetUrl: string | null;
  readonly createdAt: string;
  readonly status: 'registered';
}

export interface InboxEntry {
  readonly id: string;
  readonly connectorId: string;
  readonly receivedAt: string;
  readonly kind: ConnectorKind;
  readonly from: string;
  readonly text: string;
  readonly remoteMessageId: string | null;
}

export interface FederationFile {
  connectors: ConnectorRecord[];
  inbox: InboxEntry[];
}

/**
 * Readers stay synchronous so the webhook path never blocks on a snapshot.
 * Row-level backends implement the optional async members; snapshot backends
 * keep using load()/save() exactly as before.
 */
export interface FederationPersistence {
  load(): FederationFile;
  save(file: FederationFile): void;
  hydrate?(): Promise<FederationFile>;
  insertConnector?(connector: ConnectorRecord): Promise<void>;
  removeConnectorRow?(id: string): Promise<void>;
  insertInbox?(entry: InboxEntry): Promise<void>;
  close?(): Promise<void>;
}

export class FileFederationPersistence implements FederationPersistence {
  constructor(private readonly filePath: string) {}

  load(): FederationFile {
    if (!fs.existsSync(this.filePath)) return { connectors: [], inbox: [] };
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<FederationFile>;
    const connectors = Array.isArray(parsed.connectors)
      ? parsed.connectors.filter((entry): entry is ConnectorRecord => validConnector(entry))
      : [];
    const inbox = Array.isArray(parsed.inbox)
      ? parsed.inbox.filter((entry): entry is InboxEntry => validInbox(entry))
      : [];
    return { connectors, inbox };
  }

  save(file: FederationFile): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(file, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }
}

export const MAX_INBOX = 200;
const NAME_MAX = 80;

export function validConnector(value: unknown): value is ConnectorRecord {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.kind === 'string' &&
    (CONNECTOR_KINDS as readonly string[]).includes(entry.kind) &&
    (entry.targetUrl === null || typeof entry.targetUrl === 'string') &&
    typeof entry.createdAt === 'string' &&
    entry.status === 'registered'
  );
}

export function validInbox(value: unknown): value is InboxEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.connectorId === 'string' &&
    typeof entry.receivedAt === 'string' &&
    typeof entry.kind === 'string' &&
    typeof entry.from === 'string' &&
    typeof entry.text === 'string' &&
    (entry.remoteMessageId === null || typeof entry.remoteMessageId === 'string')
  );
}

function safeTarget(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (url.protocol === 'http:' && !loopback) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export class FederationRegistry {
  private state: FederationFile;
  private persistence: FederationPersistence | null;
  private hydration: Promise<void> | null = null;
  private degradation: string | null = null;

  constructor(persistence: FederationPersistence | null = null) {
    this.persistence = persistence ?? null;
    this.state = this.persistence?.load() ?? { connectors: [], inbox: [] };
  }

  /** Non-null once a durable backend was abandoned; the registry stays process-local. */
  get degradationReason(): string | null {
    return this.degradation;
  }

  /**
   * Async hydration for row-level backends. Runs at most once and never
   * rejects, so an unreachable database degrades state instead of crashing.
   */
  hydrate(): Promise<void> {
    if (this.hydration) return this.hydration;
    const persistence = this.persistence;
    if (!persistence?.hydrate) {
      this.hydration = Promise.resolve();
      return this.hydration;
    }
    this.hydration = persistence
      .hydrate()
      .then((file) => {
        const knownConnectors = new Set(this.state.connectors.map((item) => item.id));
        const knownInbox = new Set(this.state.inbox.map((item) => item.id));
        const connectors = [
          ...this.state.connectors,
          ...file.connectors.filter((item) => !knownConnectors.has(item.id)),
        ];
        const inbox = [
          ...this.state.inbox,
          ...file.inbox.filter((item) => !knownInbox.has(item.id)),
        ]
          .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
          .slice(0, MAX_INBOX);
        this.state = { connectors, inbox };
      })
      .catch((error: unknown) => {
        this.releaseDurableBackend(error);
      });
    return this.hydration;
  }

  private releaseDurableBackend(error: unknown): void {
    const persistence = this.persistence;
    this.degradation = error instanceof Error ? error.message.slice(0, 180) : 'ERROR';
    this.persistence = null;
    console.warn('[Isabella] Durable federation store unavailable; state stays process-local', {
      message: this.degradation,
    });
    if (persistence?.close) persistence.close().catch(() => undefined);
  }

  private persist(): void {
    this.persistence?.save(this.state);
  }

  listConnectors(): ConnectorRecord[] {
    return [...this.state.connectors];
  }

  getConnector(id: string): ConnectorRecord | null {
    return this.state.connectors.find((connector) => connector.id === id) ?? null;
  }

  async createConnector(input: {
    name: string;
    kind: ConnectorKind;
    targetUrl?: string | null;
  }): Promise<ConnectorRecord> {
    await this.hydrate();
    const name = input.name.trim().slice(0, NAME_MAX);
    if (!name) throw new Error('CONNECTOR_NAME_REQUIRED');
    if (!CONNECTOR_KINDS.includes(input.kind)) throw new Error('CONNECTOR_KIND_INVALID');
    const targetUrl = safeTarget(input.targetUrl);
    if (input.targetUrl && !targetUrl) throw new Error('CONNECTOR_URL_INVALID');
    const connector: ConnectorRecord = {
      id: randomUUID(),
      name,
      kind: input.kind,
      targetUrl,
      createdAt: new Date().toISOString(),
      status: 'registered',
    };
    const previous = this.state;
    this.state = { connectors: [...previous.connectors, connector], inbox: previous.inbox };
    try {
      await this.writeConnector(connector);
    } catch (error) {
      this.state = previous;
      throw error;
    }
    return connector;
  }

  async removeConnector(id: string): Promise<boolean> {
    await this.hydrate();
    const previous = this.state;
    const connectors = previous.connectors.filter((connector) => connector.id !== id);
    if (connectors.length === previous.connectors.length) return false;
    this.state = { connectors, inbox: previous.inbox };
    try {
      if (this.persistence?.removeConnectorRow) {
        await this.persistence.removeConnectorRow(id);
      } else {
        this.persist();
      }
    } catch (error) {
      this.state = previous;
      throw error;
    }
    return true;
  }

  listInbox(limit = 50): InboxEntry[] {
    return this.state.inbox.slice(0, Math.min(MAX_INBOX, Math.max(1, limit)));
  }

  /** True when the same remote message was already stored for this connector. */
  hasRemoteMessage(connectorId: string, remoteMessageId: string): boolean {
    return this.state.inbox.some(
      (entry) => entry.connectorId === connectorId && entry.remoteMessageId === remoteMessageId
    );
  }

  async ingest(connector: ConnectorRecord, payload: unknown): Promise<InboxEntry> {
    await this.hydrate();
    const normalized = normalizeInboundPayload(payload);
    const entry: InboxEntry = {
      id: randomUUID(),
      connectorId: connector.id,
      receivedAt: new Date().toISOString(),
      kind: connector.kind,
      from: normalized.from,
      text: normalized.text.slice(0, 4_000),
      remoteMessageId: normalized.remoteMessageId,
    };
    const previous = this.state;
    this.state = {
      connectors: previous.connectors,
      inbox: [entry, ...previous.inbox].slice(0, MAX_INBOX),
    };
    try {
      await this.writeInbox(entry);
    } catch (error) {
      this.state = previous;
      throw error;
    }
    return entry;
  }

  private async writeConnector(connector: ConnectorRecord): Promise<void> {
    if (this.persistence?.insertConnector) {
      await this.persistence.insertConnector(connector);
      return;
    }
    this.persist();
  }

  private async writeInbox(entry: InboxEntry): Promise<void> {
    if (this.persistence?.insertInbox) {
      await this.persistence.insertInbox(entry);
      return;
    }
    this.persist();
  }
}

function firstString(...values: unknown[]): string {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

/**
 * Normalizes the common WhatsApp/Evolution/OpenWA payload shapes without
 * trusting them: the result is display text only and never becomes a system
 * instruction or an authorization signal.
 */
export function normalizeInboundPayload(payload: unknown): {
  from: string;
  text: string;
  remoteMessageId: string | null;
} {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const entry = Array.isArray(root.entry) ? root.entry[0] : undefined;
  const change =
    entry && typeof entry === 'object' && Array.isArray((entry as Record<string, unknown>).changes)
      ? ((entry as Record<string, unknown>).changes as unknown[])[0]
      : undefined;
  const changeValue =
    change && typeof change === 'object'
      ? ((change as Record<string, unknown>).value as Record<string, unknown> | undefined)
      : undefined;
  const message =
    (Array.isArray(data.messages) ? data.messages[0] : undefined) ??
    (Array.isArray(root.messages) ? root.messages[0] : undefined) ??
    (Array.isArray(changeValue?.messages) ? changeValue?.messages[0] : undefined) ??
    (Array.isArray(root.message) ? root.message[0] : undefined) ??
    (root.key || root.conversation || root.extendedTextMessage ? root : undefined);
  const envelope =
    message && typeof message === 'object' ? (message as Record<string, unknown>) : {};
  // Evolution/OpenWA wrap the real message under `message`; Baileys-style and
  // Cloud API payloads keep the content at the top level.
  const msg =
    envelope.message && typeof envelope.message === 'object'
      ? (envelope.message as Record<string, unknown>)
      : envelope;
  const key =
    (envelope.key && typeof envelope.key === 'object'
      ? (envelope.key as Record<string, unknown>)
      : undefined) ??
    (msg.key && typeof msg.key === 'object' ? (msg.key as Record<string, unknown>) : {});
  const textNode =
    msg.text && typeof msg.text === 'object' ? (msg.text as Record<string, unknown>) : {};
  const extended =
    msg.extendedTextMessage && typeof msg.extendedTextMessage === 'object'
      ? (msg.extendedTextMessage as Record<string, unknown>)
      : {};
  const text = firstString(
    msg.conversation,
    extended.text,
    textNode.body,
    msg.text,
    msg.body,
    envelope.text !== msg.text ? envelope.text : undefined,
    root.text,
    root.body
  );
  return {
    from: firstString(
      key.remoteJid,
      envelope.from,
      msg.from,
      envelope.sender,
      msg.sender,
      root.from,
      changeValue?.metadata && (changeValue.metadata as Record<string, unknown>).phone_number_id
    ),
    text: text || '(mensaje sin texto)',
    remoteMessageId: firstString(key.id, envelope.id, msg.id, root.messageId) || null,
  };
}

export function federationSecret(env: Readonly<Record<string, string | undefined>>): string | null {
  const secret = env.ISABELLA_FEDERATION_SECRET?.trim() ?? '';
  return secret.length >= 32 ? secret : null;
}

export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

export function verifyPayloadSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  if (!/^\d{10,13}$/.test(timestamp)) return false;
  const issuedAt = Number(timestamp) < 1e12 ? Number(timestamp) * 1000 : Number(timestamp);
  if (Math.abs(Date.now() - issuedAt) > 5 * 60_000) return false;
  const expected = Buffer.from(signPayload(secret, timestamp, body), 'hex');
  const received = /^sha256=/i.test(signature) ? signature.slice(7) : signature;
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const candidate = Buffer.from(received, 'hex');
  return candidate.length === expected.length && timingSafeEqual(expected, candidate);
}

/**
 * Postgres is the durable backend for serverless: the registry hydrates once and
 * keeps answering reads synchronously. When Postgres is not reachable the
 * registry degrades to the previous behavior instead of throwing at module scope.
 */
export function createDefaultFederationRegistry(
  env: Readonly<Record<string, string | undefined>> = process.env
): FederationRegistry {
  const mode = (env.ISABELLA_FEDERATION_STORE ?? '').trim().toLowerCase();
  if (isPostgresStoreMode(mode)) {
    let persistence: PostgresFederationPersistence | null = null;
    try {
      persistence = createPostgresFederationPersistence(env);
    } catch (error) {
      console.warn('[Isabella] Postgres federation store could not be initialised', {
        message: error instanceof Error ? error.message.slice(0, 180) : 'ERROR',
      });
    }
    if (persistence) {
      const registry = new FederationRegistry(persistence);
      void registry.hydrate();
      return registry;
    }
    console.warn(
      '[Isabella] ISABELLA_FEDERATION_STORE requests Postgres without a usable DATABASE_URL / POSTGRES_URL; falling back to the previous backend.'
    );
  }
  if (mode === 'memory' || (!mode && envFlag(env, 'VERCEL'))) return new FederationRegistry();
  const filePath = (env.ISABELLA_FEDERATION_STORE_PATH ?? '.data/federation.json').trim();
  try {
    return new FederationRegistry(
      new FileFederationPersistence(path.resolve(process.cwd(), filePath))
    );
  } catch (error) {
    console.warn('[Isabella] Federation persistence unavailable; using memory', {
      message: error instanceof Error ? error.message.slice(0, 180) : 'ERROR',
    });
    return new FederationRegistry();
  }
}
