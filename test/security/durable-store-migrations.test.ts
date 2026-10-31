import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const keyMigration = readFileSync(
  resolve(root, 'supabase/migrations/20261030000000_isabella_api_keys.sql'),
  'utf8'
);
const federationMigration = readFileSync(
  resolve(root, 'supabase/migrations/20261030000001_isabella_federation.sql'),
  'utf8'
);
const keyAdapter = readFileSync(
  resolve(root, 'src/security/postgres-api-key-persistence.ts'),
  'utf8'
);
const federationAdapter = readFileSync(
  resolve(root, 'src/federation/postgres-federation-persistence.ts'),
  'utf8'
);

function createTableBody(sql: string, table: string): string {
  const escaped = table.split('.').join('\\.');
  const match = new RegExp(`create table if not exists ${escaped} \\(([\\s\\S]*?)\\n\\);`, 'i').exec(
    sql
  );
  return match ? match[1] : '';
}

const KEY_COLUMNS = [
  'id',
  'prefix',
  'tenant_id',
  'name',
  'scopes',
  'digest',
  'created_at',
  'expires_at',
  'revoked_at',
  'last_used_at',
];
const CONNECTOR_COLUMNS = ['id', 'name', 'kind', 'target_url', 'created_at', 'status'];
const INBOX_COLUMNS = [
  'id',
  'connector_id',
  'received_at',
  'kind',
  'from_address',
  'text',
  'remote_message_id',
];

describe('durable store migrations', () => {
  it('keeps the API-key table credential-free: a fixed-size digest and nothing else', () => {
    const body = createTableBody(keyMigration, 'public.isabella_api_keys');
    expect(body).toContain('digest bytea not null check (octet_length(digest) = 32)');
    expect(body).not.toMatch(/secret/i);
    expect(body).not.toMatch(/(raw_key|plaintext|pepper)/i);
    for (const column of KEY_COLUMNS) {
      expect(new RegExp(`^\\s{2}${column} `, 'm').test(body)).toBe(true);
    }
    expect(keyMigration).toContain(
      'create unique index if not exists isabella_api_keys_digest_idx'
    );
  });

  it('validates scopes in the schema so a corrupted row cannot widen authority', () => {
    const body = createTableBody(keyMigration, 'public.isabella_api_keys');
    expect(body).toContain("array['cognition:read', 'cognition:write', 'memory:write', 'admin:keys']");
    expect(body).toContain('cardinality(scopes) > 0');
  });

  it('declares the columns the adapters actually read and write', () => {
    const keyBody = createTableBody(keyMigration, 'public.isabella_api_keys');
    const connectorBody = createTableBody(federationMigration, 'public.federation_connectors');
    const inboxBody = createTableBody(federationMigration, 'public.federation_inbox');
    for (const column of [...KEY_COLUMNS, 'public.isabella_api_keys']) expect(keyAdapter).toContain(column);
    for (const column of CONNECTOR_COLUMNS) {
      expect(new RegExp(`^\\s{2}${column} `, 'm').test(connectorBody)).toBe(true);
      expect(federationAdapter).toContain(column);
    }
    for (const column of INBOX_COLUMNS) {
      expect(new RegExp(`^\\s{2}${column} `, 'm').test(inboxBody)).toBe(true);
      expect(federationAdapter).toContain(column);
    }
  });

  it('protects cross-instance replay and bounds the inbox in the schema', () => {
    expect(federationMigration).toMatch(
      /create unique index if not exists federation_inbox_remote_message_key[\s\S]*\(connector_id, remote_message_id\)[\s\S]*where remote_message_id is not null/i
    );
    expect(federationMigration).toContain('on delete cascade');
    const inboxBody = createTableBody(federationMigration, 'public.federation_inbox');
    expect(inboxBody).toContain('check (length(text) <= 4000)');
    expect(inboxBody).not.toMatch(/secret/i);
    expect(inboxBody).not.toMatch(/digest/i);
  });

  it('denies direct role access and follows the timestamped supabase convention', () => {
    for (const sql of [keyMigration, federationMigration]) {
      expect(/enable row level security/i.test(sql)).toBe(true);
      expect(/revoke all on table[\s\S]*from public/i.test(sql)).toBe(true);
      expect(/^begin;$/im.test(sql)).toBe(true);
      expect(/^commit;$/im.test(sql)).toBe(true);
    }
  });

  it('keeps the adapters free of ambient environment reads', () => {
    expect(keyAdapter).not.toContain('process.env');
    expect(federationAdapter).not.toContain('process.env');
  });
});
