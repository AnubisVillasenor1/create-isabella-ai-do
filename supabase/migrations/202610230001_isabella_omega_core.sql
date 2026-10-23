-- Isabella Ω core persistence schema.
-- Apply through a reviewed Supabase migration; do not execute from application code.
create extension if not exists pgcrypto;

create table if not exists public.isabella_omega_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  session_id text,
  event_kind text not null check (event_kind in ('claim','decision','tool','model','policy','error')),
  actor_id text not null,
  payload jsonb not null default '{}'::jsonb,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  previous_hash text,
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists omega_evidence_tenant_time_idx
  on public.isabella_omega_evidence (tenant_id, created_at desc);
create index if not exists omega_evidence_session_time_idx
  on public.isabella_omega_evidence (session_id, created_at desc);

create table if not exists public.isabella_omega_memory (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  owner_id text not null,
  memory_key text not null,
  content jsonb not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  sensitivity text not null default 'internal'
    check (sensitivity in ('public','internal','confidential','restricted')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, owner_id, memory_key)
);

create index if not exists omega_memory_owner_idx
  on public.isabella_omega_memory (tenant_id, owner_id, updated_at desc);
create index if not exists omega_memory_expiry_idx
  on public.isabella_omega_memory (expires_at) where expires_at is not null;

alter table public.isabella_omega_evidence enable row level security;
alter table public.isabella_omega_memory enable row level security;

-- No client-facing policies are created intentionally. Server-side service-role access
-- must be restricted to trusted server code; add tenant-aware RLS policies before
-- exposing direct client access. Append-only semantics must be enforced separately
-- with database grants/triggers and operational controls.
