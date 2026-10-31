-- state: draft | engine-generated
-- Durable backend for native API keys (ISABELLA_API_KEY_STORE=postgres|neon).
--
-- Security contract: only the peppered HMAC-SHA256 (or plain SHA-256) digest of a
-- key is stored. The `isa_live_...` secret is returned once at issuance and never
-- reaches the database, so a read of this table cannot mint or replay a credential.
-- The digest length and the scope allow-list are enforced here as well as in the
-- adapter, so a corrupted row cannot widen the accepted key space.

begin;

create table if not exists public.isabella_api_keys (
  id text primary key,
  prefix text not null check (prefix <> ''),
  tenant_id text not null check (tenant_id <> ''),
  name text not null check (length(name) between 1 and 80),
  scopes text[] not null check (
    cardinality(scopes) > 0
    and scopes <@ array['cognition:read', 'cognition:write', 'memory:write', 'admin:keys']
  ),
  digest bytea not null check (octet_length(digest) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);

-- A duplicate digest would mean the same secret was issued twice for two records;
-- rejecting it keeps verification unambiguous for a shared table.
create unique index if not exists isabella_api_keys_digest_idx
  on public.isabella_api_keys (digest);

create index if not exists isabella_api_keys_tenant_created_idx
  on public.isabella_api_keys (tenant_id, created_at desc);

alter table public.isabella_api_keys enable row level security;

-- No browser/anon path exists for credentials: only the server role that applies
-- this migration may read or write it.
revoke all on table public.isabella_api_keys from public;

comment on table public.isabella_api_keys is
  'API-key registry rows for the durable Postgres backend; hydrate-once reads, row-level writes.';
comment on column public.isabella_api_keys.digest is
  '32-byte peppered digest of the key. The secret itself is never stored.';
comment on column public.isabella_api_keys.last_used_at is
  'Telemetry only: written in batches, never on the verification hot path.';

commit;
