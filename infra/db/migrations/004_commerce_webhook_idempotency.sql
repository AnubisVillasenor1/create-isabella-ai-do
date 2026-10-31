-- COMMERCE — idempotencia de webhooks de pago.
-- La venta solo se registra una vez por (provider, external_event_id);
-- `sales` lo garantiza a nivel de negocio y `webhook_events` lleva el registro técnico.

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status
ON public.webhook_events (provider, status, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_intake ON public.webhook_events;
CREATE POLICY webhook_events_intake ON public.webhook_events FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS webhook_events_ops_read ON public.webhook_events FOR SELECT
USING (auth.role() = 'service_role');