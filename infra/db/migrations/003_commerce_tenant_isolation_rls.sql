-- COMMERCE — aislamiento por tenant/workspace (RLS) y tablas del plano comercial.
-- El reglamento exige RLS por workspace, no por usuario, para reads/writes/deletes.

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  plan_code TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.revenue_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  target NUMERIC NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact TEXT NOT NULL,
  consent_granted BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'raw',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.offers(id),
  gross_confirmed NUMERIC NOT NULL,
  fees NUMERIC NOT NULL DEFAULT 0,
  refunds NUMERIC NOT NULL DEFAULT 0,
  variable_cost NUMERIC NOT NULL DEFAULT 0,
  net_confirmed NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, external_event_id)
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = target AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS workspace_member_select ON public.campaigns;
CREATE POLICY workspace_member_select ON public.campaigns FOR SELECT
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_member_insert ON public.campaigns;
CREATE POLICY workspace_member_insert ON public.campaigns FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_member_update ON public.campaigns;
CREATE POLICY workspace_member_update ON public.campaigns FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_member_delete ON public.campaigns;
CREATE POLICY workspace_member_delete ON public.campaigns FOR DELETE
USING (public.is_workspace_member(workspace_id));