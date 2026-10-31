-- AtlasStore core schema for Isabella Genesis V6.
-- Apply through the project's approved Supabase migration process.
-- This file intentionally does not seed production records or credentials.

begin;

create table if not exists public.atlas_users (
  id uuid primary key,
  handle text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_protocols (
  id uuid primary key,
  protocol_id text not null,
  actor_id text not null,
  selected_path jsonb not null default 'null'::jsonb,
  evaluated_paths jsonb not null default '[]'::jsonb,
  collapsed_at timestamptz not null default now()
);

create table if not exists public.atlas_ledger (
  id uuid primary key,
  user_id text not null,
  amount numeric(20, 6) not null check (amount > 0),
  reason text not null check (length(trim(reason)) > 0),
  kind text not null check (kind in ('credit', 'debit')),
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_xr_events (
  id uuid primary key,
  event_type text not null check (length(trim(event_type)) > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_webrtc_signals (
  id uuid primary key,
  room_id text not null check (length(trim(room_id)) > 0),
  sender_id text not null check (length(trim(sender_id)) > 0),
  target_id text,
  signal_type text not null check (length(trim(signal_type)) > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists atlas_protocols_protocol_collapsed_idx
  on public.atlas_protocols (protocol_id, collapsed_at desc);
create index if not exists atlas_ledger_user_created_idx
  on public.atlas_ledger (user_id, created_at desc);
create index if not exists atlas_xr_events_type_created_idx
  on public.atlas_xr_events (event_type, created_at desc);
create index if not exists atlas_webrtc_signals_room_created_idx
  on public.atlas_webrtc_signals (room_id, created_at desc);
create index if not exists atlas_webrtc_signals_target_created_idx
  on public.atlas_webrtc_signals (target_id, created_at desc)
  where target_id is not null;

alter table public.atlas_users enable row level security;
alter table public.atlas_protocols enable row level security;
alter table public.atlas_ledger enable row level security;
alter table public.atlas_xr_events enable row level security;
alter table public.atlas_webrtc_signals enable row level security;

-- AtlasStore uses the server-side service-role credential. Do not grant direct
-- table access to browser roles; add narrowly scoped policies only if a later
-- client-side access pattern is designed and threat-modelled.
revoke all on table
  public.atlas_users,
  public.atlas_protocols,
  public.atlas_ledger,
  public.atlas_xr_events,
  public.atlas_webrtc_signals
from anon, authenticated;

grant select, insert, update, delete on table
  public.atlas_users,
  public.atlas_protocols,
  public.atlas_ledger,
  public.atlas_xr_events,
  public.atlas_webrtc_signals
to service_role;

comment on table public.atlas_users is 'Server-side Atlas identities; direct browser access is intentionally disabled.';
comment on table public.atlas_protocols is 'Persisted protocol execution records for AtlasStore.';
comment on table public.atlas_ledger is 'Persisted Atlas economy entries; not a substitute for a separately audited financial ledger.';
comment on table public.atlas_xr_events is 'Persisted XR events; realtime fanout requires a separately verified subscription path.';
comment on table public.atlas_webrtc_signals is 'Persisted WebRTC signaling records; retention and authorization must be enforced by the service layer.';

commit;
