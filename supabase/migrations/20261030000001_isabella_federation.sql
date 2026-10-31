-- state: draft | engine-generated
-- Durable backend for the federation registry and signed-webhook inbox
-- (ISABELLA_FEDERATION_STORE=postgres|neon).
--
-- Reads happen once through hydrate(); the registry keeps answering
-- listConnectors()/getConnector()/hasRemoteMessage() synchronously.
-- The unique index on (connector_id, remote_message_id) makes replay detection
-- hold across serverless instances, not only inside one process.

begin;

create table if not exists public.federation_connectors (
  id text primary key,
  name text not null check (length(name) between 1 and 80),
  kind text not null check (kind in ('whatsapp', 'openwa', 'evolution', 'webhook')),
  target_url text,
  created_at timestamptz not null default now(),
  status text not null default 'registered' check (status = 'registered')
);

create table if not exists public.federation_inbox (
  id text primary key,
  connector_id text not null references public.federation_connectors (id) on delete cascade,
  received_at timestamptz not null default now(),
  kind text not null check (kind in ('whatsapp', 'openwa', 'evolution', 'webhook')),
  from_address text not null check (length(from_address) <= 320),
  text text not null check (length(text) <= 4000),
  remote_message_id text
);

create index if not exists federation_inbox_received_idx
  on public.federation_inbox (received_at desc);

create unique index if not exists federation_inbox_remote_message_key
  on public.federation_inbox (connector_id, remote_message_id)
  where remote_message_id is not null;

alter table public.federation_connectors enable row level security;
alter table public.federation_inbox enable row level security;

revoke all on table public.federation_connectors from public;
revoke all on table public.federation_inbox from public;

comment on table public.federation_connectors is
  'Native connector registry; hydrate-once reads and row-level inserts/deletes.';
comment on table public.federation_inbox is
  'Bounded signed-webhook evidence. Inbound text is display data only: it never grants authority or executes a tool.';
comment on index public.federation_inbox_remote_message_key is
  'Cross-instance replay protection: a duplicate (connector_id, remote_message_id) is rejected with SQLSTATE 23505.';

commit;
