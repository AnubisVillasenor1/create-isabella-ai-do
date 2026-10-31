/**
 * Postgres backend for the federation registry and its signed-webhook inbox.
 *
 * Reads happen once through hydrate() so the registry keeps answering
 * listConnectors()/getConnector()/hasRemoteMessage() synchronously. Writes are
 * row-level, and the unique index on (connector_id, remote_message_id) extends
 * replay detection across serverless instances.
 */
import {
  MAX_INBOX,
  validConnector,
  validInbox,
  type ConnectorKind,
  type ConnectorRecord,
  type FederationFile,
  type FederationPersistence,
  type InboxEntry,
} from './connectors';
import {
  createPostgresQueryClient,
  isoTimestamp,
  resolvePostgresUrl,
  type PostgresQueryClient,
} from '../database/postgres-client';

const CONNECTOR_TABLE = 'public.federation_connectors';
const INBOX_TABLE = 'public.federation_inbox';

const SELECT_CONNECTORS_SQL = `SELECT id, name, kind, target_url, created_at, status
  FROM ${CONNECTOR_TABLE} ORDER BY created_at ASC`;

const SELECT_INBOX_SQL = `SELECT id, connector_id, received_at, kind, from_address, text,
  remote_message_id
  FROM ${INBOX_TABLE} ORDER BY received_at DESC LIMIT $1`;

const INSERT_CONNECTOR_SQL = `INSERT INTO ${CONNECTOR_TABLE}
  (id, name, kind, target_url, created_at, status)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (id) DO NOTHING`;

const DELETE_CONNECTOR_SQL = `DELETE FROM ${CONNECTOR_TABLE} WHERE id = $1`;

const INSERT_INBOX_SQL = `INSERT INTO ${INBOX_TABLE}
  (id, connector_id, received_at, kind, from_address, text, remote_message_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7)`;

const TRIM_INBOX_SQL = `DELETE FROM ${INBOX_TABLE}
  WHERE id NOT IN (SELECT id FROM ${INBOX_TABLE} ORDER BY received_at DESC LIMIT $1)`;

function toConnector(row: Record<string, unknown>): ConnectorRecord | null {
  const candidate: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    kind: row.kind,
    targetUrl: row.target_url ?? null,
    createdAt: isoTimestamp(row.created_at),
    status: row.status,
  };
  if (!validConnector(candidate)) return null;
  return {
    id: candidate.id as string,
    name: candidate.name as string,
    kind: candidate.kind as ConnectorKind,
    targetUrl: candidate.targetUrl as string | null,
    createdAt: candidate.createdAt as string,
    status: 'registered',
  };
}

function toInbox(row: Record<string, unknown>): InboxEntry | null {
  const candidate: Record<string, unknown> = {
    id: row.id,
    connectorId: row.connector_id,
    receivedAt: isoTimestamp(row.received_at),
    kind: row.kind,
    from: row.from_address,
    text: row.text,
    remoteMessageId: row.remote_message_id ?? null,
  };
  if (!validInbox(candidate)) return null;
  return {
    id: candidate.id as string,
    connectorId: candidate.connectorId as string,
    receivedAt: candidate.receivedAt as string,
    kind: candidate.kind as ConnectorKind,
    from: candidate.from as string,
    text: candidate.text as string,
    remoteMessageId: candidate.remoteMessageId as string | null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

export interface PostgresFederationPersistenceOptions {
  readonly client: PostgresQueryClient;
}

export class PostgresFederationPersistence implements FederationPersistence {
  private readonly client: PostgresQueryClient;

  constructor(options: PostgresFederationPersistenceOptions) {
    this.client = options.client;
  }

  /** Row-level backend: the synchronous snapshot is empty, hydrate() is the read path. */
  load(): FederationFile {
    return { connectors: [], inbox: [] };
  }

  async hydrate(): Promise<FederationFile> {
    const connectors = await this.client.query(SELECT_CONNECTORS_SQL);
    const inbox = await this.client.query(SELECT_INBOX_SQL, [MAX_INBOX]);
    const validConnectors = connectors.rows
      .map(toConnector)
      .filter((row): row is ConnectorRecord => row !== null);
    const connectorKinds = new Map(
      validConnectors.map((connector) => [connector.id, connector.kind] as const)
    );
    return {
      connectors: validConnectors,
      inbox: inbox.rows
        .map(toInbox)
        .filter(
          (row): row is InboxEntry =>
            row !== null && connectorKinds.get(row.connectorId) === row.kind
        ),
    };
  }

  /** Kept for contract compatibility; the registry writes one row per operation. */
  save(file: FederationFile): void {
    void this.saveRows(file).catch((error: unknown) => {
      console.warn('[Isabella] Federation snapshot write failed', {
        message: error instanceof Error ? error.message.slice(0, 180) : 'ERROR',
      });
    });
  }

  async insertConnector(connector: ConnectorRecord): Promise<void> {
    await this.client.query(INSERT_CONNECTOR_SQL, [
      connector.id,
      connector.name,
      connector.kind,
      connector.targetUrl,
      connector.createdAt,
      connector.status,
    ]);
  }

  async removeConnectorRow(id: string): Promise<void> {
    await this.client.query(DELETE_CONNECTOR_SQL, [id]);
  }

  async insertInbox(entry: InboxEntry): Promise<void> {
    try {
      await this.client.query(INSERT_INBOX_SQL, [
        entry.id,
        entry.connectorId,
        entry.receivedAt,
        entry.kind,
        entry.from,
        entry.text,
        entry.remoteMessageId,
      ]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new Error('FEDERATION_REPLAY_DETECTED');
      throw error;
    }
    await this.client.query(TRIM_INBOX_SQL, [MAX_INBOX]);
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private async saveRows(file: FederationFile): Promise<void> {
    for (const connector of file.connectors) {
      await this.insertConnector(connector);
    }
    for (const entry of file.inbox) {
      await this.client.query(INSERT_INBOX_SQL, [
        entry.id,
        entry.connectorId,
        entry.receivedAt,
        entry.kind,
        entry.from,
        entry.text,
        entry.remoteMessageId,
      ]);
    }
  }
}

/** Returns null when no usable Postgres URL exists; the caller degrades explicitly. */
export function createPostgresFederationPersistence(
  env: Readonly<Record<string, string | undefined>>
): PostgresFederationPersistence | null {
  const url = resolvePostgresUrl(env);
  if (!url) return null;
  return new PostgresFederationPersistence({
    client: createPostgresQueryClient(url, 'isabella-terminus-federation'),
  });
}
