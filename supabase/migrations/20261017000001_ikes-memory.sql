-- Durable IKES sources and claims. This migration is intentionally additive.
-- Apply through the approved Supabase migration process; Git presence is not proof
-- that the remote database has been migrated.
begin;

create table if not exists public.atlas_knowledge_sources (
  source_id text primary key check (length(trim(source_id)) > 0),
  uri text not null check (uri ~* '^https?://'),
  title text not null check (length(trim(title)) > 0),
  publisher text,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  content_hash text not null check (content_hash ~ '^[a-fA-F0-9]{64}$'),
  license text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_knowledge_claims (
  claim_id text primary key check (length(trim(claim_id)) > 0),
  subject text not null check (length(trim(subject)) > 0),
  predicate text not null check (length(trim(predicate)) > 0),
  object_value text not null check (length(trim(object_value)) > 0),
  source_ids text[] not null check (cardinality(source_ids) > 0),
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  epistemic_state text not null check (epistemic_state in (
    'E0_UNVERIFIED','E1_SOURCE_FOUND','E2_CORROBORATED','E3_ACADEMICALLY_SUPPORTED',
    'E4_REPRODUCIBLE','E5_VALIDATED','E6_ESTABLISHED','ED_DISPUTED','EX_REJECTED','DP_DEPRECATED'
  )),
  temporal_state text not null check (temporal_state in ('current','historical','superseded')),
  valid_from timestamptz,
  valid_until timestamptz,
  license text,
  provenance jsonb not null default '{}'::jsonb,
  content_hash text not null check (content_hash ~ '^[a-fA-F0-9]{64}$'),
  version integer not null check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_knowledge_claims_current_idx
  on public.atlas_knowledge_claims (epistemic_state, updated_at desc)
  where temporal_state = 'current';
create index if not exists atlas_knowledge_claims_subject_idx
  on public.atlas_knowledge_claims (subject, predicate);

create or replace function public.atlas_knowledge_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists atlas_knowledge_sources_updated_at on public.atlas_knowledge_sources;
create trigger atlas_knowledge_sources_updated_at
before update on public.atlas_knowledge_sources
for each row execute function public.atlas_knowledge_set_updated_at();

drop trigger if exists atlas_knowledge_claims_updated_at on public.atlas_knowledge_claims;
create trigger atlas_knowledge_claims_updated_at
before update on public.atlas_knowledge_claims
for each row execute function public.atlas_knowledge_set_updated_at();

-- Preserve stable source identity across concurrent application replicas.
create or replace function public.atlas_knowledge_guard_source_identity()
returns trigger language plpgsql as $
begin
  if new.source_id <> old.source_id
    or new.uri <> old.uri
    or new.content_hash <> old.content_hash then
    raise exception 'IKES_SOURCE_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$;

drop trigger if exists atlas_knowledge_sources_identity_guard on public.atlas_knowledge_sources;
create trigger atlas_knowledge_sources_identity_guard
before update on public.atlas_knowledge_sources
for each row execute function public.atlas_knowledge_guard_source_identity();

-- Optimistic concurrency control: retries are idempotent only when both version
-- and content hash match. Stale or same-version conflicting claims are rejected.
create or replace function public.atlas_knowledge_guard_claim_version()
returns trigger language plpgsql as $
begin
  if new.claim_id <> old.claim_id then
    raise exception 'IKES_CLAIM_IDENTITY_IMMUTABLE';
  end if;
  if new.version = old.version and new.content_hash = old.content_hash then
    if row(new.subject, new.predicate, new.object_value, new.source_ids, new.evidence_ids,
      new.epistemic_state, new.temporal_state, new.valid_from, new.valid_until,
      new.license, new.provenance)
      is distinct from
      row(old.subject, old.predicate, old.object_value, old.source_ids, old.evidence_ids,
      old.epistemic_state, old.temporal_state, old.valid_from, old.valid_until,
      old.license, old.provenance) then
      raise exception 'IKES_CLAIM_SAME_VERSION_MUTATION';
    end if;
    return new;
  end if;
  if new.version <> old.version + 1 then
    raise exception 'IKES_CLAIM_VERSION_CONFLICT';
  end if;
  return new;
end;
$;

drop trigger if exists atlas_knowledge_claims_version_guard on public.atlas_knowledge_claims;
create trigger atlas_knowledge_claims_version_guard
before update on public.atlas_knowledge_claims
for each row execute function public.atlas_knowledge_guard_claim_version();

alter table public.atlas_knowledge_sources enable row level security;
alter table public.atlas_knowledge_claims enable row level security;

revoke all on table public.atlas_knowledge_sources, public.atlas_knowledge_claims from anon, authenticated;
grant select, insert, update on table public.atlas_knowledge_sources, public.atlas_knowledge_claims to service_role;

comment on table public.atlas_knowledge_sources is 'IKES source registry; content hash is integrity metadata, not proof of remote-source authenticity.';
comment on table public.atlas_knowledge_claims is 'IKES canonical claims; persistence never promotes epistemic state without the governed review path.';

commit;
