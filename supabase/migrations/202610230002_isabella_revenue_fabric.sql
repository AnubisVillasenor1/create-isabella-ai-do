-- Isabella Revenue Fabric: durable eligibility + idempotent accrual ledger.
-- This records accounting accruals only. It does not charge cards or transfer funds.
create extension if not exists pgcrypto;

create table if not exists public.isabella_commerce_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_id text not null check (plan_id in ('free','isabella_plus','enterprise')),
  status text not null check (status in ('active','trialing','past_due','canceled','inactive')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_end timestamptz,
  provider_event_created bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists isabella_commerce_subscriptions_user_idx
  on public.isabella_commerce_subscriptions(user_id, updated_at desc);

create table if not exists public.isabella_creator_profiles (
  user_id text primary key,
  tier text not null check (tier in ('standard','sovereign','elite')),
  status text not null check (status in ('pending','approved','suspended')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.isabella_revenue_share_runs (
  id uuid primary key default gen_random_uuid(),
  source_event_id text not null unique,
  creator_user_id text not null,
  subscription_id uuid not null references public.isabella_commerce_subscriptions(id),
  gross_cents bigint not null check (gross_cents > 0 and gross_cents <= 100000000),
  currency char(3) not null,
  creator_tier text not null,
  creator_bps integer not null check (creator_bps between 5000 and 8000),
  creator_cents bigint not null check (creator_cents >= 0),
  platform_cents bigint not null check (platform_cents >= 0),
  phoenix_fund_cents bigint not null check (phoenix_fund_cents >= 0),
  infrastructure_cents bigint not null check (infrastructure_cents >= 0),
  dao_cents bigint not null check (dao_cents >= 0),
  state text not null default 'accrued' check (state in ('accrued','held','reversed','paid')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint isabella_revenue_split_balances check (
    creator_cents + phoenix_fund_cents + infrastructure_cents + dao_cents = gross_cents
  )
);
create index if not exists isabella_revenue_runs_creator_idx
  on public.isabella_revenue_share_runs(creator_user_id, created_at desc);

create table if not exists public.isabella_revenue_share_lines (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.isabella_revenue_share_runs(id),
  account_code text not null check (account_code in ('provider_clearing','creator_payable','phoenix_fund','infrastructure','dao')),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  created_at timestamptz not null default now(),
  constraint isabella_revenue_line_one_side check ((debit_cents = 0) <> (credit_cents = 0))
);
create index if not exists isabella_revenue_lines_run_idx
  on public.isabella_revenue_share_lines(run_id);

alter table public.isabella_commerce_subscriptions enable row level security;
alter table public.isabella_creator_profiles enable row level security;
alter table public.isabella_revenue_share_runs enable row level security;
alter table public.isabella_revenue_share_lines enable row level security;
revoke all on public.isabella_commerce_subscriptions, public.isabella_creator_profiles,
  public.isabella_revenue_share_runs, public.isabella_revenue_share_lines from anon, authenticated;
grant select, insert, update, delete on public.isabella_commerce_subscriptions,
  public.isabella_creator_profiles, public.isabella_revenue_share_runs, public.isabella_revenue_share_lines to service_role;
grant usage, select on sequence public.isabella_revenue_share_lines_id_seq to service_role;

create or replace function public.record_isabella_revenue_accrual(
  p_source_event_id text,
  p_creator_user_id text,
  p_gross_cents bigint,
  p_currency text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.isabella_commerce_subscriptions%rowtype;
  v_creator public.isabella_creator_profiles%rowtype;
  v_user_bps integer;
  v_creator_cents bigint;
  v_platform_cents bigint;
  v_phoenix bigint;
  v_infrastructure bigint;
  v_dao bigint;
  v_run public.isabella_revenue_share_runs%rowtype;
begin
  if p_source_event_id is null or length(trim(p_source_event_id)) < 8 or length(p_source_event_id) > 200 then
    raise exception 'INVALID_SOURCE_EVENT_ID' using errcode = '22023';
  end if;
  if p_creator_user_id is null or length(trim(p_creator_user_id)) < 1 or length(p_creator_user_id) > 160 then
    raise exception 'INVALID_CREATOR_ID' using errcode = '22023';
  end if;
  if p_gross_cents is null or p_gross_cents <= 0 or p_gross_cents > 100000000 then
    raise exception 'INVALID_GROSS_CENTS' using errcode = '22023';
  end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_CURRENCY' using errcode = '22023';
  end if;

  select * into v_run from public.isabella_revenue_share_runs
    where source_event_id = p_source_event_id;
  if found then
    return jsonb_build_object('idempotent', true, 'run', to_jsonb(v_run), 'fundsMoved', false);
  end if;

  select * into v_subscription from public.isabella_commerce_subscriptions
    where user_id = p_creator_user_id and status = 'active' and plan_id <> 'free'
      and current_period_end > now()
    order by updated_at desc limit 1;
  if not found then
    raise exception 'CREATOR_REQUIRES_ACTIVE_PAID_SUBSCRIPTION' using errcode = '42501';
  end if;

  select * into v_creator from public.isabella_creator_profiles
    where user_id = p_creator_user_id and status = 'approved';
  if not found then
    raise exception 'CREATOR_NOT_APPROVED' using errcode = '42501';
  end if;

  v_user_bps := case v_creator.tier when 'standard' then 5000 when 'sovereign' then 7500 when 'elite' then 8000 else 0 end;
  if v_user_bps not between 5000 and 8000 then
    raise exception 'INVALID_CREATOR_TIER' using errcode = '22023';
  end if;

  v_creator_cents := floor(p_gross_cents * v_user_bps / 10000.0)::bigint;
  v_platform_cents := p_gross_cents - v_creator_cents;
  v_phoenix := floor(v_platform_cents * 0.20)::bigint;
  v_infrastructure := floor(v_platform_cents * 0.30)::bigint;
  v_dao := v_platform_cents - v_phoenix - v_infrastructure;

  insert into public.isabella_revenue_share_runs(
    source_event_id, creator_user_id, subscription_id, gross_cents, currency,
    creator_tier, creator_bps, creator_cents, platform_cents, phoenix_fund_cents,
    infrastructure_cents, dao_cents, metadata
  ) values (
    p_source_event_id, p_creator_user_id, v_subscription.id, p_gross_cents, p_currency,
    v_creator.tier, v_user_bps, v_creator_cents, v_platform_cents, v_phoenix,
    v_infrastructure, v_dao, coalesce(p_metadata, '{}'::jsonb)
  ) on conflict (source_event_id) do nothing returning * into v_run;

  if not found then
    select * into v_run from public.isabella_revenue_share_runs where source_event_id = p_source_event_id;
    return jsonb_build_object('idempotent', true, 'run', to_jsonb(v_run), 'fundsMoved', false);
  end if;

  -- Balanced double-entry accrual: one debit against provider clearing and
  -- credits to the creator and the platform's three internal allocations.
  insert into public.isabella_revenue_share_lines(run_id, account_code, debit_cents, credit_cents)
  select v_run.id, line.account_code, line.debit_cents, line.credit_cents
  from (values
    ('provider_clearing'::text, p_gross_cents, 0::bigint),
    ('creator_payable'::text, 0::bigint, v_creator_cents),
    ('phoenix_fund'::text, 0::bigint, v_phoenix),
    ('infrastructure'::text, 0::bigint, v_infrastructure),
    ('dao'::text, 0::bigint, v_dao)
  ) as line(account_code, debit_cents, credit_cents)
  where line.debit_cents > 0 or line.credit_cents > 0;

  return jsonb_build_object('idempotent', false, 'run', to_jsonb(v_run), 'fundsMoved', false);
end;
$$;

revoke all on function public.record_isabella_revenue_accrual(text,text,bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_isabella_revenue_accrual(text,text,bigint,text,jsonb) to service_role;

comment on table public.isabella_revenue_share_runs is 'Revenue share accruals; not a payment processor, payout system, or WORM-certified ledger.';
comment on function public.record_isabella_revenue_accrual(text,text,bigint,text,jsonb) is 'Idempotently records balanced creator revenue accruals after a trusted server verifies a provider event. Never transfers funds.';

create table if not exists public.isabella_commerce_provider_events (
  event_id text primary key,
  provider text not null check (provider in ('stripe')),
  event_type text not null,
  event_created bigint not null,
  processed_at timestamptz not null default now()
);
alter table public.isabella_commerce_provider_events enable row level security;
revoke all on public.isabella_commerce_provider_events from anon, authenticated;
grant select, insert, update, delete on public.isabella_commerce_provider_events to service_role;

create or replace function public.apply_isabella_stripe_subscription_event(
  p_event_id text,
  p_event_type text,
  p_event_created bigint,
  p_user_id text,
  p_plan_id text,
  p_subscription_id text,
  p_customer_id text,
  p_status text,
  p_period_end timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
  v_applied integer;
begin
  if p_event_id is null or length(p_event_id) < 8 or length(p_event_id) > 200
    or p_event_created is null or p_event_created < 1
    or p_user_id is null or length(p_user_id) < 1 or length(p_user_id) > 160
    or p_plan_id not in ('isabella_plus','enterprise')
    or p_subscription_id is null or length(p_subscription_id) < 1
    or p_status not in ('active','trialing','past_due','canceled','inactive') then
    raise exception 'INVALID_SUBSCRIPTION_EVENT' using errcode = '22023';
  end if;

  insert into public.isabella_commerce_provider_events(event_id, provider, event_type, event_created)
  values (p_event_id, 'stripe', p_event_type, p_event_created)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicateEvent', true, 'subscriptionUpdated', false);
  end if;

  insert into public.isabella_commerce_subscriptions(
    user_id, plan_id, status, provider, provider_customer_id,
    provider_subscription_id, current_period_end, provider_event_created, updated_at
  ) values (
    p_user_id, p_plan_id, p_status, 'stripe', p_customer_id,
    p_subscription_id, p_period_end, p_event_created, now()
  )
  on conflict (provider_subscription_id) do update set
    user_id = excluded.user_id,
    plan_id = excluded.plan_id,
    status = excluded.status,
    provider = excluded.provider,
    provider_customer_id = excluded.provider_customer_id,
    current_period_end = excluded.current_period_end,
    provider_event_created = excluded.provider_event_created,
    updated_at = now()
  where public.isabella_commerce_subscriptions.provider_event_created < excluded.provider_event_created;
  get diagnostics v_applied = row_count;

  return jsonb_build_object('duplicateEvent', false, 'subscriptionUpdated', v_applied = 1);
end;
$$;

revoke all on function public.apply_isabella_stripe_subscription_event(text,text,bigint,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_isabella_stripe_subscription_event(text,text,bigint,text,text,text,text,text,timestamptz) to service_role;

create table if not exists public.isabella_creator_offers (
  id uuid primary key default gen_random_uuid(),
  creator_user_id text not null,
  title text not null check (length(title) between 3 and 120),
  description text not null check (length(description) between 1 and 2000),
  price_cents bigint not null check (price_cents between 100 and 100000000),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists isabella_creator_offers_public_idx
  on public.isabella_creator_offers(status, created_at desc);
create index if not exists isabella_creator_offers_creator_idx
  on public.isabella_creator_offers(creator_user_id, created_at desc);

create table if not exists public.isabella_marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id text not null unique,
  source_event_id text not null unique,
  offer_id uuid not null references public.isabella_creator_offers(id),
  buyer_user_id text not null,
  creator_user_id text not null,
  gross_cents bigint not null check (gross_cents > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  revenue_run_id uuid references public.isabella_revenue_share_runs(id),
  payment_status text not null default 'paid' check (payment_status in ('paid','refunded','disputed')),
  created_at timestamptz not null default now()
);
create index if not exists isabella_marketplace_orders_buyer_idx
  on public.isabella_marketplace_orders(buyer_user_id, created_at desc);
create index if not exists isabella_marketplace_orders_creator_idx
  on public.isabella_marketplace_orders(creator_user_id, created_at desc);

alter table public.isabella_creator_offers enable row level security;
alter table public.isabella_marketplace_orders enable row level security;
revoke all on public.isabella_creator_offers, public.isabella_marketplace_orders from anon, authenticated;
grant select, insert, update, delete on public.isabella_creator_offers, public.isabella_marketplace_orders to service_role;

comment on table public.isabella_creator_offers is 'Creator marketplace offers. All reads/writes go through server routes with identity and entitlement checks.';
comment on table public.isabella_marketplace_orders is 'Verified Stripe Checkout purchases; linked revenue run is an accrual, not a payout.';
