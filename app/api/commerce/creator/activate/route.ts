import { authenticateSupabaseRequest } from "@/lib/isabella/commerce-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await authenticateSupabaseRequest(request);
  if (!identity) return Response.json({ error: "authentication_required" }, { status: 401 });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "durable_store_unconfigured" }, { status: 503 });

  const root = url.replace(/\/$/, "");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  const subscriptionQuery = new URLSearchParams({
    select: "id,plan_id,status,current_period_end",
    user_id: `eq.${identity.id}`,
    status: "eq.active",
    plan_id: "neq.free",
    current_period_end: `gt.${new Date().toISOString()}`,
    order: "updated_at.desc",
    limit: "1",
  });
  try {
    const subscriptionResponse = await fetch(`${root}/rest/v1/isabella_commerce_subscriptions?${subscriptionQuery}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!subscriptionResponse.ok) return Response.json({ error: "subscription_lookup_failed" }, { status: 502 });
    const subscriptions = await subscriptionResponse.json() as Array<{ id: string }>;
    if (!subscriptions.length) return Response.json({
      error: "active_paid_subscription_required",
      message: "Activa Isabella Plus y espera la confirmación verificada del proveedor de pagos antes de activar monetización.",
    }, { status: 403 });

    const profileQuery = new URLSearchParams({ select: "user_id,tier,status", user_id: `eq.${identity.id}`, limit: "1" });
    const profileResponse = await fetch(`${root}/rest/v1/isabella_creator_profiles?${profileQuery}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (!profileResponse.ok) return Response.json({ error: "creator_profile_lookup_failed" }, { status: 502 });
    const profiles = await profileResponse.json() as Array<{ tier: string; status: string }>;
    const current = profiles[0];
    if (current?.status === "suspended") return Response.json({ error: "creator_profile_suspended" }, { status: 403 });
    if (current?.status === "approved") return Response.json({ activated: true, tier: current.tier, payoutsEnabled: false, idempotent: true });

    const tier = current && ["standard", "sovereign", "elite"].includes(current.tier) ? current.tier : "standard";
    const response = await fetch(`${root}/rest/v1/isabella_creator_profiles?on_conflict=user_id`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ user_id: identity.id, tier, status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }]),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return Response.json({ error: "creator_profile_activation_failed" }, { status: 502 });
    return Response.json({ activated: true, tier, payoutsEnabled: false, note: "La elegibilidad de devengo se ha activado. Los pagos al creador siguen deshabilitados hasta integrar KYC/Stripe Connect, controles fiscales y payout." }, { status: 201 });
  } catch {
    return Response.json({ error: "creator_activation_unavailable", retryable: true }, { status: 502 });
  }
}
